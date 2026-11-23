package service

import (
	"errors"
	"math"
	"strings"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"github.com/primordialweave/zhusuan/internal/constants"
	"github.com/primordialweave/zhusuan/internal/database"
	"github.com/primordialweave/zhusuan/internal/dto"
	"github.com/primordialweave/zhusuan/internal/models"
	pkgerrors "github.com/primordialweave/zhusuan/internal/pkg/errors"
	"github.com/primordialweave/zhusuan/internal/repository"
)

const (
	paymentStageAll     = "all"
	paymentStageReceipt = "receipt"
	paymentLockStrength = "UPDATE"
)

// PaymentService 款项(回款)服务
// 负责处理所有与款项相关的业务逻辑，包括生成收款计划、更新收款状态、
// 执行回款确认事务以及自动计算回款百分比。
//
// 依赖:
//   - PaymentRepository: 款项数据操作
//   - ProjectRepository: 项目数据操作 (用于更新项目总已收金额)
type PaymentService struct {
	paymentRepo *repository.PaymentRepository
	projectRepo *repository.ProjectRepository
}

// NewPaymentService 创建并初始化收款服务
//
// 返回:
//   - *PaymentService: 初始化的服务实例
func NewPaymentService() *PaymentService {
	return &PaymentService{
		paymentRepo: repository.NewPaymentRepository(),
		projectRepo: repository.NewProjectRepository(),
	}
}

// ListByProjectForUser 根据项目ID获取该项目的所有收款计划（校验项目归属）
// 用于在项目详情页展示款项列表。
func (s *PaymentService) ListByProjectForUser(userID, projectID int64) ([]models.Payment, error) {
	if _, err := s.projectRepo.FindByIDForUser(projectID, userID); err != nil {
		return nil, err
	}
	return s.paymentRepo.ListByProject(projectID)
}

// ListByDateRange 获取指定日期范围内的所有款项记录 (报表/日历用)
// 包含起始日期和结束日期（闭区间）。
//
// 参数:
//   - userID: 用户ID
//   - startDate: 开始日期 "YYYY-MM-DD"
//   - endDate: 结束日期 "YYYY-MM-DD"
//
// 返回:
//   - []models.Payment: 范围内的款项列表
//   - error: 数据库查询错误
func (s *PaymentService) ListByDateRange(userID int64, startDate, endDate string) ([]models.Payment, error) {
	start, err := time.Parse("2006-01-02", startDate)
	if err != nil {
		return nil, pkgerrors.WrapWithCode(err, 400, "开始日期格式错误")
	}
	end, err := time.Parse("2006-01-02", endDate)
	if err != nil {
		return nil, pkgerrors.WrapWithCode(err, 400, "结束日期格式错误")
	}
	if start.After(end) {
		return nil, pkgerrors.WrapWithCode(errors.New("日期范围错误"), 400, "开始日期不能晚于结束日期")
	}
	return s.paymentRepo.ListByDateRange(userID, startDate, endDate)
}

// ListReceiptsByDateRange lists confirmed receipts by actual date rather than planned date.
func (s *PaymentService) ListReceiptsByDateRange(userID int64, startDate, endDate string) ([]models.Payment, error) {
	start, err := receiptActualDate(startDate)
	if err != nil {
		return nil, err
	}
	end, err := receiptActualDate(endDate)
	if err != nil {
		return nil, err
	}
	if start == nil || end == nil {
		return nil, pkgerrors.ErrInvalidParam
	}
	if start.After(*end) {
		return nil, pkgerrors.New(400, "开始日期不能晚于结束日期")
	}
	return repository.NewReceiptRepository().ListByActualDate(userID, startDate, endDate)
}

