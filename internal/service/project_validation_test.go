package service

import (
	"testing"

	"github.com/primordialweave/zhusuan/internal/database"
	"github.com/primordialweave/zhusuan/internal/models"
	pkgerrors "github.com/primordialweave/zhusuan/internal/pkg/errors"
	"github.com/stretchr/testify/require"
)

func TestProjectWritesRejectReversedDatesAndPreserveOmittedStatus(t *testing.T) {
	user := contractTestUser(t, 22180)
	input := contractTestInput(user.ID)
	project := insertContractProject(t, input)
	svc := NewProjectService()
	invalid := input
	invalid.ContractNumber = "REVERSED-DATES"
	invalid.EndDate = "2000-01-01"
	_, err := svc.Create(invalid)
	require.Error(t, err)
	require.Equal(t, 400, pkgerrors.GetHTTPCode(err))
	var count int64
	require.NoError(t, database.GetDB().Model(&models.Project{}).Where("user_id = ? AND contract_number = ?", user.ID, invalid.ContractNumber).Count(&count).Error)
	require.Zero(t, count)
	_, err = svc.UpdateForUser(user.ID, project.ID, invalid)
	require.Error(t, err)
	require.Equal(t, 400, pkgerrors.GetHTTPCode(err))
	current, err := svc.GetForUser(user.ID, project.ID)
	require.NoError(t, err)
	require.Equal(t, project.StartDate, current.StartDate)
	require.Equal(t, project.EndDate, current.EndDate)
	input.Status = ""
	input.Name = "Updated without status"
	updated, err := svc.UpdateForUser(user.ID, project.ID, input)
	require.NoError(t, err)
	require.Equal(t, "active", updated.Status)
}
