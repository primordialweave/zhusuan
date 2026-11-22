package service

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"gorm.io/gorm"

	"github.com/primordialweave/zhusuan/internal/database"
	"github.com/primordialweave/zhusuan/internal/models"
	"github.com/primordialweave/zhusuan/internal/repository"
)

func TestReceiptOverviewCalendarAmountMatchesTrend(t *testing.T) {
	user := contractTestUser(t, 22101)
	project := insertContractProject(t, contractTestInput(user.ID))
	svc := NewPaymentService()
	_, err := svc.Create(receiptWriteInput(t, user.ID, project.ID, `{"amount":500,"actual_date":"2024-02-29","status":"confirmed"}`))
	require.NoError(t, err)
	_, err = svc.Create(receiptWriteInput(t, user.ID, project.ID, `{"amount":200,"actual_date":"2024-03-01","status":"confirmed"}`))
	require.NoError(t, err)
	_, err = svc.Create(receiptWriteInput(t, user.ID, project.ID, `{"amount":300,"plan_date":"2024-02-29","stage":"deposit","status":"pending"}`))
	require.NoError(t, err)
	dashboard := NewDashboardService()
	overview, err := dashboard.GetReceiptOverview(user.ID, "", 2024, 2)
	require.NoError(t, err)
	require.Equal(t, 1000.0, overview.ContractTotal)
	require.Equal(t, 700.0, overview.ReceivedTotal)
	require.Equal(t, 300.0, overview.OutstandingTotal)
	require.Equal(t, 500.0, overview.PeriodReceived)
	require.Equal(t, int64(1), overview.PeriodCount)
	require.Equal(t, "2024-02-01", overview.StartDate)
	require.Equal(t, "2024-02-29", overview.EndDate)
	trend, err := dashboard.GetReceiptTrend(user.ID, "", 2024, 2)
	require.NoError(t, err)
	require.Len(t, trend.Labels, 29)
	require.Equal(t, "02-29", trend.Labels[28])
	require.Equal(t, 500.0, trend.ActualValues[28])
	require.Empty(t, trend.ExpectedValues)
	require.Equal(t, overview.StartDate, trend.StartDate)
	require.Equal(t, overview.EndDate, trend.EndDate)
}

func TestReceiptOverviewUnknownActualDateIsLifetimeOnly(t *testing.T) {
	user := contractTestUser(t, 22102)
	project := insertContractProject(t, contractTestInput(user.ID))
	unknown := models.Payment{UserID: user.ID, ProjectID: project.ID, Amount: 600, Status: "confirmed", Stage: "all", PlanDate: time.Now()}
	require.NoError(t, database.GetDB().Create(&unknown).Error)
	dashboard := NewDashboardService()
	overview, err := dashboard.GetReceiptOverview(user.ID, "year", 0, 0)
	require.NoError(t, err)
	require.Equal(t, 600.0, overview.ReceivedTotal)
	require.Equal(t, 400.0, overview.OutstandingTotal)
	require.Zero(t, overview.PeriodReceived)
	require.Zero(t, overview.PeriodCount)
	all, err := dashboard.GetReceiptOverview(user.ID, "all", 0, 0)
	require.NoError(t, err)
	require.Equal(t, 600.0, all.PeriodReceived)
	require.Equal(t, int64(1), all.PeriodCount)
	require.Empty(t, all.StartDate)
	trend, err := dashboard.GetReceiptTrend(user.ID, "all", 0, 0)
	require.NoError(t, err)
	require.Empty(t, trend.Labels)
	require.Empty(t, trend.ActualValues)
	var unchanged models.Payment
	require.NoError(t, database.GetDB().First(&unchanged, unknown.ID).Error)
	require.Nil(t, unchanged.ActualDate)
}

func TestReceiptOverviewReflectsWritesWithoutStaleStatisticsCache(t *testing.T) {
	user := contractTestUser(t, 22103)
	project := insertContractProject(t, contractTestInput(user.ID))
	dashboard := NewDashboardService()
	before, err := dashboard.GetReceiptOverview(user.ID, "month", 0, 0)
	require.NoError(t, err)
	require.Equal(t, 1000.0, before.OutstandingTotal)
	input := receiptWriteInput(t, user.ID, project.ID, `{"amount":1500,"actual_date":"`+time.Now().Format("2006-01-02")+`","status":"confirmed"}`)
	receipt, err := NewPaymentService().Create(input)
	require.NoError(t, err)
	after, err := dashboard.GetReceiptOverview(user.ID, "month", 0, 0)
	require.NoError(t, err)
	require.Zero(t, after.OutstandingTotal)
	require.Equal(t, 500.0, after.OverpaidTotal)
	require.Equal(t, 1500.0, after.PeriodReceived)
	require.NoError(t, NewPaymentService().DeleteForUser(user.ID, receipt.ID))
	deleted, err := dashboard.GetReceiptOverview(user.ID, "month", 0, 0)
	require.NoError(t, err)
	require.Equal(t, before, deleted)
}

func TestReceiptOverviewUsesOneAggregateQuery(t *testing.T) {
	user := contractTestUser(t, 22104)
	insertContractProject(t, contractTestInput(user.ID))
	db := database.GetDB()
	queries := 0
	callback := "test:receipt-overview-queries"
	require.NoError(t, db.Callback().Row().After("gorm:row").Register(callback, func(_ *gorm.DB) { queries++ }))
	t.Cleanup(func() { require.NoError(t, db.Callback().Row().Remove(callback)) })
	_, err := repository.NewReceiptRepository().Overview(user.ID, "2026-01-01", "2026-12-31")
	require.NoError(t, err)
	require.Equal(t, 1, queries)
}
