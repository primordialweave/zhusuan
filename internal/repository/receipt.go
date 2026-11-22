package repository

import (
	"database/sql"
	"fmt"

	"gorm.io/gorm"

	"github.com/primordialweave/zhusuan/internal/constants"
	"github.com/primordialweave/zhusuan/internal/database"
	"github.com/primordialweave/zhusuan/internal/dto"
	"github.com/primordialweave/zhusuan/internal/models"
)

const (
	receiptIntervalDay   = "day"
	receiptIntervalMonth = "month"
)

// ReceiptRepository reads actual receipts and contract balances using aggregates.
type ReceiptRepository struct {
	db *gorm.DB
}

// NewReceiptRepository creates the repository using the application database.
func NewReceiptRepository() *ReceiptRepository {
	return &ReceiptRepository{db: database.GetDB()}
}

// OverviewTotals clamps each contract separately so overpayment on one project
// cannot hide an unpaid balance on another project. Unknown actual dates still
// contribute to lifetime receipts when the payment is confirmed.
func (r *ReceiptRepository) OverviewTotals(userID int64) (*dto.ReceiptOverview, error) {
	return r.Overview(userID, "", "")
}

// Overview returns current balances of contracts signed in the range and cash
// received in the range, including cash for contracts signed outside it.
// Empty dates include all contracts. One statement keeps both aggregates consistent.
func (r *ReceiptRepository) Overview(userID int64, startDate, endDate string) (*dto.ReceiptOverview, error) {
	projects := r.db.Model(&models.Project{}).Where("user_id = ?", userID)
	confirmed := r.db.Model(&models.Payment{}).
		Where("user_id = ? AND status = ?", userID, constants.PaymentStatusConfirmed).
		Group("project_id")
	if startDate == "" && endDate == "" {
		projects = projects.Select("id, total_amount, 1 AS contract_in_scope")
		confirmed = confirmed.Select("project_id, COALESCE(SUM(amount), 0) AS received, COALESCE(SUM(amount), 0) AS period_received, COUNT(*) AS period_count")
	} else {
		start, endExclusive, err := paymentRangeBounds(startDate, endDate)
		if err != nil {
			return nil, err
		}
		// Keep all owned projects in the outer aggregate: filtering them here
		// would incorrectly remove cash from contracts signed in other periods.
		projects = projects.Select(`id, total_amount,
CASE WHEN contract_date >= ? AND contract_date < ? THEN 1 ELSE 0 END AS contract_in_scope`, start, endExclusive)
		confirmed = confirmed.Select(`project_id, COALESCE(SUM(amount), 0) AS received,
SUM(CASE WHEN actual_date >= ? AND actual_date < ? THEN amount ELSE 0 END) AS period_received,
SUM(CASE WHEN actual_date >= ? AND actual_date < ? THEN 1 ELSE 0 END) AS period_count`, start, endExclusive, start, endExclusive)
	}
	var totals dto.ReceiptOverview
	err := r.db.Table("(?) AS projects", projects).
		Joins("LEFT JOIN (?) AS receipts ON receipts.project_id = projects.id", confirmed).
		Select(`COALESCE(SUM(CASE WHEN projects.contract_in_scope = 1 THEN projects.total_amount ELSE 0 END), 0) AS contract_total,
COALESCE(SUM(CASE WHEN projects.contract_in_scope = 1 THEN COALESCE(receipts.received, 0) ELSE 0 END), 0) AS received_total,
COALESCE(SUM(CASE
  WHEN projects.contract_in_scope = 0 THEN 0
  WHEN COALESCE(receipts.received, 0) <= 0 OR projects.total_amount <= 0 THEN 0
  WHEN COALESCE(receipts.received, 0) < projects.total_amount THEN COALESCE(receipts.received, 0)
  ELSE projects.total_amount END), 0) AS contract_received,
COALESCE(SUM(CASE WHEN projects.contract_in_scope = 1 AND projects.total_amount - COALESCE(receipts.received, 0) > 0
  THEN projects.total_amount - COALESCE(receipts.received, 0) ELSE 0 END), 0) AS outstanding_total,
COALESCE(SUM(CASE WHEN projects.contract_in_scope = 1 AND COALESCE(receipts.received, 0) - projects.total_amount > 0
  THEN COALESCE(receipts.received, 0) - projects.total_amount ELSE 0 END), 0) AS overpaid_total,
COALESCE(SUM(COALESCE(receipts.period_received, 0)), 0) AS period_received,
COALESCE(SUM(COALESCE(receipts.period_count, 0)), 0) AS period_count`).
		Scan(&totals).Error
	return &totals, err
}

