package service

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	pkgerrors "github.com/primordialweave/zhusuan/internal/pkg/errors"
)

func TestReceiptRangeCalendarBoundaries(t *testing.T) {
	zone := time.FixedZone("calendar", 14*60*60)
	date := func(year int, month time.Month, day int) time.Time {
		return time.Date(year, month, day, 0, 30, 0, 0, zone)
	}
	for _, tc := range []struct {
		name, period, start, end, interval string
		now                                time.Time
		year, month                        int
		all                                bool
	}{
		{"default month", "", "2026-11-01", "2026-11-30", "day", date(2026, 11, 22), 0, 0, false},
		{"Sunday", "week", "2026-11-16", "2026-11-22", "day", date(2026, 11, 22), 0, 0, false},
		{"Monday in supplied timezone", "week", "2026-01-05", "2026-01-11", "day", date(2026, 1, 5), 0, 0, false},
		{"week begins previous year", "week", "2024-12-30", "2025-01-05", "day", date(2025, 1, 5), 0, 0, false},
		{"week ends next year", "week", "2025-12-29", "2026-01-04", "day", date(2025, 12, 29), 0, 0, false},
		{"leap February", "month", "2024-02-01", "2024-02-29", "day", date(2024, 2, 29), 0, 0, false},
		{"non-leap February", "month", "2026-02-01", "2026-02-28", "day", date(2026, 2, 28), 0, 0, false},
		{"first quarter boundary", "quarter", "2026-01-01", "2026-03-31", "month", date(2026, 3, 31), 0, 0, false},
		{"next quarter boundary", "quarter", "2026-04-01", "2026-06-30", "month", date(2026, 4, 1), 0, 0, false},
		{"last quarter", "quarter", "2026-10-01", "2026-12-31", "month", date(2026, 11, 22), 0, 0, false},
		{"calendar year", "year", "2026-01-01", "2026-12-31", "month", date(2026, 11, 22), 0, 0, false},
		{"all receipts", "all", "", "", "month", date(2026, 11, 22), 0, 0, true},
		{"selected leap month", "year", "2024-02-01", "2024-02-29", "day", date(2026, 11, 22), 2024, 2, false},
		{"selected full year", "month", "2024-01-01", "2024-12-31", "month", date(2026, 11, 22), 2024, 0, false},
		{"explicit calendar overrides period", "unknown", "2000-01-01", "2000-12-31", "month", date(2026, 11, 22), 2000, 0, false},
		{"last supported calendar month", "all", "2100-12-01", "2100-12-31", "day", date(2026, 11, 22), 2100, 12, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			got, err := receiptRangeFor(tc.period, tc.year, tc.month, tc.now)
			require.NoError(t, err)
			assert.Equal(t, tc.start, got.StartDate)
			assert.Equal(t, tc.end, got.EndDate)
			assert.Equal(t, tc.interval, got.Interval)
			assert.Equal(t, tc.all, got.All)
		})
	}
}

func TestReceiptRangeRejectsInvalidScopes(t *testing.T) {
	now := time.Date(2026, 11, 22, 14, 0, 0, 0, time.UTC)
	for _, tc := range []struct {
		name, period string
		year, month  int
	}{
		{"unknown period", "rolling-year", 0, 0},
		{"month requires year", "month", 0, 2},
		{"negative month without year", "month", 0, -1},
		{"negative year", "year", -1, 0},
		{"year too small", "all", 1999, 0},
		{"year too large", "year", 2101, 0},
		{"negative selected month", "month", 2026, -1},
		{"month too large", "month", 2026, 13},
	} {
		t.Run(tc.name, func(t *testing.T) {
			got, err := receiptRangeFor(tc.period, tc.year, tc.month, now)
			require.Error(t, err)
			assert.Equal(t, 400, pkgerrors.GetHTTPCode(err))
			assert.Empty(t, got.StartDate)
			assert.Empty(t, got.EndDate)
			assert.False(t, got.All)
		})
	}
}
