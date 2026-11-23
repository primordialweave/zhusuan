package service

import (
	"encoding/json"
	"fmt"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/primordialweave/zhusuan/internal/database"
	"github.com/primordialweave/zhusuan/internal/models"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func notificationTargetFixture(t *testing.T) (*NotificationService, []int64) {
	t.Helper()
	setupServiceTestDB(t)
	db := database.GetDB()
	require.NoError(t, db.AutoMigrate(&models.Notification{}, &models.UserNotification{}))
	ids := []int64{991201, 991202, 991203}
	for i, id := range ids {
		user := models.User{ID: id, Username: fmt.Sprintf("notification-target-%d", i), Name: "recipient fixture", Password: "fixture", Status: 1}
		require.NoError(t, db.Create(&user).Error)
	}
	t.Cleanup(func() { require.NoError(t, db.Where("id IN ?", ids).Delete(&models.User{}).Error) })
	return NewNotificationService(), ids
}

func notificationTargetCreate(t *testing.T, svc *NotificationService, sender, target int64) *models.Notification {
	t.Helper()
	notification, err := svc.Create(sender, "recipient fixture", "initial content", "activity", target)
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, svc.Delete(notification.ID)) })
	return notification
}

func assertNotificationResponseTarget(t *testing.T, notification *models.Notification, target int64) {
	t.Helper()
	encoded, err := json.Marshal(notification)
	require.NoError(t, err)
	var response map[string]any
	require.NoError(t, json.Unmarshal(encoded, &response))
	require.Contains(t, response, "target_user_id")
	require.Equal(t, float64(target), response["target_user_id"])
}

func assertNotificationVisibility(t *testing.T, svc *NotificationService, user, id int64, visible bool, target int64) {
	t.Helper()
	list, _, err := svc.ListByUser(user, 1, 100)
	require.NoError(t, err)
	found := false
	for i := range list {
		if list[i].ID == id {
			found = true
			assertNotificationResponseTarget(t, &list[i], target)
		}
	}
	require.Equal(t, visible, found)
	detail, err := svc.GetForUser(user, id)
	if visible {
		require.NoError(t, err)
		assertNotificationResponseTarget(t, detail, target)
	} else {
		require.Error(t, err)
	}
}

func TestNotificationTargetCreateReturnsRecipientWithoutSchemaColumn(t *testing.T) {
	svc, users := notificationTargetFixture(t)
	private := notificationTargetCreate(t, svc, users[0], users[1])
	assertNotificationResponseTarget(t, private, users[1])
	assertNotificationVisibility(t, svc, users[1], private.ID, true, users[1])
	assertNotificationVisibility(t, svc, users[2], private.ID, false, 0)
	global := notificationTargetCreate(t, svc, users[0], 0)
	assertNotificationResponseTarget(t, global, 0)
	assertNotificationVisibility(t, svc, users[2], global.ID, true, 0)
	require.False(t, database.GetDB().Migrator().HasColumn(&models.Notification{}, "target_user_id"))
}

func TestNotificationTargetChangesReplaceInboxRecipient(t *testing.T) {
	svc, users := notificationTargetFixture(t)
	notification := notificationTargetCreate(t, svc, users[0], users[1])
	require.NoError(t, svc.MarkAsRead(notification.ID, users[1]))
	updated, err := svc.Update(notification.ID, notification.Title, "changed content", "activity", users[2])
	require.NoError(t, err)
	assertNotificationResponseTarget(t, updated, users[2])
	require.Equal(t, notification.SenderID, updated.SenderID)
	require.True(t, notification.CreateTime.Equal(updated.CreateTime))
	require.Equal(t, 2, updated.Type)
	assertNotificationVisibility(t, svc, users[1], notification.ID, false, 0)
	assertNotificationVisibility(t, svc, users[2], notification.ID, true, users[2])
	count, err := svc.GetUnreadCount(users[2])
	require.NoError(t, err)
	require.Equal(t, int64(1), count)
	var relations []models.UserNotification
	require.NoError(t, database.GetDB().Where("notification_id = ?", notification.ID).Find(&relations).Error)
	require.Len(t, relations, 1)
	require.Equal(t, users[2], relations[0].UserID)
	require.Zero(t, relations[0].IsRead)
}

func TestNotificationTargetBroadcastAndPrivateTransitionsPreserveSurvivingReadState(t *testing.T) {
	svc, users := notificationTargetFixture(t)
	notification := notificationTargetCreate(t, svc, users[0], users[1])
	require.NoError(t, svc.MarkAsRead(notification.ID, users[1]))
	global, err := svc.Update(notification.ID, notification.Title, notification.Content, "activity", 0)
	require.NoError(t, err)
	assertNotificationResponseTarget(t, global, 0)
	for _, user := range users {
		assertNotificationVisibility(t, svc, user, notification.ID, true, 0)
	}
	require.NoError(t, svc.MarkAsRead(notification.ID, users[2]))
	var surviving models.UserNotification
	require.NoError(t, database.GetDB().Where("notification_id = ? AND user_id = ?", notification.ID, users[2]).First(&surviving).Error)
	private, err := svc.Update(notification.ID, notification.Title, notification.Content, "activity", users[2])
	require.NoError(t, err)
	assertNotificationResponseTarget(t, private, users[2])
	assertNotificationVisibility(t, svc, users[0], notification.ID, false, 0)
	assertNotificationVisibility(t, svc, users[1], notification.ID, false, 0)
	assertNotificationVisibility(t, svc, users[2], notification.ID, true, users[2])
	var stored models.UserNotification
	require.NoError(t, database.GetDB().Where("notification_id = ?", notification.ID).First(&stored).Error)
	require.Equal(t, surviving.ID, stored.ID)
	require.Equal(t, surviving.ReadTime, stored.ReadTime)
	require.Equal(t, 1, stored.IsRead)
}

