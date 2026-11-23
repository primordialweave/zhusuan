package repository

import (
	"fmt"
	"strings"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"github.com/primordialweave/zhusuan/internal/constants"
	"github.com/primordialweave/zhusuan/internal/database"
	"github.com/primordialweave/zhusuan/internal/models"
)

// getDateFormatExpr 根据数据库类型返回日期格式化 SQL 表达式
// column: 日期列名
// interval: 分组间隔 ("day" 或 "month")
// dbType: 数据库类型 ("sqlite", "mysql", "postgres")
func getDateFormatExpr(column, interval, dbType string) string {
	switch dbType {
	case "mysql":
		if interval == receiptIntervalMonth {
			return fmt.Sprintf("DATE_FORMAT(%s, '%%Y-%%m')", column)
		}
		return fmt.Sprintf("DATE_FORMAT(%s, '%%Y-%%m-%%d')", column)
	case "postgres":
		if interval == receiptIntervalMonth {
			return fmt.Sprintf("TO_CHAR(%s, 'YYYY-MM')", column)
		}
		return fmt.Sprintf("TO_CHAR(%s, 'YYYY-MM-DD')", column)
	default: // sqlite
		// SQLite's date functions convert offset-bearing timestamps to UTC.
		// These fields represent calendar dates; keep the stored date component.
		if interval == receiptIntervalMonth {
			return fmt.Sprintf("substr(%s, 1, 7)", column)
		}
		return fmt.Sprintf("substr(%s, 1, 10)", column)
	}
}

// getDateDiffExpr 根据数据库类型返回日期差值 SQL 表达式 (返回天数)
// date1, date2: 日期列名或值
// dbType: 数据库类型
func getDateDiffExpr(date1, date2, dbType string) string {
	switch dbType {
	case "mysql":
		return fmt.Sprintf("DATEDIFF(%s, %s)", date1, date2)
	case "postgres":
		return fmt.Sprintf("(%s::date - %s::date)", date1, date2)
	default: // sqlite
		return fmt.Sprintf("(julianday(substr(%s, 1, 10)) - julianday(substr(%s, 1, 10)))", date1, date2)
	}
}

// PaymentRepository 收款数据仓库
type PaymentRepository struct {
	db *gorm.DB
}

// NewPaymentRepository 创建收款仓库
func NewPaymentRepository() *PaymentRepository {
	return &PaymentRepository{db: database.GetDB()}
}

// paymentOwnerScope excludes orphaned or mismatched imported relationships before
// exposing associated project data or including the payment in money totals.
func paymentOwnerScope(userID int64) func(*gorm.DB) *gorm.DB {
	return func(db *gorm.DB) *gorm.DB {
		return UserScope(userID)(db).Where("EXISTS (SELECT 1 FROM projects WHERE projects.id = payments.project_id AND projects.user_id = payments.user_id)")
	}
}

// FindByID 根据ID查找收款
func (r *PaymentRepository) FindByID(id int64) (*models.Payment, error) {
	var payment models.Payment
	if err := r.db.First(&payment, id).Error; err != nil {
		return nil, err
	}
	return &payment, nil
}

// FindByIDForUser finds a payment owned by the given user.
func (r *PaymentRepository) FindByIDForUser(id, userID int64) (*models.Payment, error) {
	var payment models.Payment
	if err := r.db.Scopes(paymentOwnerScope(userID)).Where("id = ?", id).First(&payment).Error; err != nil {
		return nil, err
	}
	return &payment, nil
}

// ListByProject 根据项目ID获取收款列表
func (r *PaymentRepository) ListByProject(projectID int64) ([]models.Payment, error) {
	var payments []models.Payment
	if err := r.db.Scopes(paymentOwnerScope(0)).Where("project_id = ?", projectID).
		Order("plan_date DESC").
		Find(&payments).Error; err != nil {
		return nil, err
	}
	return payments, nil
}

// ListUpcoming 获取指定天数内即将到期待收款项
func (r *PaymentRepository) ListUpcoming(userID int64, days int, limit int) ([]models.Payment, error) {
	var payments []models.Payment
	now := time.Now()
	today := now.Format("2006-01-02")
	endDate := now.AddDate(0, 0, days).Format("2006-01-02") + " 23:59:59"

	query := r.db.Scopes(paymentOwnerScope(userID)).Preload("Project").
		Where("status = ? AND plan_date >= ? AND plan_date <= ?", "pending", today, endDate).
		Order("plan_date ASC")
	if limit > 0 {
		query = query.Limit(limit)
	}

	if err := query.Find(&payments).Error; err != nil {
		return nil, err
	}
	return payments, nil
}

// SumOverdue 统计逾期金额
func (r *PaymentRepository) SumOverdue(userID int64) (float64, error) {
	var sum float64
	today := time.Now().Format("2006-01-02")
	err := r.db.Model(&models.Payment{}).
		Scopes(paymentOwnerScope(userID)).
		Where("(status = ? OR (status = ? AND plan_date < ?))", constants.PaymentStatusOverdue, constants.PaymentStatusPending, today).
		Select("COALESCE(SUM(amount), 0)").Scan(&sum).Error
	return sum, err
}

