package service

import (
	"encoding/json"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/primordialweave/zhusuan/internal/constants"
	"github.com/primordialweave/zhusuan/internal/database"
	"github.com/primordialweave/zhusuan/internal/dto"
	"github.com/primordialweave/zhusuan/internal/models"
	"github.com/primordialweave/zhusuan/internal/pkg/cache"
	"github.com/primordialweave/zhusuan/internal/pkg/utils"
)

func responsePlannedReceived(t *testing.T, stats *dto.Stats) float64 {
	t.Helper()
	data, err := json.Marshal(stats)
	require.NoError(t, err)
	var response map[string]float64
	require.NoError(t, json.Unmarshal(data, &response))
	require.Contains(t, response, "planned_received_amount", "the API must distinguish plan completion from cash received in the period")
	return response["planned_received_amount"]
}

func collectionDate(t *testing.T, date string) time.Time {
	t.Helper()
	value, err := time.Parse("2006-01-02", date)
	require.NoError(t, err)
	return value
}

func TestDashboardPlanCollectionIncludesReceiptsOutsideTheSelectedPeriod(t *testing.T) {
	setupDashboardTestDB(t)
	for index, scope := range []string{"week", "month", "quarter", "year", "calendar-month", "calendar-year", "all"} {
		t.Run(scope, func(t *testing.T) {
			userID := int64(994100 + index)
			db := database.GetDB()
			require.NoError(t, db.Where("user_id = ?", userID).Delete(&models.Payment{}).Error)
			require.NoError(t, db.Where("user_id = ?", userID).Delete(&models.Project{}).Error)
			var current utils.PeriodRange
			switch scope {
			case "calendar-month":
				current, _ = utils.GetCalendarRange(2026, 4)
			case "calendar-year", "all":
				current, _ = utils.GetCalendarRange(2026, 0)
			default:
				current = utils.GetPeriodRange(scope, 0)
			}
			inside := collectionDate(t, current.StartDate)
			before := inside.AddDate(0, 0, -1)
			project := models.Project{UserID: userID, Name: "collection period fixture", Company: "fixture", TotalAmount: 134200, StartDate: inside, EndDate: inside.AddDate(0, 1, 0)}
			require.NoError(t, db.Create(&project).Error)
			t.Cleanup(func() {
				require.NoError(t, db.Where("user_id IN ?", []int64{userID, userID + 100}).Delete(&models.Payment{}).Error)
				require.NoError(t, db.Delete(&project).Error)
				invalidateDashboardCache(userID)
			})
			payments := []models.Payment{
				{UserID: userID, ProjectID: project.ID, Stage: "received inside", Amount: 131200, Status: constants.PaymentStatusConfirmed, PlanDate: inside, ActualDate: &inside},
				{UserID: userID, ProjectID: project.ID, Stage: "received early", Amount: 3000, Status: constants.PaymentStatusConfirmed, PlanDate: inside, ActualDate: &before},
				{UserID: userID + 100, ProjectID: project.ID + 100000, Stage: "another user", Amount: 9999, Status: constants.PaymentStatusConfirmed, PlanDate: inside, ActualDate: &inside},
			}
			require.NoError(t, db.Create(&payments).Error)
			invalidateDashboardCache(userID)
			svc := NewDashboardService()
			var stats *dto.Stats
			var err error
			switch scope {
			case "calendar-month":
				stats, err = svc.GetStatsForCalendar(userID, 2026, 4)
			case "calendar-year":
				stats, err = svc.GetStatsForCalendar(userID, 2026, 0)
			default:
				stats, err = svc.GetStats(userID, scope)
			}
			require.NoError(t, err)
			require.Equal(t, 134200.0, stats.TotalAmount)
			require.Equal(t, 134200.0, responsePlannedReceived(t, stats))
			require.Zero(t, stats.PendingAmount)
			require.Zero(t, stats.OverdueAmount)
			if scope == "all" {
				require.Equal(t, 134200.0, stats.PaidAmount)
				return
			}
			require.Equal(t, 131200.0, stats.PaidAmount, "cash receipts continue to use the actual collection date")
		})
	}
}