func TestNotificationTargetSameAudienceDoesNotDuplicateOrResetReadState(t *testing.T) {
	svc, users := notificationTargetFixture(t)
	notification := notificationTargetCreate(t, svc, users[0], users[1])
	require.NoError(t, svc.MarkAsRead(notification.ID, users[1]))
	var before models.UserNotification
	require.NoError(t, database.GetDB().Where("notification_id = ?", notification.ID).First(&before).Error)
	for i := 0; i < 2; i++ {
		updated, err := svc.Update(notification.ID, notification.Title, "updated", "activity", users[1])
		require.NoError(t, err)
		assertNotificationResponseTarget(t, updated, users[1])
	}
	var relations []models.UserNotification
	require.NoError(t, database.GetDB().Where("notification_id = ?", notification.ID).Find(&relations).Error)
	require.Len(t, relations, 1)
	require.Equal(t, before.ID, relations[0].ID)
	require.Equal(t, before.ReadTime, relations[0].ReadTime)
	require.Equal(t, 1, relations[0].IsRead)
	count, err := svc.GetUnreadCount(users[1])
	require.NoError(t, err)
	require.Zero(t, count)
}

func TestNotificationTargetWriteFailureRollsBackContentAndAudienceThenRetries(t *testing.T) {
	svc, users := notificationTargetFixture(t)
	notification := notificationTargetCreate(t, svc, users[0], users[1])
	db := database.GetDB()
	trigger := fmt.Sprintf("CREATE TRIGGER notification_target_failure BEFORE INSERT ON user_notifications WHEN NEW.notification_id = %d AND NEW.user_id = %d BEGIN SELECT RAISE(ABORT, 'recipient write failed'); END", notification.ID, users[2])
	require.NoError(t, db.Exec(trigger).Error)
	t.Cleanup(func() { require.NoError(t, db.Exec("DROP TRIGGER IF EXISTS notification_target_failure").Error) })
	_, err := svc.Update(notification.ID, "failed title", "failed content", "private", users[2])
	require.Error(t, err)
	stored, err := svc.Get(notification.ID)
	require.NoError(t, err)
	require.Equal(t, notification.Title, stored.Title)
	require.Equal(t, notification.Content, stored.Content)
	require.Equal(t, notification.Type, stored.Type)
	assertNotificationVisibility(t, svc, users[1], notification.ID, true, users[1])
	assertNotificationVisibility(t, svc, users[2], notification.ID, false, 0)
	require.NoError(t, db.Exec("DROP TRIGGER notification_target_failure").Error)
	updated, err := svc.Update(notification.ID, "retry title", "retry content", "private", users[2])
	require.NoError(t, err)
	require.Equal(t, 3, updated.Type)
	assertNotificationResponseTarget(t, updated, users[2])
	assertNotificationVisibility(t, svc, users[1], notification.ID, false, 0)
	assertNotificationVisibility(t, svc, users[2], notification.ID, true, users[2])
}

func TestNotificationTargetInvalidRecipientDoesNotMutateNotification(t *testing.T) {
	svc, users := notificationTargetFixture(t)
	notification := notificationTargetCreate(t, svc, users[0], users[1])
	for _, target := range []int64{-1, 999999999} {
		_, err := svc.Update(notification.ID, "invalid", "invalid", "system", target)
		require.Error(t, err)
		stored, err := svc.Get(notification.ID)
		require.NoError(t, err)
		require.Equal(t, notification.Title, stored.Title)
		assertNotificationVisibility(t, svc, users[1], notification.ID, true, users[1])
		_, err = svc.Create(users[0], "invalid create", "invalid", "system", target)
		require.Error(t, err)
	}
}

func TestNotificationTargetLateReadDoesNotRestoreDroppedRecipient(t *testing.T) {
	svc, users := notificationTargetFixture(t)
	notification := notificationTargetCreate(t, svc, users[0], 0)
	require.NoError(t, svc.MarkAsRead(notification.ID, users[1]))
	_, err := svc.Update(notification.ID, notification.Title, notification.Content, "activity", users[2])
	require.NoError(t, err)
	// A delayed read request from the former broadcast reader cannot recreate membership.
	require.NoError(t, svc.MarkAsRead(notification.ID, users[1]))
	assertNotificationVisibility(t, svc, users[1], notification.ID, false, 0)
	assertNotificationVisibility(t, svc, users[2], notification.ID, true, users[2])
	var relations []models.UserNotification
	require.NoError(t, database.GetDB().Where("notification_id = ?", notification.ID).Find(&relations).Error)
	require.Len(t, relations, 1)
	require.Equal(t, users[2], relations[0].UserID)
	require.Zero(t, relations[0].IsRead)
}