// CountOverdueAndUpcoming 统计逾期笔数与未来 upcomingDays 天内待收笔数，用于桌面菜单栏/托盘轻量化摘要。
func (r *PaymentRepository) CountOverdueAndUpcoming(userID int64, upcomingDays int) (overdueCount int, upcomingCount int, err error) {
	now := time.Now()
	today := now.Format("2006-01-02")
	endDate := now.AddDate(0, 0, upcomingDays).Format("2006-01-02") + " 23:59:59"

	var overdue int64
	if err = r.db.Model(&models.Payment{}).
		Scopes(paymentOwnerScope(userID)).
		Where("(status = ? OR (status = ? AND plan_date < ?))", constants.PaymentStatusOverdue, constants.PaymentStatusPending, today).
		Count(&overdue).Error; err != nil {
		return 0, 0, err
	}

	var upcoming int64
	if err = r.db.Model(&models.Payment{}).
		Scopes(paymentOwnerScope(userID)).
		Where("status = ? AND plan_date >= ? AND plan_date <= ?", constants.PaymentStatusPending, today, endDate).
		Count(&upcoming).Error; err != nil {
		return 0, 0, err
	}

	return int(overdue), int(upcoming), nil
}

// ListUrgent 查询逾期及未来 days 天内待收款项，按计划日期升序返回最多 limit 笔（用于菜单栏速览）。
func (r *PaymentRepository) ListUrgent(userID int64, days int, limit int) ([]models.Payment, error) {
	var payments []models.Payment
	now := time.Now()
	today := now.Format("2006-01-02")
	endDate := now.AddDate(0, 0, days).Format("2006-01-02") + " 23:59:59"

	query := r.db.Scopes(paymentOwnerScope(userID)).Preload("Project").
		Where(
			"(status = ? OR (status = ? AND plan_date <= ?))",
			constants.PaymentStatusOverdue,
			constants.PaymentStatusPending,
			endDate,
		).
		Order(clause.Expr{
			SQL:  "CASE WHEN status = ? OR plan_date < ? THEN 0 ELSE 1 END ASC, plan_date ASC",
			Vars: []any{constants.PaymentStatusOverdue, today},
		})
	if limit > 0 {
		query = query.Limit(limit)
	}
	if err := query.Find(&payments).Error; err != nil {
		return nil, err
	}
	return payments, nil
}

// ListByDateRange 根据日期范围获取收款列表
func (r *PaymentRepository) ListByDateRange(userID int64, startDate, endDate string) ([]models.Payment, error) {
	startDate, endExclusive, err := paymentRangeBounds(startDate, endDate)
	if err != nil {
		return nil, err
	}
	var payments []models.Payment
	if err := r.db.Scopes(paymentOwnerScope(userID)).Preload("Project").
		Where("plan_date >= ? AND plan_date < ?", startDate, endExclusive).
		Order("plan_date ASC").
		Find(&payments).Error; err != nil {
		return nil, err
	}
	return payments, nil
}

// GetIncomeStats 获取收入对比统计 (预期 vs 实际)
// 分组聚合查询，支持按日或按月统计。
// 返回:
//   - expected: map[日期]计划收款金额
//   - actual: map[日期]实际已收款金额
func (r *PaymentRepository) GetIncomeStats(userID int64, startDate, endDate, interval string) (map[string]float64, map[string]float64, error) {
	startDate, endExclusive, err := paymentRangeBounds(startDate, endDate)
	if err != nil {
		return nil, nil, err
	}
	expected := make(map[string]float64)
	actual := make(map[string]float64)

	// 根据数据库类型选择日期格式化表达式
	dbType := database.GetDBType()
	dateExpr := getDateFormatExpr("plan_date", interval, dbType)
	actualDateExpr := getDateFormatExpr("actual_date", interval, dbType)

	type Result struct {
		Date  string
		Total float64
	}

	// 1. 预期收入: 依据 plan_date 统计所有款项
	var expectedResults []Result
	if err := r.db.Model(&models.Payment{}).
		Select(dateExpr+" as date, COALESCE(SUM(amount), 0) as total").
		Scopes(paymentOwnerScope(userID)).
		Where("plan_date >= ? AND plan_date < ?", startDate, endExclusive).
		Group("date").
		Scan(&expectedResults).Error; err != nil {
		return nil, nil, err
	}
	for _, res := range expectedResults {
		expected[res.Date] = res.Total
	}

	// 2. 实际收入: 依据 actual_date 统计已完成(paid)的款项
	var actualResults []Result
	if err := r.db.Model(&models.Payment{}).
		Select(actualDateExpr+" as date, COALESCE(SUM(amount), 0) as total").
		Scopes(paymentOwnerScope(userID)).
		Where("status = ? AND actual_date >= ? AND actual_date < ?", constants.PaymentStatusConfirmed, startDate, endExclusive).
		Group("date").
		Scan(&actualResults).Error; err != nil {
		return nil, nil, err
	}
	for _, res := range actualResults {
		actual[res.Date] = res.Total
	}

	return expected, actual, nil
}