// Create 创建新的收款/回款计划
//
// 参数:
//   - input: 收款请求DTO
//
// 返回:
//   - *models.Payment: 创建成功的款项实体
//   - error: 业务规则校验失败或数据库错误
func (s *PaymentService) Create(input dto.PaymentRequest) (*models.Payment, error) {
	if err := validatePositiveAmount(input.Amount); err != nil {
		return nil, err
	}
	// 外层权限检查
	if _, err := s.projectRepo.FindByIDForUser(input.ProjectID, input.UserID); err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, pkgerrors.ErrProjectNotFound
		}
		return nil, pkgerrors.Wrap(err, "查询项目失败")
	}

	loc := time.Local
	actualDate, err := receiptActualDate(input.ActualDate)
	if err != nil {
		return nil, err
	}
	planDateText := input.PlanDate
	if planDateText == "" && actualDate != nil {
		planDateText = input.ActualDate
	}
	planDate, err := time.ParseInLocation("2006-01-02", planDateText, loc)
	if err != nil {
		return nil, pkgerrors.WrapWithCode(err, 400, "计划日期格式错误")
	}

	payment := &models.Payment{
		ProjectID:  input.ProjectID,
		Stage:      input.Stage,
		Amount:     input.Amount,
		PlanDate:   planDate,
		ActualDate: actualDate,
		Status:     input.Status,
		Method:     input.Method,
		Remark:     input.Remark,
		UserID:     input.UserID,
	}
	initializePaymentState(payment)

	// 在事务中完成创建 + 规则处理 + 项目金额同步，确保一致性
	err = database.GetDB().Transaction(func(tx *gorm.DB) error {
		if _, err := lockPaymentProjectInTx(tx, payment.ProjectID, payment.UserID); err != nil {
			return err
		}
		// 执行核心业务规则校验与处理（如计算百分比、自动填充实际日期逻辑等）
		if err := s.processPaymentRulesInTx(tx, payment); err != nil {
			return err
		}

		// 创建收款记录
		if err := tx.Create(payment).Error; err != nil {
			return err
		}

		// 级联更新: 重新计算并同步该项目对应的"已收款总额"字段
		return s.syncProjectReceivedAmountInTx(tx, payment.ProjectID)
	})
	if err != nil {
		return nil, err
	}

	// 事务提交后清除该用户的 Dashboard 统计缓存
	invalidateDashboardCache(payment.UserID)
	return payment, nil
}

func initializePaymentState(payment *models.Payment) {
	if strings.TrimSpace(payment.Stage) == "" {
		if payment.ActualDate != nil {
			payment.Stage = paymentStageReceipt
		} else {
			payment.Stage = paymentStageAll
		}
	}

	// Actual-date input represents a receipt; plan-only legacy input remains pending.
	if payment.Status == "" {
		if payment.ActualDate != nil {
			payment.Status = constants.PaymentStatusConfirmed
		} else {
			payment.Status = constants.PaymentStatusPending
		}
	}
}

// UpdateForUser 更新收款计划详情（校验款项与项目归属）
func (s *PaymentService) UpdateForUser(userID, id int64, input dto.PaymentRequest) (*models.Payment, error) {
	payment, err := s.paymentRepo.FindByIDForUser(id, userID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, pkgerrors.ErrPaymentNotFound
		}
		return nil, pkgerrors.Wrap(err, "查询款项失败")
	}
	if _, err := s.projectRepo.FindByIDForUser(payment.ProjectID, userID); err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, pkgerrors.ErrProjectNotFound
		}
		return nil, pkgerrors.Wrap(err, "查询项目失败")
	}
	return s.applyUpdate(payment, input)
}

// applyUpdate applies validated edits against the locked current payment and updates its project total.
func (s *PaymentService) applyUpdate(payment *models.Payment, input dto.PaymentRequest) (*models.Payment, error) {
	if err := validatePositiveAmount(input.Amount); err != nil {
		return nil, err
	}
	if input.ProjectID != 0 && input.ProjectID != payment.ProjectID {
		return nil, pkgerrors.WrapWithCode(errors.New("不允许修改款项所属项目"), 400, "不允许修改款项所属项目")
	}
	actualDate, err := receiptActualDate(input.ActualDate)
	if err != nil {
		return nil, err
	}
	var planDate *time.Time
	if input.PlanDate != "" {
		parsed, err := time.ParseInLocation("2006-01-02", input.PlanDate, time.Local)
		if err != nil {
			return nil, pkgerrors.WrapWithCode(err, 400, "计划日期格式错误")
		}
		planDate = &parsed
	}

	// 在事务中完成规则处理 + 保存 + 项目金额同步
	err = database.GetDB().Transaction(func(tx *gorm.DB) error {
		if _, err := lockPaymentProjectInTx(tx, payment.ProjectID, payment.UserID); err != nil {
			return err
		}
		// Read the current actual date after acquiring the common project lock.
		var current models.Payment
		if err := tx.Clauses(clause.Locking{Strength: paymentLockStrength}).Where("id = ? AND user_id = ?", payment.ID, payment.UserID).First(&current).Error; err != nil {
			return err
		}
		preserveUnknownActualDate := shouldKeepUnknownActualDate(current, actualDate)
		applyPaymentEdits(&current, input, planDate, actualDate)
		*payment = current
		// 重新应用业务规则（如重新计算百分比，因为金额可能变了）
		if err := s.processPaymentRulesInTx(tx, payment); err != nil {
			return err
		}
		// A known receipt with an unknown historical date must not be assigned a
		// planned date merely because its amount or note is edited.
		if preserveUnknownActualDate && payment.Status == constants.PaymentStatusConfirmed {
			payment.ActualDate = nil
		}
		if err := tx.Save(payment).Error; err != nil {
			return err
		}
		// 级联更新: 数据变更后，必须重新同步项目的总收款状态
		return s.syncProjectReceivedAmountInTx(tx, payment.ProjectID)
	})
	if err != nil {
		return nil, err
	}

	// 事务提交后清除该用户的 Dashboard 统计缓存
	invalidateDashboardCache(payment.UserID)
	return payment, nil
}

