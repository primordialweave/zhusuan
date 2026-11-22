package repository

import (
	"path/filepath"
	"testing"
	"time"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"github.com/primordialweave/zhusuan/internal/config"
	"github.com/primordialweave/zhusuan/internal/models"
)

func receiptRepositoryFixture(t *testing.T) (*ReceiptRepository, []models.Project) {
	t.Helper()
	previous := config.AppConfig
	config.AppConfig = &config.Config{DBType: "sqlite"}
	t.Cleanup(func() { config.AppConfig = previous })
	db, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "receipts.db")), &gorm.Config{Logger: logger.Discard})
	require.NoError(t, err)
	raw, err := db.DB()
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, raw.Close()) })
	require.NoError(t, db.AutoMigrate(&models.User{}, &models.Project{}, &models.Payment{}))
	users := []models.User{{ID: 1, Username: "receipt-one", Password: "test"}, {ID: 2, Username: "receipt-two", Password: "test"}}
	require.NoError(t, db.Create(&users).Error)
	projects := []models.Project{
		{ID: 1, UserID: 1, Name: "partial", Company: "test", Type: "test", ContractNumber: "A", TotalAmount: 1000, Status: "active"},
		{ID: 2, UserID: 1, Name: "overpaid", Company: "test", Type: "test", ContractNumber: "B", TotalAmount: 1000, Status: "completed"},
		{ID: 3, UserID: 1, Name: "no plan", Company: "test", Type: "test", ContractNumber: "C", TotalAmount: 2000, Status: "archived"},
		{ID: 4, UserID: 2, Name: "other user", Company: "test", Type: "test", ContractNumber: "A", TotalAmount: 1000, Status: "active"},
	}
	require.NoError(t, db.Create(&projects).Error)
	date := func(day string) time.Time {
		value, err := time.Parse("2006-01-02", day)
		require.NoError(t, err)
		return value
	}
	november, october := date("2026-11-22"), date("2026-10-10")
	payments := []models.Payment{
		{UserID: 1, ProjectID: 1, Stage: "all", Amount: 600, Status: "confirmed", PlanDate: date("2026-04-15"), ActualDate: &november},
		{UserID: 1, ProjectID: 1, Stage: "all", Amount: 100, Status: "confirmed", PlanDate: november},
		{UserID: 1, ProjectID: 1, Stage: "all", Amount: 300, Status: "pending", PlanDate: november},
		{UserID: 1, ProjectID: 2, Stage: "all", Amount: 1500, Status: "confirmed", PlanDate: november, ActualDate: &october},
		{UserID: 2, ProjectID: 4, Stage: "all", Amount: 2000, Status: "confirmed", PlanDate: november, ActualDate: &november},
		// Inconsistent imported ownership must not leak into either user's totals.
		{UserID: 2, ProjectID: 1, Stage: "all", Amount: 999, Status: "confirmed", PlanDate: november, ActualDate: &november},
		{UserID: 1, ProjectID: 4, Stage: "all", Amount: 888, Status: "confirmed", PlanDate: november, ActualDate: &november},
	}
	require.NoError(t, db.Create(&payments).Error)
	return &ReceiptRepository{db: db}, projects
}

func TestReceiptOverviewUsesContractsAndClampsEachProject(t *testing.T) {
	repo, _ := receiptRepositoryFixture(t)
	overview, err := repo.OverviewTotals(1)
	require.NoError(t, err)
	require.Equal(t, 4000.0, overview.ContractTotal)
	require.Equal(t, 2200.0, overview.ReceivedTotal)
	require.Equal(t, 1700.0, overview.ContractReceived)
	require.Equal(t, 2300.0, overview.OutstandingTotal)
	require.Equal(t, 500.0, overview.OverpaidTotal)
	require.Equal(t, overview.ContractTotal, overview.ContractReceived+overview.OutstandingTotal)
	require.NoError(t, repo.db.Model(&models.Project{}).Where("user_id = ?", 1).Update("status", "completed").Error)
	afterStatusChange, err := repo.OverviewTotals(1)
	require.NoError(t, err)
	require.Equal(t, overview, afterStatusChange)
	other, err := repo.OverviewTotals(2)
	require.NoError(t, err)
	require.Equal(t, 1000.0, other.ContractTotal)
	require.Equal(t, 2000.0, other.ReceivedTotal)
	require.Zero(t, other.OutstandingTotal)
}

func TestReceiptPeriodUsesActualDateAndDoesNotAssignUnknownDates(t *testing.T) {
	repo, _ := receiptRepositoryFixture(t)
	received, count, err := repo.PeriodReceipts(1, "2026-11-01", "2026-11-30")
	require.NoError(t, err)
	require.Equal(t, 600.0, received)
	require.Equal(t, int64(1), count)
	all, allCount, err := repo.PeriodReceipts(1, "", "")
	require.NoError(t, err)
	require.Equal(t, 2200.0, all)
	require.Equal(t, int64(3), allCount)
	trend, err := repo.ReceiptTrend(1, "2026-11-01", "2026-11-30", "day")
	require.NoError(t, err)
	require.Equal(t, map[string]float64{"2026-11-22": 600}, trend)
	start, end, err := repo.ReceiptDateBounds(1)
	require.NoError(t, err)
	require.Equal(t, "2026-10-10", start)
	require.Equal(t, "2026-11-22", end)
	listed, err := repo.ListByActualDate(1, "2026-11-01", "2026-11-30")
	require.NoError(t, err)
	require.Len(t, listed, 1)
	require.Equal(t, 600.0, listed[0].Amount)
	require.Equal(t, "confirmed", listed[0].Status)
	require.Equal(t, "2026-04-15", listed[0].PlanDate.Format("2006-01-02"))
	require.NotNil(t, listed[0].Project)
	require.Equal(t, "partial", listed[0].Project.Name)
}

func TestReceiptCalendarRangeIncludesWholeEndDay(t *testing.T) {
	repo, _ := receiptRepositoryFixture(t)
	date := func(day string) *time.Time {
		value, err := time.ParseInLocation("2006-01-02", day, time.FixedZone("calendar", 14*60*60))
		require.NoError(t, err)
		return &value
	}
	payments := []models.Payment{
		{UserID: 1, ProjectID: 3, Stage: "all", Amount: 10, Status: "confirmed", ActualDate: date("2024-02-01")},
		{UserID: 1, ProjectID: 3, Stage: "all", Amount: 20, Status: "confirmed", ActualDate: date("2024-02-29")},
		{UserID: 1, ProjectID: 3, Stage: "all", Amount: 40, Status: "confirmed", ActualDate: date("2024-03-01")},
	}
	require.NoError(t, repo.db.Create(&payments).Error)
	received, count, err := repo.PeriodReceipts(1, "2024-02-01", "2024-02-29")
	require.NoError(t, err)
	require.Equal(t, 30.0, received)
	require.Equal(t, int64(2), count)
	trend, err := repo.ReceiptTrend(1, "2024-01-01", "2024-12-31", "month")
	require.NoError(t, err)
	require.Equal(t, map[string]float64{"2024-02": 30, "2024-03": 40}, trend)
}

func TestReceiptOverviewEmptyUserDoesNotReturnOtherUsers(t *testing.T) {
	repo, _ := receiptRepositoryFixture(t)
	for _, userID := range []int64{0, 999} {
		totals, err := repo.OverviewTotals(userID)
		require.NoError(t, err)
		require.Zero(t, totals.ContractTotal)
		require.Zero(t, totals.ReceivedTotal)
		require.Zero(t, totals.OutstandingTotal)
	}
}
