package service

import (
	"fmt"
	"sync"
	"testing"
	"time"

	"github.com/primordialweave/zhusuan/internal/config"
	"github.com/primordialweave/zhusuan/internal/constants"
	"github.com/primordialweave/zhusuan/internal/database"
	"github.com/primordialweave/zhusuan/internal/models"
	"github.com/primordialweave/zhusuan/internal/pkg/utils"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

var dashboardTestDBOnce sync.Once

// setupDashboardTestDB 初始化仪表盘测试数据库
func setupDashboardTestDB(t *testing.T) {
	t.Helper()

	dashboardTestDBOnce.Do(func() {
		config.AppConfig = &config.Config{
			DBType: "sqlite",
			DBPath: "file:dashboard_test?mode=memory&cache=shared",
		}

		db := database.GetDB()
		require.NoError(t, db.AutoMigrate(&models.User{}, &models.Project{}, &models.Payment{}))
	})
}

// createTestDataForDashboard 创建测试数据
func createTestDataForDashboard(t *testing.T) (userID int64) {
	t.Helper()
	db := database.GetDB()
	userID = 2001

	// 清理旧数据
	db.Where("user_id = ?", userID).Delete(&models.Payment{})
	db.Where("user_id = ?", userID).Delete(&models.Project{})
	db.Delete(&models.User{}, userID)

	// 创建用户
	user := &models.User{
		ID:       userID,
		Username: "dashuser",
		Password: "hashed",
		Email:    "dash@test.com",
		Role:     constants.RoleUser,
	}
	require.NoError(t, db.Create(user).Error)

	// 创建项目
	now := time.Now()
	// 锚定自然月边界构造日期：Dashboard 的趋势按"本月 vs 上月"统计，
	// 若用 now-N天 的相对偏移，月初运行时日期会落入上月导致测试随日期漂移
	currMonthStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
	prevMonthMid := currMonthStart.AddDate(0, -1, 0).AddDate(0, 0, 14)
	project := &models.Project{
		ID:             1,
		UserID:         userID,
		Name:           "测试项目",
		Company:        "测试公司",
		ContractNumber: "TEST-001",
		TotalAmount:    300000,
		Status:         constants.ProjectStatusOngoing,
		StartDate:      now,
		EndDate:        now.AddDate(0, 6, 0),
		CreateTime:     now,
	}
	require.NoError(t, db.Create(project).Error)

	// 创建款项数据
	payments := []models.Payment{
		// 本月已确认款项
		{
			UserID:     userID,
			ProjectID:  1,
			Stage:      "首付款",
			Amount:     100000,
			Status:     constants.PaymentStatusConfirmed,
			PlanDate:   currMonthStart,
			ActualDate: ptrTime(currMonthStart),
		},
		// 本月待收款项
		{
			UserID:    userID,
			ProjectID: 1,
			Stage:     "进度款",
			Amount:    100000,
			Status:    constants.PaymentStatusPending,
			PlanDate:  now.AddDate(0, 0, 10),
		},
		// 本月逾期款项
		{
			UserID:    userID,
			ProjectID: 1,
			Stage:     "尾款",
			Amount:    50000,
			Status:    constants.PaymentStatusPending,
			PlanDate:  now.AddDate(0, 0, -5),
		},
		// 上月已确认款项（用于趋势对比）
		{
			UserID:     userID,
			ProjectID:  1,
			Stage:      "上月款",
			Amount:     80000,
			Status:     constants.PaymentStatusConfirmed,
			PlanDate:   prevMonthMid,
			ActualDate: ptrTime(prevMonthMid),
		},
		// 上月待收款项
		{
			UserID:    userID,
			ProjectID: 1,
			Stage:     "上月待收",
			Amount:    60000,
			Status:    constants.PaymentStatusPending,
			PlanDate:  prevMonthMid,
		},
	}

	for _, p := range payments {
		require.NoError(t, db.Create(&p).Error)
	}

	return userID
}

// ptrTime 辅助函数：返回time.Time指针
func ptrTime(t time.Time) *time.Time {
	return &t
}

// TestDashboardService_GetStats_AllMode 测试全局模式统计
func TestDashboardService_GetStats_AllMode(t *testing.T) {
	setupDashboardTestDB(t)
	svc := NewDashboardService()

	userID := createTestDataForDashboard(t)

	t.Run("全局模式统计正确性", func(t *testing.T) {
		stats, err := svc.GetStats(userID, "all")
		require.NoError(t, err)

		// 验证金额统计
		assert.Equal(t, float64(300000), stats.TotalAmount)   // 项目总金额
		assert.Equal(t, float64(180000), stats.PaidAmount)    // 已确认: 100000 + 80000
		assert.Equal(t, float64(120000), stats.PendingAmount) // 待收: 300000 - 180000

		// 逾期金额:本月逾期50000 + 上月逾期60000 = 110000
		// 注意:GetStats的all模式使用SumOverdue统计所有逾期
		assert.Equal(t, float64(110000), stats.OverdueAmount)
	})

	t.Run("趋势计算正确性", func(t *testing.T) {
		stats, err := svc.GetStats(userID, "all")
		require.NoError(t, err)

		// 本月已确认: 100000, 上月已确认: 80000
		// 趋势 = ((100000 - 80000) / 80000) * 100 = 25%
		assert.InDelta(t, 25.0, stats.PaidTrend, 0.1)
	})
}

// TestDashboardService_GetStats_PeriodMode 测试周期模式统计
func TestDashboardService_GetStats_PeriodMode(t *testing.T) {
	setupDashboardTestDB(t)
	svc := NewDashboardService()

	userID := createTestDataForDashboard(t)

	periods := []string{"week", "month", "quarter", "year"}

	for _, period := range periods {
		t.Run("周期模式_"+period, func(t *testing.T) {
			stats, err := svc.GetStats(userID, period)
			require.NoError(t, err)

			// 基本验证
			assert.GreaterOrEqual(t, stats.TotalAmount, float64(0))
			assert.GreaterOrEqual(t, stats.PaidAmount, float64(0))
			assert.LessOrEqual(t, stats.PaidAmount, stats.TotalAmount)

			// 趋势应该是合理的百分比
			assert.GreaterOrEqual(t, stats.TotalTrend, float64(-100))
			assert.GreaterOrEqual(t, stats.PaidTrend, float64(-100))
		})
	}
}

// TestDashboardService_GetIncomeTrend 测试收入趋势图表
func TestDashboardService_GetIncomeTrend(t *testing.T) {
	setupDashboardTestDB(t)
	svc := NewDashboardService()

	userID := createTestDataForDashboard(t)

	t.Run("月度收入趋势", func(t *testing.T) {
		trend, err := svc.GetIncomeTrend(userID, "month")
		require.NoError(t, err)

		assert.NotEmpty(t, trend.Labels)
		assert.NotEmpty(t, trend.ExpectedValues)
		assert.NotEmpty(t, trend.ActualValues)

		// 标签和数据长度应一致
		assert.Equal(t, len(trend.Labels), len(trend.ExpectedValues))
		assert.Equal(t, len(trend.Labels), len(trend.ActualValues))
	})

	t.Run("周度收入趋势", func(t *testing.T) {
		trend, err := svc.GetIncomeTrend(userID, "week")
		require.NoError(t, err)

		assert.NotEmpty(t, trend.Labels)
		assert.Len(t, trend.Labels, 7) // 7天
	})
}

func TestDashboardService_TrendMatchesMetricPeriodBoundaries(t *testing.T) {
	setupDashboardTestDB(t)
	for _, period := range []string{"quarter", "year"} {
		t.Run(period, func(t *testing.T) {
			userID := createTestDataForDashboard(t)
			db := database.GetDB()
			require.NoError(t, db.Where("user_id = ?", userID).Delete(&models.Payment{}).Error)
			window := utils.GetPeriodRange(period, 0)
			start, err := time.ParseInLocation("2006-01-02", window.StartDate, time.Local)
			require.NoError(t, err)
			end, err := time.ParseInLocation("2006-01-02", window.EndDate[:10], time.Local)
			require.NoError(t, err)
			payments := []models.Payment{
				{UserID: userID, ProjectID: 1, Stage: "outside-before", Amount: 200, Status: constants.PaymentStatusPending, PlanDate: start.AddDate(0, 0, -1)},
				{UserID: userID, ProjectID: 1, Stage: "first-day", Amount: 100, Status: constants.PaymentStatusPending, PlanDate: start},
				{UserID: userID, ProjectID: 1, Stage: "last-day", Amount: 300, Status: constants.PaymentStatusPending, PlanDate: end},
				{UserID: userID, ProjectID: 1, Stage: "received", Amount: 50, Status: constants.PaymentStatusConfirmed, PlanDate: start, ActualDate: &start},
				{UserID: userID, ProjectID: 1, Stage: "outside-after", Amount: 400, Status: constants.PaymentStatusPending, PlanDate: end.AddDate(0, 0, 1)},
			}
			require.NoError(t, db.Create(&payments).Error)
			invalidateDashboardCache(userID)
			svc := NewDashboardService()
			stats, err := svc.GetStats(userID, period)
			require.NoError(t, err)
			trend, err := svc.GetIncomeTrend(userID, period)
			require.NoError(t, err)
			var planned, received float64
			for i := range trend.Labels {
				planned += trend.ExpectedValues[i]
				received += trend.ActualValues[i]
			}
			assert.Equal(t, 450.0, planned)
			assert.Equal(t, 50.0, received)
			assert.Equal(t, stats.TotalAmount, planned)
			assert.Equal(t, stats.PaidAmount, received)
			assert.Equal(t, window.StartDate, trend.StartDate)
			assert.Equal(t, window.EndDate[:10], trend.EndDate)
			assert.Equal(t, start.Format("2006-01"), trend.Labels[0])
			assert.Equal(t, end.Format("2006-01"), trend.Labels[len(trend.Labels)-1])
		})
	}
}

// TestDashboardService_GetRecentProjects 测试最近项目
func TestDashboardService_GetRecentProjects(t *testing.T) {
	setupDashboardTestDB(t)
	svc := NewDashboardService()

	userID := createTestDataForDashboard(t)

	t.Run("获取最近项目", func(t *testing.T) {
		projects, err := svc.GetRecentProjects(userID)
		require.NoError(t, err)

		assert.NotEmpty(t, projects)
	})
}

// TestDashboardService_GetUpcomingPayments 测试即将到期款项
func TestDashboardService_GetUpcomingPayments(t *testing.T) {
	setupDashboardTestDB(t)
	svc := NewDashboardService()

	userID := createTestDataForDashboard(t)
	db := database.GetDB()
	require.NoError(t, db.Create(&models.Payment{
		UserID: userID, ProjectID: 1, Stage: "三天内到期", Amount: 1000,
		Status: constants.PaymentStatusPending, PlanDate: time.Now().AddDate(0, 0, 3),
	}).Error)

	t.Run("获取即将到期款项", func(t *testing.T) {
		payments, err := svc.GetUpcomingPayments(userID)
		require.NoError(t, err)

		// 应该包含今天至未来7天内到期的款项
		assert.NotEmpty(t, payments)

		// 所有款项应该是待收状态
		for _, p := range payments {
			assert.Equal(t, constants.PaymentStatusPending, p.Status)
		}
	})
}

func TestDashboardService_GetUpcomingPaymentsIncludesFuturePaymentAfterOverdueItems(t *testing.T) {
	setupDashboardTestDB(t)
	svc := NewDashboardService()
	db := database.GetDB()

	const userID int64 = 2002
	db.Where("user_id = ?", userID).Delete(&models.Payment{})
	db.Where("user_id = ?", userID).Delete(&models.Project{})
	db.Delete(&models.User{}, userID)

	user := &models.User{
		ID:       userID,
		Username: "upcoming-regression",
		Password: "hashed",
		Email:    "upcoming-regression@test.com",
		Role:     constants.RoleUser,
	}
	require.NoError(t, db.Create(user).Error)

	now := time.Now()
	project := &models.Project{
		UserID:         userID,
		Name:           "Upcoming Regression Project",
		Company:        "Test Company",
		ContractNumber: "UPCOMING-REGRESSION-001",
		TotalAmount:    70000,
		Status:         constants.ProjectStatusOngoing,
		StartDate:      now.AddDate(0, -1, 0),
		EndDate:        now.AddDate(0, 1, 0),
	}
	require.NoError(t, db.Create(project).Error)

	payments := make([]models.Payment, 0, 7)
	for i := 0; i < 6; i++ {
		payments = append(payments, models.Payment{
			UserID:    userID,
			ProjectID: project.ID,
			Stage:     "逾期款项",
			Amount:    10000,
			Status:    constants.PaymentStatusPending,
			PlanDate:  now.AddDate(0, 0, -10+i),
		})
	}
	payments = append(payments, models.Payment{
		UserID:    userID,
		ProjectID: project.ID,
		Stage:     "未来三天到期",
		Amount:    10000,
		Status:    constants.PaymentStatusPending,
		PlanDate:  now.AddDate(0, 0, 3),
	})
	require.NoError(t, db.Create(&payments).Error)

	result, err := svc.GetUpcomingPayments(userID)
	require.NoError(t, err)

	foundFuturePayment := false
	for _, payment := range result {
		assert.False(t, payment.PlanDate.Before(time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())), "历史逾期待收款不属于 upcoming")
		if payment.Stage == "未来三天到期" {
			foundFuturePayment = true
		}
	}
	assert.True(t, foundFuturePayment, "7天内的未来待收款不应被逾期款项挤出结果")
	assert.Len(t, result, 1, "upcoming 只应返回今天至未来7天内的待收款")
}

