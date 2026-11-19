package service

import (
	"fmt"
	"time"

	"github.com/primordialweave/zhusuan/internal/dto"
	"github.com/primordialweave/zhusuan/internal/models"
	"github.com/primordialweave/zhusuan/internal/pkg/cache"
	"github.com/primordialweave/zhusuan/internal/pkg/utils"
	"github.com/primordialweave/zhusuan/internal/repository"
)

// DashboardService 仪表盘服务
// 负责处理仪表盘页面的所有数据展示逻辑，包括统计数据、趋势图表、
// 最近项目和即将到期的款项。
//
// 依赖:
//   - ProjectRepository: 用于查询项目相关数据
//   - PaymentRepository: 用于查询款项相关数据
type DashboardService struct {
	projectRepo *repository.ProjectRepository
	paymentRepo *repository.PaymentRepository
}

// NewDashboardService 创建并初始化仪表盘服务实例
//
// 返回:
//   - *DashboardService: 初始化的服务实例，包含必要的 Repository 依赖
func NewDashboardService() *DashboardService {
	return &DashboardService{
		projectRepo: repository.NewProjectRepository(),
		paymentRepo: repository.NewPaymentRepository(),
	}
}

// dashboardPeriods GetStats 支持的统计周期，同时是缓存键与缓存失效的唯一依据
const (
	calendarUnitDay   = "day"
	calendarUnitMonth = "month"
)

var dashboardPeriods = []string{"all", "week", calendarUnitMonth, "quarter", "year"}

// normalizeDashboardPeriod 归一化客户端传入的统计周期
// 空值与未知值一律归为 "all"，保证缓存键有界且失效列表完全覆盖
func normalizeDashboardPeriod(period string) string {
	for _, p := range dashboardPeriods {
		if period == p {
			return period
		}
	}
	return "all"
}

// invalidateDashboardCache 清除指定用户所有周期的 Dashboard 统计缓存
// 供 Payment/Project 服务在数据变更后调用。
func invalidateDashboardCache(userID int64) {
	for _, period := range dashboardPeriods {
		_ = cache.Delete(fmt.Sprintf("dashboard:stats:v1:%d:%s", userID, period))
	}
}

