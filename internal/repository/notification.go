package repository

import (
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"github.com/primordialweave/zhusuan/internal/database"
	"github.com/primordialweave/zhusuan/internal/models"
	bizerrors "github.com/primordialweave/zhusuan/internal/pkg/errors"
)

// NotificationRepository 通知数据仓库
type NotificationRepository struct {
	db *gorm.DB
}

const notificationInboxFields = "notifications.*, COALESCE(un.is_read, 0) AS is_read"

// fillTargets derives recipients from inbox membership without adding a schema
// column. Legacy notifications with several relations have no known single target.
func (r *NotificationRepository) fillTargets(notifications []models.Notification) error {
	ids := make([]int64, 0, len(notifications))
	for i := range notifications {
		notifications[i].TargetUserID = 0
		if notifications[i].IsGlobal != 1 {
			ids = append(ids, notifications[i].ID)
		}
	}
	if len(ids) == 0 {
		return nil
	}
	var targets []struct {
		NotificationID int64
		TargetUserID   int64
	}
	if err := r.db.Model(&models.UserNotification{}).
		Select("notification_id, MIN(user_id) AS target_user_id").
		Where("notification_id IN ?", ids).
		Group("notification_id").Having("COUNT(*) = 1").Scan(&targets).Error; err != nil {
		return err
	}
	targetByNotification := make(map[int64]int64, len(targets))
	for _, target := range targets {
		targetByNotification[target.NotificationID] = target.TargetUserID
	}
	for i := range notifications {
		if notifications[i].IsGlobal != 1 {
			notifications[i].TargetUserID = targetByNotification[notifications[i].ID]
		}
	}
	return nil
}

func validateNotificationTarget(tx *gorm.DB, targetUserID int64) error {
	if targetUserID < 0 {
		return bizerrors.New(400, "发送对象无效")
	}
	if targetUserID == 0 {
		return nil
	}
	var count int64
	if err := tx.Model(&models.User{}).Where("id = ?", targetUserID).Count(&count).Error; err != nil {
		return err
	}
	if count == 0 {
		return bizerrors.New(400, "发送对象不存在")
	}
	return nil
}

// NewNotificationRepository 创建通知仓库
func NewNotificationRepository() *NotificationRepository {
	return &NotificationRepository{db: database.GetDB()}
}

// Create 创建新通知
//
// 逻辑说明:
// 1. 如果是全员通知 (IsGlobal=1)，直接插入 notifications 表。
// 2. 如果是私信 (IsGlobal=0)，开启事务：
//   - 插入 notifications 表
//   - 插入 user_notifications 表，建立用户与通知的关联(Inbox模式)
func (r *NotificationRepository) Create(notification *models.Notification, targetUserID int64) error {
	if notification.IsGlobal == 1 {
		return r.db.Create(notification).Error
	}

	return r.db.Transaction(func(tx *gorm.DB) error {
		if err := validateNotificationTarget(tx, targetUserID); err != nil {
			return err
		}
		// 1. 插入主表
		if err := tx.Create(notification).Error; err != nil {
			return err
		}

		// 2. 插入用户关联表 (初始状态未读)
		userNotification := models.UserNotification{
			UserID:         targetUserID,
			NotificationID: notification.ID,
			IsRead:         0,
		}
		return tx.Create(&userNotification).Error
	})
}

// Update 更新通知
func (r *NotificationRepository) Update(notification *models.Notification, targetUserID int64) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		var current models.Notification
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&current, notification.ID).Error; err != nil {
			return err
		}
		if err := validateNotificationTarget(tx, targetUserID); err != nil {
			return err
		}
		if err := tx.Model(notification).Omit("Sender").Save(notification).Error; err != nil {
			return err
		}
		if notification.IsGlobal == 1 {
			return nil // Existing readers retain their read state when the audience expands.
		}
		if err := tx.Where("notification_id = ? AND user_id <> ?", notification.ID, targetUserID).
			Delete(&models.UserNotification{}).Error; err != nil {
			return err
		}
		// Keep a surviving recipient's read state; a genuinely new recipient starts unread.
		return tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&models.UserNotification{
			UserID: targetUserID, NotificationID: notification.ID, IsRead: 0,
		}).Error
	})
}

// FindByID 根据ID精确查找通知（并包含发送者信息）
func (r *NotificationRepository) FindByID(id int64) (*models.Notification, error) {
	var notification models.Notification

	// 使用 Preload 一次性获取 notification 和 sender，避免 N+1 查询
	if err := r.db.Preload("Sender").First(&notification, id).Error; err != nil {
		return nil, err
	}

	return &notification, nil
}

// FindByIDForUser finds a global notification or one addressed to the given user.
func (r *NotificationRepository) FindByIDForUser(id, userID int64) (*models.Notification, error) {
	var notification models.Notification
	err := r.db.Preload("Sender").Select(notificationInboxFields).
		Joins("LEFT JOIN user_notifications un ON notifications.id = un.notification_id AND un.user_id = ?", userID).
		Where("notifications.id = ? AND (notifications.is_global = 1 OR un.id IS NOT NULL)", id).
		First(&notification).Error
	if err != nil {
		return nil, err
	}
	projected := []models.Notification{notification}
	if err := r.fillTargets(projected); err != nil {
		return nil, err
	}
	notification.TargetUserID = projected[0].TargetUserID
	return &notification, nil
}