func TestDashboardService_GetUpcomingPaymentsLimitsToNearestTwenty(t *testing.T) {
	setupDashboardTestDB(t)
	svc := NewDashboardService()
	db := database.GetDB()

	const userID int64 = 2003
	db.Where("user_id = ?", userID).Delete(&models.Payment{})
	db.Where("user_id = ?", userID).Delete(&models.Project{})
	db.Delete(&models.User{}, userID)
	require.NoError(t, db.Create(&models.User{ID: userID, Username: "upcoming-limit", Password: "hashed", Email: "upcoming-limit@test.com", Role: constants.RoleUser}).Error)

	now := time.Now()
	project := &models.Project{UserID: userID, Name: "Upcoming Limit Project", Company: "Test Company", ContractNumber: "UPCOMING-LIMIT-001", TotalAmount: 25000, Status: constants.ProjectStatusOngoing, StartDate: now, EndDate: now.AddDate(0, 1, 0)}
	require.NoError(t, db.Create(project).Error)

	payments := make([]models.Payment, 0, 25)
	for i := 0; i < 25; i++ {
		payments = append(payments, models.Payment{UserID: userID, ProjectID: project.ID, Stage: fmt.Sprintf("未来款项-%02d", i), Amount: 1000, Status: constants.PaymentStatusPending, PlanDate: now.Add(time.Duration(i) * time.Hour)})
	}
	require.NoError(t, db.Create(&payments).Error)

	result, err := svc.GetUpcomingPayments(userID)
	require.NoError(t, err)
	require.Len(t, result, 20)
	for i := 1; i < len(result); i++ {
		assert.False(t, result[i].PlanDate.Before(result[i-1].PlanDate), "结果应按 plan_date 升序返回")
	}
	assert.Equal(t, "未来款项-00", result[0].Stage)
	assert.Equal(t, "未来款项-19", result[19].Stage)
}