func shouldKeepUnknownActualDate(payment models.Payment, incomingDate *time.Time) bool {
	return payment.ActualDate == nil && incomingDate == nil &&
		(payment.Status == constants.PaymentStatusConfirmed || payment.Status == "paid")
}

func applyPaymentEdits(current *models.Payment, input dto.PaymentRequest, planDate, actualDate *time.Time) {
	current.Amount = input.Amount
	if planDate != nil {
		current.PlanDate = *planDate
	}
	if actualDate != nil {
		current.ActualDate = actualDate
	}
	if strings.TrimSpace(input.Stage) != "" {
		current.Stage = input.Stage
	} else if strings.TrimSpace(current.Stage) == "" {
		if actualDate != nil {
			current.Stage = paymentStageReceipt
		} else {
			current.Stage = paymentStageAll
		}
	}
	if input.Status != "" {
		current.Status = input.Status
	}
	current.Method, current.Remark = input.Method, input.Remark
}

func receiptActualDate(value string) (*time.Time, error) {
	if value == "" {
		return nil, nil
	}
	date, err := time.ParseInLocation("2006-01-02", value, time.Local)
	if err != nil {
		return nil, pkgerrors.WrapWithCode(err, 400, "实际日期格式错误")
	}
	return &date, nil
}

// processPaymentRulesInTx 执行通用款项业务规则处理（事务内版本）
// 包含以下逻辑:
//  1. 状态与日期的联动: 状态为"已确认"时自动填充ActualDate(实际收款日)，否则置空。
//  2. 百分比自动计算: 根据款项金额与项目合同总额，自动计算该笔款项的占比。
func (s *PaymentService) processPaymentRulesInTx(tx *gorm.DB, payment *models.Payment) error {
	// 0. 状态归一：历史版本前端/外部客户端曾用 "paid" 表示已收款，
	// 统一归一为 constants.PaymentStatusConfirmed，避免统计口径分裂
	if payment.Status == "paid" {
		payment.Status = constants.PaymentStatusConfirmed
	}

	// 1. 处理实际收款日期逻辑
	if payment.Status == constants.PaymentStatusConfirmed && payment.ActualDate == nil {
		// 如果标记为已收款但用户未填实际日期，默认等于计划日期
		payment.ActualDate = &payment.PlanDate
	}
	// 如果不是已收款状态，清除实际收款日期
	if payment.Status != constants.PaymentStatusConfirmed {
		payment.ActualDate = nil
	}

	// 2. 自动计算百分比（在同一事务内读取项目总额，避免脏读）
	var project models.Project
	if err := tx.First(&project, payment.ProjectID).Error; err != nil {
		return err
	}

	if project.TotalAmount > 0 {
		payment.Percentage = (payment.Amount / project.TotalAmount) * 100
	} else {
		payment.Percentage = 0
	}

	return nil
}

// amountEpsilon 金额比较容差
// 由于金额当前以 float64 存储，直接用 != 比较会因浮点累加误差产生误判，
// 统一以该容差判断"金额是否发生实质变化"。
const amountEpsilon = 0.005

func validatePositiveAmount(amount float64) error {
	if amount <= 0 || math.IsNaN(amount) || math.IsInf(amount, 0) {
		return pkgerrors.WrapWithCode(errors.New("金额必须为正数"), 400, "金额必须为正数")
	}
	return nil
}

// All writers acquire the parent before touching payments so an aggregate cannot race another writer.
func lockPaymentProjectInTx(tx *gorm.DB, projectID, userID int64) (*models.Project, error) {
	var project models.Project
	if err := tx.Clauses(clause.Locking{Strength: paymentLockStrength}).Where("id = ? AND user_id = ?", projectID, userID).First(&project).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, pkgerrors.ErrProjectNotFound
		}
		return nil, pkgerrors.Wrap(err, "锁定项目失败")
	}
	return &project, nil
}

