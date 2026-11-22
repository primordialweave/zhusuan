package service

import (
	"time"

	"github.com/primordialweave/zhusuan/internal/dto"
	pkgerrors "github.com/primordialweave/zhusuan/internal/pkg/errors"
	"github.com/primordialweave/zhusuan/internal/repository"
)

// GetReceiptOverview returns current balances of contracts signed in a natural
// period, separately from actual receipts received in that period for all contracts.
func (s *DashboardService) GetReceiptOverview(userID int64, period string, year, month int) (*dto.ReceiptOverview, error) {
	if userID <= 0 {
		return nil, pkgerrors.ErrInvalidParam
	}
	rangeValue, err := receiptRangeFor(period, year, month, time.Now())
	if err != nil {
		return nil, err
	}
	totals, err := repository.NewReceiptRepository().Overview(userID, rangeValue.StartDate, rangeValue.EndDate)
	if err != nil {
		return nil, pkgerrors.Wrap(err, "获取合同与收款统计失败")
	}
	totals.StartDate, totals.EndDate = rangeValue.StartDate, rangeValue.EndDate
	return totals, nil
}

// GetReceiptTrend returns dated actual receipts only; unknown dates remain in lifetime totals.
func (s *DashboardService) GetReceiptTrend(userID int64, period string, year, month int) (*dto.IncomeTrend, error) {
	if userID <= 0 {
		return nil, pkgerrors.ErrInvalidParam
	}
	now := time.Now()
	rangeValue, err := receiptRangeFor(period, year, month, now)
	if err != nil {
		return nil, err
	}
	repo := repository.NewReceiptRepository()
	trend := &dto.IncomeTrend{Labels: []string{}, ActualValues: []float64{}, ExpectedValues: []float64{}}
	if rangeValue.All {
		first, last, err := repo.ReceiptDateBounds(userID)
		if err != nil {
			return nil, pkgerrors.Wrap(err, "获取收款日期范围失败")
		}
		if first == "" {
			return trend, nil
		}
		rangeValue.StartDate, rangeValue.EndDate = first, last
		if today := now.Format(time.DateOnly); today > rangeValue.EndDate {
			rangeValue.EndDate = today
		}
	}
	values, err := repo.ReceiptTrend(userID, rangeValue.StartDate, rangeValue.EndDate, rangeValue.Interval)
	if err != nil {
		return nil, pkgerrors.Wrap(err, "获取实际收款趋势失败")
	}
	start, err := time.ParseInLocation(time.DateOnly, rangeValue.StartDate, now.Location())
	if err != nil {
		return nil, pkgerrors.Wrap(err, "收款开始日期无效")
	}
	end, err := time.ParseInLocation(time.DateOnly, rangeValue.EndDate, now.Location())
	if err != nil {
		return nil, pkgerrors.Wrap(err, "收款结束日期无效")
	}
	trend.StartDate, trend.EndDate = rangeValue.StartDate, rangeValue.EndDate
	if rangeValue.Interval == calendarUnitMonth {
		start = time.Date(start.Year(), start.Month(), 1, 0, 0, 0, 0, start.Location())
		for date := start; !date.After(end); date = date.AddDate(0, 1, 0) {
			key := date.Format("2006-01")
			trend.Labels = append(trend.Labels, key)
			trend.ActualValues = append(trend.ActualValues, values[key])
		}
	} else {
		for date := start; !date.After(end); date = date.AddDate(0, 0, 1) {
			trend.Labels = append(trend.Labels, date.Format("01-02"))
			trend.ActualValues = append(trend.ActualValues, values[date.Format(time.DateOnly)])
		}
	}
	return trend, nil
}
