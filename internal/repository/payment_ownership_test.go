package repository

import (
	"testing"
	"time"

	"github.com/primordialweave/zhusuan/internal/models"
	"github.com/stretchr/testify/require"
)

func TestPaymentQueriesExcludeMismatchedImportedOwnership(t *testing.T) {
	receipts, _ := receiptRepositoryFixture(t)
	repo := &PaymentRepository{db: receipts.db}
	today := time.Now()
	for _, payment := range []models.Payment{
		{UserID: 2, ProjectID: 1, Stage: "foreign receipt", Amount: 99999, Status: "pending", PlanDate: today},
		{UserID: 1, ProjectID: 4, Stage: "foreign project", Amount: 88888, Status: "overdue", PlanDate: today},
	} {
		require.NoError(t, receipts.db.Create(&payment).Error)
	}
	list, err := repo.ListByDateRange(1, today.Format(time.DateOnly), today.Format(time.DateOnly))
	require.NoError(t, err)
	for _, payment := range list {
		require.NotEqual(t, int64(4), payment.ProjectID)
		require.Equal(t, int64(1), payment.Project.UserID)
	}
	upcoming, err := repo.ListUpcoming(2, 7, 20)
	require.NoError(t, err)
	for _, payment := range upcoming {
		require.NotEqual(t, int64(1), payment.ProjectID)
	}
	overdue, err := repo.SumOverdue(1)
	require.NoError(t, err)
	require.Less(t, overdue, 88888.0)
	project, err := (&ProjectRepository{db: receipts.db}).FindByIDWithPaymentsForUser(1, 1)
	require.NoError(t, err)
	for _, payment := range project.Payments {
		require.Equal(t, int64(1), payment.UserID)
	}
	byProject, err := repo.ListByProject(1)
	require.NoError(t, err)
	for _, payment := range byProject {
		require.Equal(t, int64(1), payment.UserID)
	}
}
