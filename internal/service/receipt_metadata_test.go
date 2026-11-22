package service

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/primordialweave/zhusuan/internal/database"
	"github.com/primordialweave/zhusuan/internal/dto"
	"github.com/primordialweave/zhusuan/internal/models"
)

func TestReceiptProjectMetadataPreservesPaymentAuditTime(t *testing.T) {
	user := contractTestUser(t, 44001)
	input := contractTestInput(user.ID)
	input.TotalAmount = 4000
	project, err := NewProjectService().Create(input)
	require.NoError(t, err)
	input.ContractNumber, input.Status = project.ContractNumber, project.Status
	payment, err := NewPaymentService().Create(dto.PaymentRequest{
		ProjectID: project.ID, UserID: user.ID, Amount: 500,
		ActualDate: "2026-11-22", Status: "confirmed",
	})
	require.NoError(t, err)
	oldTime := time.Date(2020, 2, 3, 4, 5, 6, 0, time.UTC)
	require.NoError(t, database.GetDB().Model(payment).UpdateColumn("update_time", oldTime).Error)

	input.Name = "只修改项目名称"
	_, err = NewProjectService().UpdateForUser(user.ID, project.ID, input)
	require.NoError(t, err)
	var unchanged models.Payment
	require.NoError(t, database.GetDB().First(&unchanged, payment.ID).Error)
	require.True(t, unchanged.UpdateTime.Equal(oldTime), "metadata edits must not touch receipt audit time")
	require.Equal(t, 12.5, unchanged.Percentage)
	require.NotNil(t, unchanged.ActualDate)
	require.True(t, payment.ActualDate.Equal(*unchanged.ActualDate))

	input.TotalAmount = 8000
	_, err = NewProjectService().UpdateForUser(user.ID, project.ID, input)
	require.NoError(t, err)
	var rescaled models.Payment
	require.NoError(t, database.GetDB().First(&rescaled, payment.ID).Error)
	require.Equal(t, 6.25, rescaled.Percentage)
	require.NotNil(t, rescaled.ActualDate)
	require.True(t, payment.ActualDate.Equal(*rescaled.ActualDate))
	require.Equal(t, payment.Amount, rescaled.Amount)
}
