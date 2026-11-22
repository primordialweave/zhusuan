package repository

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"gorm.io/gorm"

	"github.com/primordialweave/zhusuan/internal/models"
)

func receiptContractScopeFixture(t *testing.T) *ReceiptRepository {
	t.Helper()
	repo, _ := receiptRepositoryFixture(t)
	date := func(value string) *time.Time {
		parsed, err := time.Parse(time.RFC3339, value)
		require.NoError(t, err)
		return &parsed
	}
	for id, value := range map[int64]string{
		1: "2026-11-01T00:00:00+14:00",
		2: "2026-11-30T23:59:59-12:00",
		3: "2026-10-31T23:59:59+14:00",
		4: "2026-11-01T00:00:00Z",
	} {
		require.NoError(t, repo.db.Model(&models.Project{}).Where("id = ?", id).UpdateColumn("contract_date", date(value)).Error)
	}
	projects := []models.Project{
		{ID: 5, UserID: 1, Name: "in-period without receipts", Company: "test", Type: "test", ContractNumber: "D", TotalAmount: 2000, Status: "active", ContractDate: date("2026-11-10T00:00:00Z")},
		{ID: 6, UserID: 1, Name: "following-period contract", Company: "test", Type: "test", ContractNumber: "E", TotalAmount: 3000, Status: "active", ContractDate: date("2026-12-01T00:00:00-12:00")},
		{ID: 7, UserID: 1, Name: "prior-period contract", Company: "test", Type: "test", ContractNumber: "F", TotalAmount: 4000, Status: "active", ContractDate: date("2026-10-31T23:59:59-12:00")},
	}
	require.NoError(t, repo.db.Create(&projects).Error)
	payments := []models.Payment{
		{UserID: 1, ProjectID: 6, Stage: "receipt", Amount: 400, Status: "confirmed", ActualDate: date("2026-11-05T00:00:00+14:00")},
		{UserID: 1, ProjectID: 7, Stage: "receipt", Amount: 250, Status: "confirmed", ActualDate: date("2026-11-06T00:00:00-12:00")},
		{UserID: 1, ProjectID: 3, Stage: "receipt", Amount: 30, Status: "confirmed", ActualDate: date("2024-02-29T23:59:59-12:00")},
	}
	require.NoError(t, repo.db.Create(&payments).Error)
	return repo
}

func TestReceiptOverviewScopesContractBalancesBySigningDate(t *testing.T) {
	repo := receiptContractScopeFixture(t)
	overview, err := repo.Overview(1, "2026-11-01", "2026-11-30")
	require.NoError(t, err)
	// Contracts at both calendar boundaries and a contract without any receipt
	// are included. All receipts of these contracts count, regardless of their date.
	require.Equal(t, 4000.0, overview.ContractTotal)
	require.Equal(t, 2200.0, overview.ReceivedTotal)
	require.Equal(t, 1700.0, overview.ContractReceived)
	require.Equal(t, 2300.0, overview.OutstandingTotal)
	require.Equal(t, 500.0, overview.OverpaidTotal)
	require.Equal(t, overview.ContractTotal, overview.ContractReceived+overview.OutstandingTotal)
	// Cash in the period includes receipts for contracts signed outside it.
	require.Equal(t, 1250.0, overview.PeriodReceived)
	require.Equal(t, int64(3), overview.PeriodCount)
	trend, err := repo.ReceiptTrend(1, "2026-11-01", "2026-11-30", "day")
	require.NoError(t, err)
	require.Equal(t, map[string]float64{"2026-11-05": 400, "2026-11-06": 250, "2026-11-22": 600}, trend)
	other, err := repo.Overview(2, "2026-11-01", "2026-11-30")
	require.NoError(t, err)
	require.Equal(t, 1000.0, other.ContractTotal)
	require.Equal(t, 2000.0, other.ReceivedTotal)
	require.Equal(t, 2000.0, other.PeriodReceived)
	require.Equal(t, int64(1), other.PeriodCount)
}

func TestReceiptOverviewCashWithoutContractsSignedInPeriod(t *testing.T) {
	repo := receiptContractScopeFixture(t)
	overview, err := repo.Overview(1, "2024-02-01", "2024-02-29")
	require.NoError(t, err)
	require.Zero(t, overview.ContractTotal)
	require.Zero(t, overview.ReceivedTotal)
	require.Zero(t, overview.ContractReceived)
	require.Zero(t, overview.OutstandingTotal)
	require.Zero(t, overview.OverpaidTotal)
	require.Equal(t, 30.0, overview.PeriodReceived)
	require.Equal(t, int64(1), overview.PeriodCount)
	trend, err := repo.ReceiptTrend(1, "2024-02-01", "2024-02-29", "day")
	require.NoError(t, err)
	require.Equal(t, map[string]float64{"2024-02-29": 30}, trend)
}

func TestReceiptOverviewAllKeepsUndatedContractsAndReceipts(t *testing.T) {
	repo := receiptContractScopeFixture(t)
	require.NoError(t, repo.db.Model(&models.Project{}).Where("id = ?", 5).UpdateColumn("contract_date", nil).Error)
	overview, err := repo.OverviewTotals(1)
	require.NoError(t, err)
	require.Equal(t, 13000.0, overview.ContractTotal)
	require.Equal(t, 2880.0, overview.ReceivedTotal)
	require.Equal(t, 2380.0, overview.ContractReceived)
	require.Equal(t, 10620.0, overview.OutstandingTotal)
	require.Equal(t, 500.0, overview.OverpaidTotal)
	require.Equal(t, overview.ReceivedTotal, overview.PeriodReceived)
	require.Equal(t, int64(6), overview.PeriodCount)
}

func TestReceiptOverviewContractScopeUsesOneAggregateQuery(t *testing.T) {
	repo := receiptContractScopeFixture(t)
	queries := 0
	callback := "test:receipt-contract-scope-query"
	require.NoError(t, repo.db.Callback().Row().After("gorm:row").Register(callback, func(_ *gorm.DB) { queries++ }))
	t.Cleanup(func() { require.NoError(t, repo.db.Callback().Row().Remove(callback)) })
	_, err := repo.Overview(1, "2026-11-01", "2026-11-30")
	require.NoError(t, err)
	require.Equal(t, 1, queries)
}