// syncProjectReceivedAmountInTx 重新计算并同步项目的"已收款总额"（事务内版本）
// 此方法应在任何款项金额或状态发生变化后被调用，以确保 Project 表数据的一致性。
// 全程在同一事务 tx 内读改写，避免读后写竞态导致的 lost update。
func (s *PaymentService) syncProjectReceivedAmountInTx(tx *gorm.DB, projectID int64) error {
	var project models.Project
	if err := tx.First(&project, projectID).Error; err != nil {
		return err
	}

	// 聚合计算所有已收款项的总额
	var totalReceived float64
	if err := tx.Model(&models.Payment{}).
		Where("project_id = ? AND user_id = ? AND status = ?", projectID, project.UserID, constants.PaymentStatusConfirmed).
		Select("COALESCE(SUM(amount), 0)").
		Scan(&totalReceived).Error; err != nil {
		return err
	}

	// 仅在金额确实变化时执行更新（带容差，规避浮点误判）
	if math.Abs(project.ReceivedAmount-totalReceived) > amountEpsilon {
		if err := tx.Model(&models.Project{}).
			Where("id = ?", projectID).
			Update("received_amount", totalReceived).Error; err != nil {
			return err
		}
	}

	return nil
}

// DeleteForUser 删除收款（校验归属，同步更新项目已收款金额）
func (s *PaymentService) DeleteForUser(userID, id int64) error {
	payment, err := s.paymentRepo.FindByIDForUser(id, userID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return pkgerrors.ErrPaymentNotFound
		}
		return pkgerrors.Wrap(err, "查询款项失败")
	}
	projectID := payment.ProjectID

	err = database.GetDB().Transaction(func(tx *gorm.DB) error {
		if _, err := lockPaymentProjectInTx(tx, projectID, userID); err != nil {
			return err
		}
		if err := tx.Where("id = ? AND user_id = ?", id, userID).Delete(&models.Payment{}).Error; err != nil {
			return pkgerrors.Wrap(err, "删除款项失败")
		}
		return s.syncProjectReceivedAmountInTx(tx, projectID)
	})
	if err != nil {
		return err
	}

	// 事务提交后清除该用户的 Dashboard 统计缓存
	invalidateDashboardCache(userID)
	return nil
}

// ConfirmForUser 确认收款（One-Click 操作，校验归属）
// 将款项标记为已确认，并自动更新实际收款日期和方式。通过数据库事务保证原子性:
// 悲观锁锁定款项 → 幂等性检查 → 更新状态 → 重算项目已收款总额。
func (s *PaymentService) ConfirmForUser(userID, id int64, actualDate, method string) error {
	loc := time.Local
	actualAt, err := time.ParseInLocation("2006-01-02", actualDate, loc)
	if err != nil {
		return pkgerrors.WrapWithCode(err, 400, "实际日期格式错误")
	}
	// This read is outside the transaction. A pre-lock snapshot would be stale under MySQL repeatable-read.
	ownedPayment, err := s.paymentRepo.FindByIDForUser(id, userID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return pkgerrors.ErrPaymentNotFound
		}
		return pkgerrors.Wrap(err, "查询款项失败")
	}

	err = database.GetDB().Transaction(func(tx *gorm.DB) error {
		if _, err := lockPaymentProjectInTx(tx, ownedPayment.ProjectID, userID); err != nil {
			return err
		}
		var payment models.Payment
		if err := tx.Clauses(clause.Locking{Strength: paymentLockStrength}).Where("id = ? AND user_id = ?", id, userID).First(&payment).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				return pkgerrors.ErrPaymentNotFound
			}
			return pkgerrors.Wrap(err, "查询款项失败")
		}

		if payment.Status == constants.PaymentStatusConfirmed {
			return nil
		}

		if err := tx.Model(&payment).Updates(map[string]interface{}{
			columnStatus:  constants.PaymentStatusConfirmed,
			"actual_date": actualAt,
			"method":      method,
		}).Error; err != nil {
			return pkgerrors.Wrap(err, "更新款项状态失败")
		}

		return s.syncProjectReceivedAmountInTx(tx, payment.ProjectID)
	})

	// 事务成功后清除 Dashboard 缓存
	if err == nil {
		invalidateDashboardCache(userID)
	}

	return err
}