// GetStats 获取仪表盘核心统计数据
// 根据指定的用户ID和时间周期，计算总金额、已收款、待收款、逾期金额及各项数据的环比趋势。
//
// 参数:
//   - userID: 当前登录用户的ID
//   - period: 统计周期，可选值: "week"(本周), "month"(本月), "quarter"(本季度), "year"(本年), "all"(全部/全局)
//
// 返回:
//   - *dto.Stats: 包含各项统计数值和趋势百分比的结构体
//   - error: 数据库查询或其他错误
//
// 说明:
//   - 当 period 为 "all" 或空字符串时，返回全局统计数据（基于项目合同总额），此时不计算趋势（趋势值为0）。
//   - 其他周期模式下，统计数据基于实际产生的款项（Payment）计算，并会计算与上一周期的环比趋势。
func (s *DashboardService) GetStats(userID int64, period string) (*dto.Stats, error) {
	// 归一化周期，未知/空值 → "all"，防止任意字符串撑爆缓存键空间
	period = normalizeDashboardPeriod(period)

	// 尝试从缓存获取 (v1 表示缓存数据结构版本)
	cacheKey := fmt.Sprintf("dashboard:stats:v1:%d:%s", userID, period)
	var stats dto.Stats

	// 尝试从缓存读取
	if err := cache.GetJSON(cacheKey, &stats); err == nil {
		return &stats, nil
	}

	// 缓存未命中，从数据库查询
	// 模式 1: 全局统计模式（通常用于工作台概览）
	if period == "all" {
		// 核心逻辑: 从 Project 表获取基于合同金额的宏观统计
		// 也就是所有项目的总合同额、已收和待收
		totalAmount, paidAmount, pendingAmount, err := s.projectRepo.GetStats(userID)
		if err != nil {
			return nil, err
		}

		// 补充逻辑: 计算逾期金额
		// 逾期金额需要基于 Payment 表中具体款项的截止日期来判断
		overdueAmount, err := s.paymentRepo.SumOverdue(userID)
		if err != nil {
			return nil, err
		}

		// ---------------------------------------------------------------------
		// 优化: 计算趋势 (Trend)
		// 即使主数值是"全量"统计，趋势值我们希望展示 "本月 vs 上月" 的环比变化，
		// 而不是无意义的 0% 或 全量 vs 0。
		// ---------------------------------------------------------------------

		// 1. 定义 "本月" 和 "上月" 的时间范围（使用自然月）
		now := time.Now()

		// 本月：从月初到现在
		currentMonthStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
		startDate := currentMonthStart.Format("2006-01-02")
		endDate := now.Format("2006-01-02") + " 23:59:59"

		// 上月：上个月的第一天到最后一天
		prevMonthStart := currentMonthStart.AddDate(0, -1, 0)
		prevMonthEnd := currentMonthStart.Add(-time.Second)
		prevStartDate := prevMonthStart.Format("2006-01-02")
		prevEndDate := prevMonthEnd.Format("2006-01-02") + " 23:59:59"

		// 2. 获取本月统计作为 "当前周期值" (只用于计算 Trend)
		currTotal, currPaid, currPending, currOverdue, currAvgDays, err := s.paymentRepo.GetStatsByPeriod(userID, startDate, endDate)
		if err != nil {
			return nil, err
		}
		// 临时计算本月逾期 (注意：这里严格来说是当前快照，但为了趋势对比，我们需要历史数据。
		// PaymentRepo.SumOverdue 是查当前状态。如果要查"上个月的逾期"，比较困难，因为状态是流动的。
		// 用户的需求是 "逾期金额也要计算"。

		// 3. 获取上月统计作为 "上一周期值"
		prevTotal, prevPaid, prevPending, prevOverdue, prevAvgDays, err := s.paymentRepo.GetStatsByPeriod(userID, prevStartDate, prevEndDate)
		if err != nil {
			return nil, err
		}

		// 5. 组装返回结构
		// 注意: Amount 字段使用全量数据 (ProjectRepo)；
		// AvgCollectionDays 与所有 Trend 字段一致，采用"本月 vs 上月"口径，
		// 避免出现数值为 0 而趋势非 0 的矛盾展示
		result := &dto.Stats{
			TotalAmount:            totalAmount,   // 全量
			PaidAmount:             paidAmount,    // 全量
			PendingAmount:          pendingAmount, // 全量
			OverdueAmount:          overdueAmount, // 全量
			AvgCollectionDays:      currAvgDays,   // 本月均值
			TotalTrend:             utils.CalcPercentageTrend(currTotal, prevTotal),
			PaidTrend:              utils.CalcPercentageTrend(currPaid, prevPaid),
			PendingTrend:           utils.CalcPercentageTrend(currPending, prevPending),
			OverdueTrend:           utils.CalcPercentageTrend(currOverdue, prevOverdue),
			AvgCollectionDaysTrend: utils.CalcPercentageTrend(currAvgDays, prevAvgDays),
		}

		// 写入缓存
		_ = cache.SetJSON(cacheKey, result, 1*time.Minute)
		return result, nil
	}

	// 模式 2: 按周期统计模式（通常用于数据分析页面）
	// 需要计算当前周期和上一周期的数据，以得出趋势百分比
	current, previous := utils.GetCurrentAndPreviousPeriod(period)

	// 步骤 1: 获取当前周期的各项统计指标
	currTotal, currPaid, currPending, currOverdue, currAvgDays, err := s.paymentRepo.GetStatsByPeriod(userID, current.StartDate, current.EndDate)
	if err != nil {
		return nil, err
	}

	// 步骤 2: 获取上一周期的各项统计指标（用于对比）
	prevTotal, prevPaid, prevPending, prevOverdue, prevAvgDays, err := s.paymentRepo.GetStatsByPeriod(userID, previous.StartDate, previous.EndDate)
	if err != nil {
		return nil, err
	}

	// 步骤 3: 组装返回结构
	result := &dto.Stats{
		TotalAmount:            currTotal,
		PaidAmount:             currPaid,
		PendingAmount:          currPending,
		OverdueAmount:          currOverdue,
		AvgCollectionDays:      currAvgDays,
		TotalTrend:             utils.CalcPercentageTrend(currTotal, prevTotal),
		PaidTrend:              utils.CalcPercentageTrend(currPaid, prevPaid),
		PendingTrend:           utils.CalcPercentageTrend(currPending, prevPending),
		OverdueTrend:           utils.CalcPercentageTrend(currOverdue, prevOverdue),
		AvgCollectionDaysTrend: utils.CalcPercentageTrend(currAvgDays, prevAvgDays),
	}

	// 写入缓存
	_ = cache.SetJSON(cacheKey, result, 1*time.Minute)
	return result, nil
}