// SumConfirmedByPlanPeriod totals the confirmed payments planned in a calendar range.
// Actual receipt dates may be before/after the range or absent on historical confirmations.
func (r *PaymentRepository) SumConfirmedByPlanPeriod(userID int64, startDate, endDate string) (float64, error) {
	startDate, endExclusive, err := paymentRangeBounds(startDate, endDate)
	if err != nil {
		return 0, err
	}
	var total float64
	err = r.db.Model(&models.Payment{}).
		Scopes(paymentOwnerScope(userID)).
		Where("status = ? AND plan_date >= ? AND plan_date < ?", constants.PaymentStatusConfirmed, startDate, endExclusive).
		Select("COALESCE(SUM(amount), 0)").Scan(&total).Error
	return total, err
}

// GetStatsByPeriod 获取指定时间周期内的综合指标
// 返回值:
//   - totalExpected: 计划在此期间应收总额
//   - paid: 实际在此期间收到的金额
//   - pending: 计划在此期间但尚未收到的金额 (包含逾期)
//   - overdue: 计划在此期间且已逾期的金额 (plan_date < today)
//   - avgPeriod: 平均回款周期 (天)
func (r *PaymentRepository) GetStatsByPeriod(userID int64, startDate, endDate string) (total, paid, pending, overdue, avgPeriod float64, err error) {
	startDate, endExclusive, rangeErr := paymentRangeBounds(startDate, endDate)
	if rangeErr != nil {
		err = rangeErr
		return
	}
	// 1. Total (TotalExpected): 计划日期在范围内的款项总和
	if err = r.db.Model(&models.Payment{}).
		Scopes(paymentOwnerScope(userID)).
		Where("plan_date >= ? AND plan_date < ?", startDate, endExclusive).
		Select("COALESCE(SUM(amount), 0)").Scan(&total).Error; err != nil {
		return
	}

	// 2. Paid: 实际日期在范围内已支付的款项
	if err = r.db.Model(&models.Payment{}).
		Scopes(paymentOwnerScope(userID)).
		Where("status = ? AND actual_date >= ? AND actual_date < ?", constants.PaymentStatusConfirmed, startDate, endExclusive).
		Select("COALESCE(SUM(amount), 0)").Scan(&paid).Error; err != nil {
		return
	}

	// 3. Pending: 计划日期在范围内，当前状态仍为 pending 的款项
	if err = r.db.Model(&models.Payment{}).
		Scopes(paymentOwnerScope(userID)).
		Where("status IN ? AND plan_date >= ? AND plan_date < ?", []string{constants.PaymentStatusPending, constants.PaymentStatusOverdue}, startDate, endExclusive).
		Select("COALESCE(SUM(amount), 0)").Scan(&pending).Error; err != nil {
		return
	}

	// 4. Overdue: 计划日期在范围内，且已逾期 (plan_date < today)
	//    这是 Pending 的子集
	today := time.Now().Format("2006-01-02")
	if err = r.db.Model(&models.Payment{}).
		Scopes(paymentOwnerScope(userID)).
		Where("plan_date >= ? AND plan_date < ? AND (status = ? OR (status = ? AND plan_date < ?))", startDate, endExclusive, constants.PaymentStatusOverdue, constants.PaymentStatusPending, today).
		Select("COALESCE(SUM(amount), 0)").Scan(&overdue).Error; err != nil {
		return
	}

	// 5. AvgPeriod: 平均回款周期 (Actual Date - Plan Date)
	//    仅统计在此期间实际到账的款项
	dbType := database.GetDBType()
	dateDiffExpr := getDateDiffExpr("actual_date", "plan_date", dbType)
	if err = r.db.Model(&models.Payment{}).
		Scopes(paymentOwnerScope(userID)).
		Where("status = ? AND actual_date >= ? AND actual_date < ?", constants.PaymentStatusConfirmed, startDate, endExclusive).
		Select("COALESCE(AVG(" + dateDiffExpr + "), 0)").Scan(&avgPeriod).Error; err != nil {
		return
	}

	return total, paid, pending, overdue, avgPeriod, nil
}

// paymentRangeBounds represents an inclusive calendar range as [first day, next day).
// Full-day endpoints from the statistics helpers use the same rule.
func paymentRangeBounds(startDate, endDate string) (string, string, error) {
	start, err := time.Parse("2006-01-02", startDate)
	if err != nil {
		return "", "", fmt.Errorf("开始日期格式错误")
	}
	end, err := time.Parse("2006-01-02", strings.TrimSuffix(endDate, " 23:59:59"))
	if err != nil {
		return "", "", fmt.Errorf("结束日期格式错误")
	}
	if start.After(end) {
		return "", "", fmt.Errorf("开始日期不能晚于结束日期")
	}
	return start.Format("2006-01-02"), end.AddDate(0, 0, 1).Format("2006-01-02"), nil
}