func TestNotificationTargetAmbiguousLegacyInboxRequiresExplicitRecipient(t *testing.T) {
	svc, users := notificationTargetFixture(t)
	notification := notificationTargetCreate(t, svc, users[0], users[1])
	// The previous global-to-private update changed only is_global and could leave
	// several readers' relations behind. None of these IDs is a known single target.
	require.NoError(t, database.GetDB().Create(&models.UserNotification{
		UserID: users[2], NotificationID: notification.ID, IsRead: 1,
	}).Error)
	for _, user := range users[1:] {
		assertNotificationVisibility(t, svc, user, notification.ID, true, 0)
	}
	_, err := svc.Update(notification.ID, notification.Title, notification.Content, "activity", users[2])
	require.NoError(t, err)
	assertNotificationVisibility(t, svc, users[1], notification.ID, false, 0)
	assertNotificationVisibility(t, svc, users[2], notification.ID, true, users[2])
}

func TestNotificationTargetInFlightReadCannotRestoreRemovedRelation(t *testing.T) {
	svc, users := notificationTargetFixture(t)
	notification := notificationTargetCreate(t, svc, users[0], users[1])
	db := database.GetDB()
	readFetched := make(chan struct{})
	resumeRead := make(chan struct{})
	var resumeOnce sync.Once
	resume := func() { resumeOnce.Do(func() { close(resumeRead) }) }
	t.Cleanup(resume)
	var pauseOnce sync.Once
	const callback = "notification_target:pause_recipient_read"
	require.NoError(t, db.Callback().Query().After("gorm:query").Register(callback, func(tx *gorm.DB) {
		if tx.Statement.Schema != nil && tx.Statement.Schema.Name == "UserNotification" {
			pauseOnce.Do(func() {
				close(readFetched)
				<-resumeRead
			})
		}
	}))
	t.Cleanup(func() { require.NoError(t, db.Callback().Query().Remove(callback)) })
	readResult := make(chan error, 1)
	go func() { readResult <- svc.MarkAsRead(notification.ID, users[1]) }()
	select {
	case <-readFetched:
	case <-time.After(time.Second):
		t.Fatal("read did not reach the controlled relation fetch")
	}
	updateResult := make(chan error, 1)
	go func() {
		_, err := svc.Update(notification.ID, notification.Title, notification.Content, "activity", users[2])
		updateResult <- err
	}()
	// With the old non-transactional read, Update completes while the stale relation
	// is paused; its subsequent Save then inserts the removed recipient again.
	var updateErr error
	updateCompleted := false
	select {
	case updateErr = <-updateResult:
		updateCompleted = true
	case <-time.After(100 * time.Millisecond):
	}
	resume()
	require.NoError(t, <-readResult)
	if !updateCompleted {
		updateErr = <-updateResult
	}
	require.NoError(t, updateErr)
	require.NoError(t, db.Callback().Query().Remove(callback))
	var relations []models.UserNotification
	require.NoError(t, db.Where("notification_id = ?", notification.ID).Find(&relations).Error)
	require.Len(t, relations, 1)
	require.Equal(t, users[2], relations[0].UserID)
	require.Zero(t, relations[0].IsRead)
}

func TestNotificationTargetReadQueryCountIsBoundedPerPage(t *testing.T) {
	svc, users := notificationTargetFixture(t)
	global := notificationTargetCreate(t, svc, users[0], 0)
	for i := 0; i < 5; i++ {
		notificationTargetCreate(t, svc, users[0], users[1])
	}
	db := database.GetDB()
	var queries atomic.Int64
	const callback = "notification_target:count_read_queries"
	count := func(*gorm.DB) { queries.Add(1) }
	require.NoError(t, db.Callback().Query().After("gorm:query").Register(callback, count))
	require.NoError(t, db.Callback().Row().After("gorm:row").Register(callback, count))
	t.Cleanup(func() {
		require.NoError(t, db.Callback().Query().Remove(callback))
		require.NoError(t, db.Callback().Row().Remove(callback))
	})
	for _, fixture := range []struct {
		name  string
		user  int64
		limit int
		want  int64
	}{
		{"global inbox", users[0], 100, 3},
		{"one targeted row", users[1], 1, 4},
		{"five targeted rows", users[1], 100, 4},
	} {
		t.Run(fixture.name, func(t *testing.T) {
			queries.Store(0)
			_, _, err := svc.ListByUser(fixture.user, 1, fixture.limit)
			require.NoError(t, err)
			require.Equal(t, fixture.want, queries.Load())
		})
	}
	queries.Store(0)
	_, err := svc.GetForUser(users[0], global.ID)
	require.NoError(t, err)
	require.Equal(t, int64(2), queries.Load(), "global detail retains its original query count")
}