// ValidCalendarPeriod 判断自选的年 / 月是否可用于统计（month 为 0 表示整年）
func ValidCalendarPeriod(year, month int) bool {
	return year >= 2000 && year <= 2100 && month >= 0 && month <= 12
}

// GetStatsForCalendar 获取某一自然年或自然月的统计数据
// 口径与按周期统计一致（基于款项），趋势对比紧邻的上一年 / 上一月。
// 自选范围的组合太多，不进缓存：缓存失效列表只覆盖固定周期。
//
// 参数:
//   - userID: 当前登录用户的ID
//   - year: 四位年份
//   - month: 1-12 表示该年的某个月；0 表示整年
func (s *DashboardService) GetStatsForCalendar(userID int64, year, month int) (*dto.Stats, error) {
	current, previous := utils.GetCalendarRange(year, month)
	currTotal, currPaid, currPending, currOverdue, currAvgDays, err := s.paymentRepo.GetStatsByPeriod(userID, current.StartDate, current.EndDate)
	if err != nil {
		return nil, err
	}
	prevTotal, prevPaid, prevPending, prevOverdue, prevAvgDays, err := s.paymentRepo.GetStatsByPeriod(userID, previous.StartDate, previous.EndDate)
	if err != nil {
		return nil, err
	}
	return &dto.Stats{
		TotalAmount:            currTotal,
		PaidAmount:             currPaid,
		PendingAmount:          currPending,
		OverdueAmount:          currOverdue,
		AvgCollectionDays:      currAvgDays,
		TotalTrend:             utils.CalcPercentageTrend(currTotal, prevTotal),
		PaidTrend:              utils.CalcPercentageTrend(currPaid, prevPaid),
		PendingTrend:           utils.CalcPercentageTrend(currPending, prevPending),
		OverdueTrend:           utils.CalcPercentageTrend(currOverdue, prevOverdue),
		AvgCollectionDaysTrend: utils.CalcPercentageTrend(currAvgDays, prevAvgDays),
	}, nil
}

// GetIncomeTrendForCalendar 获取某一自然年（按月聚合）或自然月（按天聚合）的收入趋势
//
// 参数:
//   - userID: 用户ID
//   - year: 四位年份
//   - month: 1-12 表示该年的某个月；0 表示整年
func (s *DashboardService) GetIncomeTrendForCalendar(userID int64, year, month int) (*dto.IncomeTrend, error) {
	current, _ := utils.GetCalendarRange(year, month)
	interval := calendarUnitDay
	if month == 0 {
		interval = calendarUnitMonth
	}
	expected, actual, err := s.paymentRepo.GetIncomeStats(userID, current.StartDate, current.EndDate, interval)
	if err != nil {
		return nil, err
	}

	trend := &dto.IncomeTrend{StartDate: current.StartDate, EndDate: current.EndDate[:10]}
	add := func(key, label string) {
		trend.Labels = append(trend.Labels, label)
		trend.ActualValues = append(trend.ActualValues, actual[key])
		trend.ExpectedValues = append(trend.ExpectedValues, expected[key])
	}
	if month == 0 {
		for m := time.January; m <= time.December; m++ {
			key := time.Date(year, m, 1, 0, 0, 0, 0, time.Local).Format("2006-01")
			add(key, key)
		}
		return trend, nil
	}
	first := time.Date(year, time.Month(month), 1, 0, 0, 0, 0, time.Local)
	for date := first; date.Month() == first.Month(); date = date.AddDate(0, 0, 1) {
		add(date.Format("2006-01-02"), date.Format("01-02"))
	}
	return trend, nil
}