// TestDashboardService_DataIsolation 测试数据隔离
func TestDashboardService_DataIsolation(t *testing.T) {
	setupDashboardTestDB(t)
	svc := NewDashboardService()
	db := database.GetDB()

	// 创建两个用户
	user1ID := int64(3001)
	user2ID := int64(3002)

	user1 := &models.User{ID: user1ID, Username: "user1", Password: "hash", Email: "u1@test.com", Role: constants.RoleUser}
	user2 := &models.User{ID: user2ID, Username: "user2", Password: "hash", Email: "u2@test.com", Role: constants.RoleUser}
	require.NoError(t, db.Create(user1).Error)
	require.NoError(t, db.Create(user2).Error)

	// 为user1创建项目和款项
	now := time.Now()
	project1 := &models.Project{
		UserID:         user1ID,
		Name:           "User1 Project",
		Company:        "Company1",
		ContractNumber: "U1-001",
		TotalAmount:    100000,
		StartDate:      now,
		EndDate:        now.AddDate(0, 6, 0),
	}
	require.NoError(t, db.Create(project1).Error)

	payment1 := &models.Payment{
		UserID:     user1ID,
		ProjectID:  project1.ID,
		Stage:      "首付款",
		Amount:     50000,
		Status:     constants.PaymentStatusConfirmed,
		PlanDate:   now,
		ActualDate: ptrTime(now),
	}
	require.NoError(t, db.Create(payment1).Error)

	t.Run("用户只能看到自己的数据", func(t *testing.T) {
		// user1应该看到自己的数据
		stats1, err := svc.GetStats(user1ID, "all")
		require.NoError(t, err)
		assert.Equal(t, float64(100000), stats1.TotalAmount)
		assert.Equal(t, float64(50000), stats1.PaidAmount)

		// user2应该看到空数据
		stats2, err := svc.GetStats(user2ID, "all")
		require.NoError(t, err)
		assert.Equal(t, float64(0), stats2.TotalAmount)
		assert.Equal(t, float64(0), stats2.PaidAmount)
	})

	t.Run("最近项目只返回自己的", func(t *testing.T) {
		projects, err := svc.GetRecentProjects(user2ID)
		require.NoError(t, err)
		assert.Empty(t, projects)

		projects1, err := svc.GetRecentProjects(user1ID)
		require.NoError(t, err)
		assert.Len(t, projects1, 1)
	})
}

