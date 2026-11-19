package service

import (
	"context"
	"math"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/primordialweave/zhusuan/internal/database"
	"github.com/primordialweave/zhusuan/internal/dto"
	"github.com/primordialweave/zhusuan/internal/models"
	"github.com/primordialweave/zhusuan/internal/repository"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func releaseProject(t *testing.T, owner int64) *models.Project {
	t.Helper()
	setupServiceTestDB(t)
	project := &models.Project{Name: "release fixture", Company: "fixture", TotalAmount: 1000, Status: "active", Type: "web", UserID: owner}
	require.NoError(t, database.GetDB().Create(project).Error)
	return project
}

func releaseProjectInput(project *models.Project, total float64) dto.CreateProjectRequest {
	return dto.CreateProjectRequest{Name: project.Name, Company: project.Company, Type: project.Type, Status: project.Status, TotalAmount: total, StartDate: "2026-07-01", EndDate: "2026-12-31", UserID: project.UserID}
}

func TestReleaseRejectsNonPositiveOrNonFiniteFinancialAmounts(t *testing.T) {
	project := releaseProject(t, 991001)
	for _, amount := range []float64{-100, 0, math.NaN(), math.Inf(1)} {
		input := dto.PaymentRequest{ProjectID: project.ID, UserID: project.UserID, Stage: "all", Amount: amount, PlanDate: "2026-07-01", Status: "confirmed"}
		_, err := NewPaymentService().Create(input)
		require.Error(t, err)
		_, err = NewProjectService().Create(releaseProjectInput(project, amount))
		require.Error(t, err)
		_, err = NewProjectService().UpdateForUser(project.UserID, project.ID, releaseProjectInput(project, amount))
		require.Error(t, err)
	}
	var count int64
	require.NoError(t, database.GetDB().Model(&models.Payment{}).Where("project_id=?", project.ID).Count(&count).Error)
	require.Zero(t, count)
}

func TestReleaseExplicitOverdueRemainsInOutstandingAndOverdueStats(t *testing.T) {
	project := releaseProject(t, 991002)
	_, err := NewPaymentService().Create(dto.PaymentRequest{ProjectID: project.ID, UserID: project.UserID, Stage: "all", Amount: 100, PlanDate: "2026-01-01", Status: "overdue"})
	require.NoError(t, err)
	repo := repository.NewPaymentRepository()
	total, paid, pending, overdue, _, err := repo.GetStatsByPeriod(project.UserID, "2026-01-01", "2026-12-31 23:59:59")
	require.NoError(t, err)
	require.Equal(t, 100.0, total)
	require.Zero(t, paid)
	require.Equal(t, 100.0, pending)
	require.Equal(t, 100.0, overdue)
	global, err := repo.SumOverdue(project.UserID)
	require.NoError(t, err)
	require.Equal(t, 100.0, global)
}

func TestReleaseCalendarRangeIncludesEndDayButNotNextDay(t *testing.T) {
	project := releaseProject(t, 991003)
	service := NewPaymentService()
	for _, date := range []string{"2026-07-31", "2026-08-01"} {
		_, err := service.Create(dto.PaymentRequest{ProjectID: project.ID, UserID: project.UserID, Stage: "all", Amount: 100, PlanDate: date, Status: "pending"})
		require.NoError(t, err)
	}
	list, err := service.ListByDateRange(project.UserID, "2026-07-01", "2026-07-31")
	require.NoError(t, err)
	require.Len(t, list, 1)
	require.Equal(t, "2026-07-31", list[0].PlanDate.Format("2006-01-02"))
	_, err = service.ListByDateRange(project.UserID, "2026-08-01", "2026-07-31")
	require.Error(t, err)
}

func TestReleaseContractTotalRecalculatesPercentagesAtomically(t *testing.T) {
	project := releaseProject(t, 991004)
	payment, err := NewPaymentService().Create(dto.PaymentRequest{ProjectID: project.ID, UserID: project.UserID, Stage: "all", Amount: 500, PlanDate: "2026-07-01", Status: "pending"})
	require.NoError(t, err)
	_, err = NewProjectService().UpdateForUser(project.UserID, project.ID, releaseProjectInput(project, 2000))
	require.NoError(t, err)
	require.NoError(t, database.GetDB().First(payment, payment.ID).Error)
	require.Equal(t, 25.0, payment.Percentage)
	db := database.GetDB()
	require.NoError(t, db.Exec("CREATE TRIGGER release_percentage_failure BEFORE UPDATE OF percentage ON payments WHEN NEW.project_id = "+strings.TrimSpace(db.Dialector.Explain("?", project.ID))+" BEGIN SELECT RAISE(ABORT,'simulated update failure'); END").Error)
	t.Cleanup(func() { db.Exec("DROP TRIGGER IF EXISTS release_percentage_failure") })
	_, err = NewProjectService().UpdateForUser(project.UserID, project.ID, releaseProjectInput(project, 4000))
	require.Error(t, err)
	var stored models.Project
	require.NoError(t, db.First(&stored, project.ID).Error)
	require.Equal(t, 2000.0, stored.TotalAmount)
	require.NoError(t, db.First(payment, payment.ID).Error)
	require.Equal(t, 25.0, payment.Percentage)
}

func TestReleaseTwoConfirmationsRetainBothAmounts(t *testing.T) {
	project := releaseProject(t, 991005)
	service := NewPaymentService()
	payments := make([]*models.Payment, 0, 2)
	for _, amount := range []float64{200, 300} {
		payment, err := service.Create(dto.PaymentRequest{ProjectID: project.ID, UserID: project.UserID, Stage: "all", Amount: amount, PlanDate: "2026-07-01", Status: "pending"})
		require.NoError(t, err)
		payments = append(payments, payment)
	}
	var workers sync.WaitGroup
	errors := make(chan error, 2)
	for _, payment := range payments {
		workers.Add(1)
		go func(id int64) {
			defer workers.Done()
			errors <- service.ConfirmForUser(project.UserID, id, "2026-07-02", "bank_transfer")
		}(payment.ID)
	}
	workers.Wait()
	close(errors)
	for err := range errors {
		require.NoError(t, err)
	}
	var stored models.Project
	require.NoError(t, database.GetDB().First(&stored, project.ID).Error)
	require.Equal(t, 500.0, stored.ReceivedAmount)
}

type releaseSQLLogger struct {
	logger.Interface
	queries []string
}

func (log *releaseSQLLogger) Trace(_ context.Context, _ time.Time, query func() (string, int64), _ error) {
	sql, _ := query()
	log.queries = append(log.queries, sql)
}

func TestReleaseParentProjectLockUsesMySQLForUpdateSQL(t *testing.T) {
	log := &releaseSQLLogger{Interface: logger.Discard}
	db, err := gorm.Open(mysql.New(mysql.Config{DSN: "audit:audit@tcp(127.0.0.1:1)/audit", SkipInitializeWithVersion: true}), &gorm.Config{DryRun: true, DisableAutomaticPing: true, Logger: log})
	require.NoError(t, err)
	_, err = lockPaymentProjectInTx(db, 42, 7)
	require.NoError(t, err)
	require.Len(t, log.queries, 1)
	require.Contains(t, log.queries[0], "FOR UPDATE")
	require.Contains(t, log.queries[0], "user_id = 7")
}
