package service

import (
	"testing"
	"time"

	"github.com/primordialweave/zhusuan/internal/database"
	"github.com/primordialweave/zhusuan/internal/models"
	"github.com/stretchr/testify/require"
)

func TestDesktopSummaryDoesNotOffsetUnpaidContractsWithOverpaidContracts(t *testing.T) {
	user := contractTestUser(t, 22170)
	input := contractTestInput(user.ID)
	input.ContractNumber = "DESKTOP-SUMMARY-OVERPAID"
	overpaid := insertContractProject(t, input)
	input.ContractNumber = "DESKTOP-SUMMARY-UNPAID"
	insertContractProject(t, input)
	actual := time.Now()
	require.NoError(t, database.GetDB().Create(&models.Payment{UserID: user.ID, ProjectID: overpaid.ID, Amount: 3000, Status: "confirmed", Stage: "receipt", PlanDate: actual, ActualDate: &actual}).Error)
	summary, err := NewDashboardService().GetDesktopSummary(user.ID)
	require.NoError(t, err)
	require.Equal(t, 1000.0, summary.TotalPending)
	require.Equal(t, 3000.0, summary.MonthReceived)
}
