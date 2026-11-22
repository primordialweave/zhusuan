package service

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/primordialweave/zhusuan/internal/database"
	"github.com/primordialweave/zhusuan/internal/dto"
	"github.com/primordialweave/zhusuan/internal/models"
	pkgerrors "github.com/primordialweave/zhusuan/internal/pkg/errors"
)

func receiptWriteInput(t *testing.T, userID, projectID int64, body string) dto.PaymentRequest {
	t.Helper()
	var input dto.PaymentRequest
	require.NoError(t, json.Unmarshal([]byte(body), &input))
	input.UserID, input.ProjectID = userID, projectID
	return input
}

func TestReceiptWriteCreatesActualReceiptWithoutPlan(t *testing.T) {
	user := contractTestUser(t, 22001)
	project := insertContractProject(t, contractTestInput(user.ID))
	input := receiptWriteInput(t, user.ID, project.ID, `{"amount":500,"actual_date":"2026-11-22","status":"confirmed","method":"bank_transfer"}`)
	receipt, err := NewPaymentService().Create(input)
	require.NoError(t, err)
	require.Equal(t, "all", receipt.Stage)
	require.Equal(t, "confirmed", receipt.Status)
	require.NotNil(t, receipt.ActualDate)
	require.Equal(t, "2026-11-22", receipt.ActualDate.Format("2006-01-02"))
	require.Equal(t, "2026-11-22", receipt.PlanDate.Format("2006-01-02"))
	var saved models.Project
	require.NoError(t, database.GetDB().First(&saved, project.ID).Error)
	require.Equal(t, 500.0, saved.ReceivedAmount)
}

func TestReceiptWriteEditsActualDateAndPreservesItWhenOmitted(t *testing.T) {
	user := contractTestUser(t, 22002)
	project := insertContractProject(t, contractTestInput(user.ID))
	svc := NewPaymentService()
	created, err := svc.Create(receiptWriteInput(t, user.ID, project.ID, `{"amount":100,"stage":"final","plan_date":"2026-11-01","status":"confirmed"}`))
	require.NoError(t, err)
	updated, err := svc.UpdateForUser(user.ID, created.ID, receiptWriteInput(t, user.ID, project.ID, `{"amount":200,"actual_date":"2026-11-23","status":"confirmed"}`))
	require.NoError(t, err)
	require.Equal(t, "2026-11-23", updated.ActualDate.Format("2006-01-02"))
	require.Equal(t, "2026-11-01", updated.PlanDate.Format("2006-01-02"))
	require.Equal(t, "final", updated.Stage)
	updated, err = svc.UpdateForUser(user.ID, created.ID, receiptWriteInput(t, user.ID, project.ID, `{"amount":300,"status":"confirmed"}`))
	require.NoError(t, err)
	require.Equal(t, "2026-11-23", updated.ActualDate.Format("2006-01-02"))
	require.Equal(t, "final", updated.Stage)
}

func TestReceiptWriteLegacyPendingDoesNotBecomeReceived(t *testing.T) {
	user := contractTestUser(t, 22003)
	project := insertContractProject(t, contractTestInput(user.ID))
	svc := NewPaymentService()
	for _, status := range []string{"pending", "overdue"} {
		input := receiptWriteInput(t, user.ID, project.ID, `{"amount":100,"plan_date":"2026-11-01","stage":"deposit"}`)
		input.Status = status
		created, err := svc.Create(input)
		require.NoError(t, err)
		require.Equal(t, status, created.Status)
		require.Nil(t, created.ActualDate)
		updated, err := svc.UpdateForUser(user.ID, created.ID, receiptWriteInput(t, user.ID, project.ID, `{"amount":200}`))
		require.NoError(t, err)
		require.Equal(t, status, updated.Status)
		require.Nil(t, updated.ActualDate)
	}
	var saved models.Project
	require.NoError(t, database.GetDB().First(&saved, project.ID).Error)
	require.Zero(t, saved.ReceivedAmount)
}

func TestReceiptWriteRejectsInvalidActualDateWithoutMutation(t *testing.T) {
	user := contractTestUser(t, 22004)
	project := insertContractProject(t, contractTestInput(user.ID))
	svc := NewPaymentService()
	created, err := svc.Create(receiptWriteInput(t, user.ID, project.ID, `{"amount":100,"plan_date":"2026-11-01","stage":"all","status":"confirmed"}`))
	require.NoError(t, err)
	for _, date := range []string{"2026-11-22T00:00:00Z", "2026-02-30", "invalid"} {
		input := receiptWriteInput(t, user.ID, project.ID, `{"amount":200,"plan_date":"2026-11-01","stage":"all","status":"confirmed","actual_date":"`+date+`"}`)
		_, err = svc.Create(input)
		require.Error(t, err)
		require.Equal(t, 400, pkgerrors.GetHTTPCode(err))
		_, err = svc.UpdateForUser(user.ID, created.ID, input)
		require.Error(t, err)
		require.Equal(t, 400, pkgerrors.GetHTTPCode(err))
	}
	var unchanged models.Payment
	require.NoError(t, database.GetDB().First(&unchanged, created.ID).Error)
	require.Equal(t, 100.0, unchanged.Amount)
	require.Equal(t, "2026-11-01", unchanged.ActualDate.Format("2006-01-02"))
}
