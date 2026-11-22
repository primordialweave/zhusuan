package service

import (
	"time"

	pkgerrors "github.com/primordialweave/zhusuan/internal/pkg/errors"
)

const (
	receiptPeriodWeek    = "week"
	receiptPeriodQuarter = "quarter"
	receiptPeriodYear    = "year"
	receiptPeriodAll     = "all"
)

type receiptRange struct {
	StartDate string
	EndDate   string
	Interval  string
	All       bool
}

// receiptRangeFor resolves natural calendar periods independently of the older
// rolling statistics. EndDate includes the last calendar day of the period.
func receiptRangeFor(period string, year, month int, now time.Time) (receiptRange, error) {
	if (year != 0 && !ValidCalendarPeriod(year, month)) || (year == 0 && month != 0) {
		return receiptRange{}, pkgerrors.New(400, "年份或月份无效")
	}
	loc := now.Location()
	var start, end time.Time
	interval := calendarUnitDay
	if year != 0 {
		if month == 0 {
			start = time.Date(year, time.January, 1, 0, 0, 0, 0, loc)
			end = start.AddDate(1, 0, 0)
			interval = calendarUnitMonth
		} else {
			start = time.Date(year, time.Month(month), 1, 0, 0, 0, 0, loc)
			end = start.AddDate(0, 1, 0)
		}
	} else {
		if period == "" {
			period = calendarUnitMonth
		}
		today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, loc)
		switch period {
		case receiptPeriodWeek:
			start = today.AddDate(0, 0, -(int(today.Weekday())+6)%7)
			end = start.AddDate(0, 0, 7)
		case calendarUnitMonth:
			start = time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, loc)
			end = start.AddDate(0, 1, 0)
		case receiptPeriodQuarter:
			firstMonth := time.Month((int(now.Month())-1)/3*3 + 1)
			start = time.Date(now.Year(), firstMonth, 1, 0, 0, 0, 0, loc)
			end = start.AddDate(0, 3, 0)
			interval = calendarUnitMonth
		case receiptPeriodYear:
			start = time.Date(now.Year(), time.January, 1, 0, 0, 0, 0, loc)
			end = start.AddDate(1, 0, 0)
			interval = calendarUnitMonth
		case receiptPeriodAll:
			return receiptRange{Interval: calendarUnitMonth, All: true}, nil
		default:
			return receiptRange{}, pkgerrors.New(400, "统计周期无效")
		}
	}
	return receiptRange{
		StartDate: start.Format(time.DateOnly),
		EndDate:   end.AddDate(0, 0, -1).Format(time.DateOnly),
		Interval:  interval,
	}, nil
}