// ListByUser 分页获取用户的通知列表
// 此方法融合了 "全局通知" 和 "私信" 的读取逻辑：
// 1. 全员通知 (IsGlobal=1): 对所有人都可见。通过 LEFT JOIN user_notifications 判断已读状态。
// 2. 私信 (IsGlobal=0): 仅当 user_notifications 存在关联记录时才可见。
func (r *NotificationRepository) ListByUser(userID int64, offset, limit int) ([]models.Notification, int64, error) {
	var notifications []models.Notification
	var total int64

	// 构建复合查询
	db := r.db.Table("notifications").
		Joins("LEFT JOIN user_notifications un ON notifications.id = un.notification_id AND un.user_id = ?", userID).
		Where("(notifications.is_global = 1) OR (un.id IS NOT NULL)")

	// 1. 获取符合条件的总数
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	// 2. 获取分页数据并计算是否已读 (is_read)
	// COALESCE(un.is_read, 0): 如果关联表没有记录(如全员通知未读)，默认为0(未读)
	err := db.Select(notificationInboxFields).
		Order("notifications.create_time DESC").
		Offset(offset).
		Limit(limit).
		Find(&notifications).Error

	if err != nil {
		return nil, 0, err
	}

	if err := r.fillTargets(notifications); err != nil {
		return nil, 0, err
	}
	r.fillSenders(notifications)
	return notifications, total, nil
}

// ListAll 获取所有通知（管理员用）
func (r *NotificationRepository) ListAll(offset, limit int) ([]models.Notification, int64, error) {
	var notifications []models.Notification
	var total int64

	if err := r.db.Model(&models.Notification{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	if err := r.db.Order("create_time DESC").Offset(offset).Limit(limit).Find(&notifications).Error; err != nil {
		return nil, 0, err
	}
	r.fillSenders(notifications)
	return notifications, total, nil
}

// MarkAsRead 标记通知为已读
// 该操作会更新或插入 user_notifications 表记录。
func (r *NotificationRepository) MarkAsRead(id int64, userID int64) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		// Share the recipient-update lock so a late read cannot restore a removed inbox relation.
		var notification models.Notification
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&notification, id).Error; err != nil {
			return err
		}
		var un models.UserNotification
		err := tx.Where("user_id = ? AND notification_id = ?", userID, id).First(&un).Error
		if err == nil {
			if un.IsRead == 0 {
				return tx.Model(&models.UserNotification{}).Where("id = ?", un.ID).
					Updates(map[string]any{"is_read": 1, "read_time": tx.NowFunc()}).Error
			}
			return nil
		}
		if err != gorm.ErrRecordNotFound {
			return err
		}
		if notification.IsGlobal != 1 {
			return nil // A non-recipient cannot create a private inbox relation.
		}
		now := tx.NowFunc()
		return tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&models.UserNotification{
			UserID: userID, NotificationID: id, IsRead: 1, ReadTime: &now,
		}).Error
	})
}

// Delete 删除通知
func (r *NotificationRepository) Delete(id int64) error {
	// 事务删除：删除通知和关联的 user_notifications
	return r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("notification_id = ?", id).Delete(&models.UserNotification{}).Error; err != nil {
			return err
		}
		return tx.Delete(&models.Notification{}, id).Error
	})
}

// GetUnreadCount 获取用户的未读通知总数
func (r *NotificationRepository) GetUnreadCount(userID int64) (int64, error) {
	var count int64
	// 统计逻辑：
	// 1. 全员通知 (IsGlobal=1) 且 user_notifications 中不存在记录 (un.id IS NULL 或者 is_read=0)
	// 2. 私信 (IsGlobal=0) 且 user_notifications 中存在记录但 is_read=0

	err := r.db.Table("notifications").
		Joins("LEFT JOIN user_notifications un ON notifications.id = un.notification_id AND un.user_id = ?", userID).
		Where("((notifications.is_global = 1 AND (un.id IS NULL OR un.is_read = 0)) OR (notifications.is_global = 0 AND un.is_read = 0 AND un.id IS NOT NULL))").
		Count(&count).Error

	return count, err
}

// fillSenders 辅助方法：批量填充 Sender 信息
func (r *NotificationRepository) fillSenders(notifications []models.Notification) {
	senderIDs := make([]int64, 0)
	for _, n := range notifications {
		senderIDs = append(senderIDs, n.SenderID)
	}

	if len(senderIDs) == 0 {
		return
	}

	var senders []models.User
	r.db.Where("id IN ?", senderIDs).Find(&senders)

	senderMap := make(map[int64]*models.User)
	for i := range senders {
		senderMap[senders[i].ID] = &senders[i]
	}

	for i := range notifications {
		if sender, ok := senderMap[notifications[i].SenderID]; ok {
			notifications[i].Sender = sender
		}
	}
}

// ListUsers 获取用户列表（用于选择发送目标）
func (r *NotificationRepository) ListUsers() ([]models.User, error) {
	var users []models.User
	if err := r.db.Select("id", "name", "username").
		Where("status = 1").
		Find(&users).Error; err != nil {
		return nil, err
	}
	return users, nil
}