func TestDashboardPlanCollectionExcludesOtherPeriodCashAndIncludesUndatedConfirmations(t *testing.T) {
	setupDashboardTestDB(t)
	const userID int64 = 994201
	db := database.GetDB()
	require.NoError(t, db.Where("user_id = ?", userID).Delete(&models.Payment{}).Error)
	t.Cleanup(func() {
		require.NoError(t, db.Where("user_id IN ?", []int64{userID, userID + 1}).Delete(&models.Payment{}).Error)
	})
	first := collectionDate(t, "2026-04-01")
	last := collectionDate(t, "2026-04-30")
	before := collectionDate(t, "2026-03-31")
	after := collectionDate(t, "2026-05-01")
	payments := []models.Payment{
		{UserID: userID, ProjectID: 1, Stage: "received in period", Amount: 100, Status: constants.PaymentStatusConfirmed, PlanDate: first, ActualDate: &first},
		{UserID: userID, ProjectID: 1, Stage: "received early", Amount: 200, Status: constants.PaymentStatusConfirmed, PlanDate: first, ActualDate: &before},
		{UserID: userID, ProjectID: 1, Stage: "received later", Amount: 300, Status: constants.PaymentStatusConfirmed, PlanDate: last, ActualDate: &after},
		{UserID: userID, ProjectID: 1, Stage: "legacy confirmed without actual date", Amount: 400, Status: constants.PaymentStatusConfirmed, PlanDate: last},
		{UserID: userID, ProjectID: 1, Stage: "pending", Amount: 500, Status: constants.PaymentStatusPending, PlanDate: last},
		{UserID: userID, ProjectID: 1, Stage: "overdue", Amount: 600, Status: constants.PaymentStatusOverdue, PlanDate: first},
		{UserID: userID, ProjectID: 1, Stage: "previous plan paid inside", Amount: 700, Status: constants.PaymentStatusConfirmed, PlanDate: before, ActualDate: &first},
		{UserID: userID, ProjectID: 1, Stage: "next plan paid inside", Amount: 800, Status: constants.PaymentStatusConfirmed, PlanDate: after, ActualDate: &last},
		{UserID: userID + 1, ProjectID: 1, Stage: "other user", Amount: 9999, Status: constants.PaymentStatusConfirmed, PlanDate: first, ActualDate: &first},
	}
	require.NoError(t, db.Create(&payments).Error)

	stats, err := NewDashboardService().GetStatsForCalendar(userID, 2026, 4)
	require.NoError(t, err)
	require.Equal(t, 2100.0, stats.TotalAmount)
	require.Equal(t, 1000.0, responsePlannedReceived(t, stats))
	require.Equal(t, 1600.0, stats.PaidAmount)
	require.Equal(t, 1100.0, stats.PendingAmount)
	require.Equal(t, stats.TotalAmount, responsePlannedReceived(t, stats)+stats.PendingAmount)
	trend, err := NewDashboardService().GetIncomeTrendForCalendar(userID, 2026, 4)
	require.NoError(t, err)
	var planned, actual float64
	for index := range trend.Labels {
		planned += trend.ExpectedValues[index]
		actual += trend.ActualValues[index]
	}
	require.Equal(t, stats.TotalAmount, planned)
	require.Equal(t, stats.PaidAmount, actual, "trend still measures cash flow, not the planned cohort")
}

func TestDashboardPlanCollectionDoesNotReuseOldCacheAndInvalidatesNewShape(t *testing.T) {
	setupDashboardTestDB(t)
	const userID int64 = 994301
	t.Cleanup(func() {
		require.NoError(t, cache.Delete(fmt.Sprintf("dashboard:stats:v1:%d:year", userID)))
		invalidateDashboardCache(userID)
	})
	require.NoError(t, cache.SetJSON(fmt.Sprintf("dashboard:stats:v1:%d:year", userID), &dto.Stats{TotalAmount: -999}, time.Minute))
	stats, err := NewDashboardService().GetStats(userID, "year")
	require.NoError(t, err)
	require.Zero(t, stats.TotalAmount, "cached responses without the plan-completion field must not be reused")
	require.Zero(t, responsePlannedReceived(t, stats))

	for _, period := range dashboardPeriods {
		require.NoError(t, cache.SetJSON(fmt.Sprintf("dashboard:stats:v2:%d:%s", userID, period), stats, time.Minute))
	}
	invalidateDashboardCache(userID)
	for _, period := range dashboardPeriods {
		_, err := cache.Get(fmt.Sprintf("dashboard:stats:v2:%d:%s", userID, period))
		require.Error(t, err, "current statistics caches must be invalidated for %s", period)
	}
}