func TestDashboardService_CalendarPeriod(t *testing.T) {
	setupDashboardTestDB(t)
	db := database.GetDB()
	const userID = int64(2002)
	createTestUser(t, userID, "calendar-period-owner")
	project := models.Project{UserID: userID, Name: "calendar period", ContractNumber: "CALENDAR-PERIOD"}
	require.NoError(t, db.Create(&project).Error)
	t.Cleanup(func() {
		require.NoError(t, db.Where("project_id = ?", project.ID).Delete(&models.Payment{}).Error)
		require.NoError(t, db.Delete(&project).Error)
	})
	db.Where("user_id = ?", userID).Delete(&models.Payment{})
	// Dates arrive from the API as plain days and are stored at UTC midnight.
	day := func(year int, month time.Month, d int) time.Time {
		return time.Date(year, month, d, 0, 0, 0, 0, time.UTC)
	}
	payments := []models.Payment{
		{UserID: userID, ProjectID: 9, Stage: "二月到账", Amount: 300, Status: constants.PaymentStatusConfirmed, PlanDate: day(2024, 2, 29), ActualDate: ptrTime(day(2024, 2, 29))},
		{UserID: userID, ProjectID: 9, Stage: "二月待收", Amount: 200, Status: constants.PaymentStatusPending, PlanDate: day(2024, 2, 1)},
		{UserID: userID, ProjectID: 9, Stage: "一月到账", Amount: 100, Status: constants.PaymentStatusConfirmed, PlanDate: day(2024, 1, 31), ActualDate: ptrTime(day(2024, 1, 31))},
		{UserID: userID, ProjectID: 9, Stage: "年末到账", Amount: 50, Status: constants.PaymentStatusConfirmed, PlanDate: day(2024, 12, 31), ActualDate: ptrTime(day(2024, 12, 31))},
		{UserID: userID, ProjectID: 9, Stage: "次年", Amount: 999, Status: constants.PaymentStatusConfirmed, PlanDate: day(2025, 1, 1), ActualDate: ptrTime(day(2025, 1, 1))},
		{UserID: userID, ProjectID: 9, Stage: "上年", Amount: 400, Status: constants.PaymentStatusConfirmed, PlanDate: day(2023, 6, 1), ActualDate: ptrTime(day(2023, 6, 1))},
	}
	for _, p := range payments {
		p.ProjectID = project.ID
		require.NoError(t, db.Create(&p).Error)
	}
	service := NewDashboardService()

	month, err := service.GetStatsForCalendar(userID, 2024, 2)
	require.NoError(t, err)
	assert.Equal(t, 500.0, month.TotalAmount)
	assert.Equal(t, 300.0, month.PaidAmount)
	assert.Equal(t, 200.0, month.PendingAmount)
	assert.Equal(t, 200.0, month.OverdueAmount)
	assert.Equal(t, 200.0, month.PaidTrend, "February is compared with January")

	year, err := service.GetStatsForCalendar(userID, 2024, 0)
	require.NoError(t, err)
	assert.Equal(t, 650.0, year.TotalAmount, "both ends of the year count, the next year does not")
	assert.Equal(t, 450.0, year.PaidAmount)
	assert.Equal(t, 12.5, year.PaidTrend, "2024 is compared with 2023")

	monthTrend, err := service.GetIncomeTrendForCalendar(userID, 2024, 2)
	require.NoError(t, err)
	assert.Len(t, monthTrend.Labels, 29, "a leap February has 29 days")
	assert.Equal(t, "02-01", monthTrend.Labels[0])
	assert.Equal(t, "02-29", monthTrend.Labels[28])
	assert.Equal(t, 300.0, monthTrend.ActualValues[28])
	assert.Equal(t, 200.0, monthTrend.ExpectedValues[0])
	assert.Equal(t, "2024-02-01", monthTrend.StartDate)
	assert.Equal(t, "2024-02-29", monthTrend.EndDate)

	yearTrend, err := service.GetIncomeTrendForCalendar(userID, 2024, 0)
	require.NoError(t, err)
	assert.Len(t, yearTrend.Labels, 12)
	assert.Equal(t, "2024-01", yearTrend.Labels[0])
	assert.Equal(t, []float64{100, 300}, yearTrend.ActualValues[:2])
	assert.Equal(t, 50.0, yearTrend.ActualValues[11])

	assert.True(t, ValidCalendarPeriod(2024, 0))
	assert.False(t, ValidCalendarPeriod(2024, 13))
	assert.False(t, ValidCalendarPeriod(1999, 1))
}