func (r *ReceiptRepository) confirmedReceipts(userID int64) *gorm.DB {
	// Check ownership on both tables; inconsistent imported relationships must
	// never make receipts from another account appear in these totals.
	return r.db.Model(&models.Payment{}).
		Joins("JOIN projects ON projects.id = payments.project_id AND projects.user_id = payments.user_id").
		Where("payments.user_id = ? AND payments.status = ?", userID, constants.PaymentStatusConfirmed)
}

// PeriodReceipts returns confirmed cash received in an inclusive calendar range.
// Empty dates request all confirmed receipts, including historical undated ones.
func (r *ReceiptRepository) PeriodReceipts(userID int64, startDate, endDate string) (float64, int64, error) {
	query := r.confirmedReceipts(userID)
	if startDate != "" || endDate != "" {
		start, endExclusive, err := paymentRangeBounds(startDate, endDate)
		if err != nil {
			return 0, 0, err
		}
		query = query.Where("payments.actual_date >= ? AND payments.actual_date < ?", start, endExclusive)
	}
	var result struct {
		Amount float64
		Count  int64
	}
	err := query.Select("COALESCE(SUM(payments.amount), 0) AS amount, COUNT(*) AS count").Scan(&result).Error
	return result.Amount, result.Count, err
}

// ReceiptTrend groups confirmed, dated cash receipts by day or month.
func (r *ReceiptRepository) ReceiptTrend(userID int64, startDate, endDate, interval string) (map[string]float64, error) {
	if interval != receiptIntervalDay && interval != receiptIntervalMonth {
		return nil, fmt.Errorf("invalid receipt trend interval")
	}
	start, endExclusive, err := paymentRangeBounds(startDate, endDate)
	if err != nil {
		return nil, err
	}
	dateExpr := getDateFormatExpr("payments.actual_date", interval, database.GetDBType())
	var results []struct {
		Date   string
		Amount float64
	}
	if err := r.confirmedReceipts(userID).
		Select(dateExpr+" AS date, COALESCE(SUM(payments.amount), 0) AS amount").
		Where("payments.actual_date >= ? AND payments.actual_date < ?", start, endExclusive).
		Group("date").Scan(&results).Error; err != nil {
		return nil, err
	}
	values := make(map[string]float64, len(results))
	for _, row := range results {
		values[row.Date] = row.Amount
	}
	return values, nil
}

// ReceiptDateBounds finds the first and last known receipt calendar dates.
func (r *ReceiptRepository) ReceiptDateBounds(userID int64) (string, string, error) {
	dateExpr := getDateFormatExpr("payments.actual_date", receiptIntervalDay, database.GetDBType())
	var result struct {
		StartDate sql.NullString
		EndDate   sql.NullString
	}
	err := r.confirmedReceipts(userID).
		Where("payments.actual_date IS NOT NULL").
		Select("MIN(" + dateExpr + ") AS start_date, MAX(" + dateExpr + ") AS end_date").
		Scan(&result).Error
	return result.StartDate.String, result.EndDate.String, err
}

// ListByActualDate returns only confirmed receipts received within the selected calendar range.
func (r *ReceiptRepository) ListByActualDate(userID int64, startDate, endDate string) ([]models.Payment, error) {
	start, endExclusive, err := paymentRangeBounds(startDate, endDate)
	if err != nil {
		return nil, err
	}
	payments := []models.Payment{}
	err = r.confirmedReceipts(userID).Preload("Project").
		Where("payments.actual_date >= ? AND payments.actual_date < ?", start, endExclusive).
		Order("payments.actual_date ASC, payments.id ASC").Find(&payments).Error
	return payments, err
}