// GetIncomeTrend 获取收入趋势图表数据
// 根据指定的时间段返回用于绘制折线图的标签和数值。
//
// 参数:
//   - userID: 用户ID
//   - period: 时间维度，"week"和"month"按天聚合，"quarter"和"year"按月聚合
//
// 返回:
//   - *dto.IncomeTrend: 包含 Labels (X轴), ActualValues (实际收入), ExpectedValues (预计收入)
//   - error: 错误信息
func (s *DashboardService) GetIncomeTrend(userID int64, period string) (*dto.IncomeTrend, error) {
	periodDays := map[string]int{"week": 7, calendarUnitMonth: 30, "quarter": 90, "year": 365}
	days, valid := periodDays[period]
	if !valid {
		period, days = calendarUnitMonth, 30
	}
	// Metrics and charts must query the same rolling period, including partial months.
	periodRange := utils.GetPeriodRange(period, 0)
	startDate, endDate := periodRange.StartDate, periodRange.EndDate
	loopStart, err := time.ParseInLocation("2006-01-02", startDate, time.Local)
	if err != nil {
		return nil, fmt.Errorf("parse income trend start: %w", err)
	}
	loopEnd, err := time.ParseInLocation("2006-01-02 15:04:05", endDate, time.Local)
	if err != nil {
		return nil, fmt.Errorf("parse income trend end: %w", err)
	}
	interval, months := calendarUnitDay, 0
	if period == "quarter" || period == "year" {
		interval = calendarUnitMonth
		months = (loopEnd.Year()-loopStart.Year())*12 + int(loopEnd.Month()-loopStart.Month()) + 1
		loopStart = time.Date(loopStart.Year(), loopStart.Month(), 1, 0, 0, 0, 0, loopStart.Location())
	}

	// 从数据库查询聚合好的收入数据（Map形式）
	expected, actual, err := s.paymentRepo.GetIncomeStats(userID, startDate, endDate, interval)
	if err != nil {
		return nil, err
	}

	var labels []string
	var actualValues []float64
	var expectedValues []float64

	// 数据补全: 数据库只返回有数据的日期，需要遍历完整时间轴填补0值
	if interval == calendarUnitDay {
		for i := 0; i < days; i++ {
			date := loopStart.AddDate(0, 0, i)
			key := date.Format("2006-01-02") // 数据库返回的Key格式
			label := date.Format("01-02")    // 前端展示的X轴标签

			labels = append(labels, label)
			actualValues = append(actualValues, actual[key])
			expectedValues = append(expectedValues, expected[key])
		}
	} else {
		count := months
		for i := 0; i < count; i++ {
			date := loopStart.AddDate(0, i, 0)
			key := date.Format("2006-01")   // 数据库返回的Key格式
			label := date.Format("2006-01") // Keep years visible across a rolling year boundary.

			labels = append(labels, label)
			actualValues = append(actualValues, actual[key])
			expectedValues = append(expectedValues, expected[key])
		}
	}

	return &dto.IncomeTrend{
		StartDate:      startDate,
		EndDate:        periodRange.EndDate[:10],
		Labels:         labels,
		ActualValues:   actualValues,
		ExpectedValues: expectedValues,
	}, nil
}

// GetRecentProjects 获取最近更新的5个项目
// 用于仪表盘"最近项目"列表展示。
//
// 参数:
//   - userID: 用户ID
//
// 返回:
//   - []models.Project: 项目列表切片
//   - error: 错误信息
func (s *DashboardService) GetRecentProjects(userID int64) ([]models.Project, error) {
	return s.projectRepo.ListRecent(userID, 5)
}

// GetUpcomingPayments 获取即将到期的款项
// 查询今天至未来7天内到期的待收款项。
//
// 参数:
//   - userID: 用户ID
//
// 返回:
//   - []models.Payment: 款项列表切片
//   - error: 错误信息
func (s *DashboardService) GetUpcomingPayments(userID int64) ([]models.Payment, error) {
	return s.paymentRepo.ListUpcoming(userID, 7, 20)
}
