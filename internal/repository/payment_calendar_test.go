package repository

import (
	"path/filepath"
	"testing"
	"time"

	"github.com/glebarez/sqlite"
	"github.com/primordialweave/zhusuan/internal/config"
	"github.com/primordialweave/zhusuan/internal/models"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func TestPaymentCalendarStatsPreserveStoredDatesAcrossTimezones(t *testing.T) {
	previousConfig := config.AppConfig
	config.AppConfig = &config.Config{DBType: "sqlite"}
	t.Cleanup(func() { config.AppConfig = previousConfig })
	db, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "calendar.db")), &gorm.Config{Logger: logger.Discard})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, sqlDB.Close()) })
	require.NoError(t, db.AutoMigrate(&models.Payment{}))

	shanghai := time.FixedZone("Shanghai", 8*60*60)
	date := func(day string, zone *time.Location) time.Time {
		parsed, err := time.ParseInLocation("2006-01-02", day, zone)
		require.NoError(t, err)
		return parsed
	}
	firstActual := date("2026-07-03", time.UTC)
	lastActual := date("2026-07-31", shanghai)
	fixtures := []models.Payment{
		{UserID: 42, ProjectID: 1, Stage: "first", Amount: 100, Status: "confirmed", PlanDate: date("2026-07-01", shanghai), ActualDate: &firstActual},
		{UserID: 42, ProjectID: 1, Stage: "last", Amount: 250, Status: "confirmed", PlanDate: date("2026-07-31", shanghai), ActualDate: &lastActual},
		{UserID: 42, ProjectID: 1, Stage: "before", Amount: 900, Status: "pending", PlanDate: date("2026-06-30", shanghai)},
		{UserID: 42, ProjectID: 1, Stage: "after", Amount: 900, Status: "pending", PlanDate: date("2026-08-01", shanghai)},
		{UserID: 43, ProjectID: 2, Stage: "other user", Amount: 900, Status: "pending", PlanDate: date("2026-07-01", shanghai)},
	}
	require.NoError(t, db.Create(&fixtures).Error)
	repo := &PaymentRepository{db: db}

	expected, actual, err := repo.GetIncomeStats(42, "2026-07-01", "2026-07-31", "day")
	require.NoError(t, err)
	require.Equal(t, map[string]float64{"2026-07-01": 100, "2026-07-31": 250}, expected)
	require.Equal(t, map[string]float64{"2026-07-03": 100, "2026-07-31": 250}, actual)
	expected, actual, err = repo.GetIncomeStats(42, "2026-07-01", "2026-07-31 23:59:59", "month")
	require.NoError(t, err)
	require.Equal(t, map[string]float64{"2026-07": 350}, expected)
	require.Equal(t, map[string]float64{"2026-07": 350}, actual)

	total, paid, pending, overdue, average, err := repo.GetStatsByPeriod(42, "2026-07-01", "2026-07-31")
	require.NoError(t, err)
	require.Equal(t, 350.0, total)
	require.Equal(t, 350.0, paid)
	require.Zero(t, pending)
	require.Zero(t, overdue)
	require.Equal(t, 1.0, average, "two-day and zero-day payments average one calendar day")
}
