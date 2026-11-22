package service

import (
	"errors"
	"fmt"
	"strings"
	"testing"
	"time"

	mysqlDriver "github.com/go-sql-driver/mysql"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"

	"github.com/primordialweave/zhusuan/internal/database"
	"github.com/primordialweave/zhusuan/internal/dto"
	"github.com/primordialweave/zhusuan/internal/models"
	pkgerrors "github.com/primordialweave/zhusuan/internal/pkg/errors"
)

func contractTestInput(userID int64) dto.CreateProjectRequest {
	return dto.CreateProjectRequest{
		Name: "合同编号回归", Company: "演示客户", TotalAmount: 1000, Type: "test",
		StartDate: "2026-11-01", EndDate: "2026-12-01", ContractDate: "2026-11-22",
		UserID: userID,
	}
}

func contractTestUser(t *testing.T, id int64) *models.User {
	t.Helper()
	setupProjectTestDB(t)
	user := createTestUser(t, id, fmt.Sprintf("contract-%d", id))
	t.Cleanup(func() {
		db := database.GetDB()
		require.NoError(t, db.Where("user_id = ?", id).Delete(&models.Payment{}).Error)
		require.NoError(t, db.Where("user_id = ?", id).Delete(&models.Project{}).Error)
		require.NoError(t, db.Delete(&models.User{}, id).Error)
		invalidateDashboardCache(id)
	})
	return user
}

func insertContractProject(t *testing.T, input dto.CreateProjectRequest) *models.Project {
	t.Helper()
	start, err := time.Parse("2006-01-02", input.StartDate)
	require.NoError(t, err)
	end, err := time.Parse("2006-01-02", input.EndDate)
	require.NoError(t, err)
	project := &models.Project{
		Name: input.Name, Company: input.Company, TotalAmount: input.TotalAmount,
		Type: input.Type, Status: "active", UserID: input.UserID,
		ContractNumber: input.ContractNumber, StartDate: start, EndDate: end,
	}
	require.NoError(t, database.GetDB().Create(project).Error)
	return project
}

func TestProjectContractEmptyCreatesDistinctNumbers(t *testing.T) {
	user := contractTestUser(t, 21001)
	svc := NewProjectService()
	input := contractTestInput(user.ID)
	first, err := svc.Create(input)
	require.NoError(t, err)
	assert.Equal(t, "HT202611220001", first.ContractNumber)
	second, err := svc.Create(input)
	require.NoError(t, err)
	assert.Equal(t, "HT202611220002", second.ContractNumber)
}

func TestProjectContractWhitespaceCreatesDistinctNumbers(t *testing.T) {
	user := contractTestUser(t, 21002)
	svc := NewProjectService()
	input := contractTestInput(user.ID)
	input.ContractNumber = " \t\n "
	first, err := svc.Create(input)
	require.NoError(t, err)
	assert.Equal(t, "HT202611220001", first.ContractNumber)
	second, err := svc.Create(input)
	require.NoError(t, err)
	assert.Equal(t, "HT202611220002", second.ContractNumber)
}

func TestProjectContractLegacyEmptyDoesNotBlockCreate(t *testing.T) {
	user := contractTestUser(t, 21003)
	input := contractTestInput(user.ID)
	legacy := insertContractProject(t, input)
	created, err := NewProjectService().Create(input)
	require.NoError(t, err)
	assert.Equal(t, "HT202611220001", created.ContractNumber)
	var unchanged models.Project
	require.NoError(t, database.GetDB().First(&unchanged, legacy.ID).Error)
	assert.Empty(t, unchanged.ContractNumber)
}

func TestProjectContractMissingDateUsesStartDate(t *testing.T) {
	user := contractTestUser(t, 21004)
	input := contractTestInput(user.ID)
	input.ContractDate = ""
	created, err := NewProjectService().Create(input)
	require.NoError(t, err)
	assert.Equal(t, "HT202611010001", created.ContractNumber)
	assert.Nil(t, created.ContractDate)
}

func TestProjectContractUpdateEmptyWithLegacyEmpty(t *testing.T) {
	user := contractTestUser(t, 21005)
	input := contractTestInput(user.ID)
	insertContractProject(t, input)
	input.ContractNumber = "MANUAL-KEEP"
	current := insertContractProject(t, input)
	input.ContractNumber = " \t "
	updated, err := NewProjectService().UpdateForUser(user.ID, current.ID, input)
	require.NoError(t, err)
	assert.Equal(t, "HT202611220001", updated.ContractNumber)
	input.ContractNumber = ""
	updated, err = NewProjectService().UpdateForUser(user.ID, current.ID, input)
	require.NoError(t, err)
	assert.Equal(t, "HT202611220002", updated.ContractNumber)
}

func TestProjectContractManualNumberPreservedAndDuplicateRejected(t *testing.T) {
	user := contractTestUser(t, 21006)
	input := contractTestInput(user.ID)
	input.ContractNumber = "CUSTOM-2026-001"
	svc := NewProjectService()
	first, err := svc.Create(input)
	require.NoError(t, err)
	assert.Equal(t, input.ContractNumber, first.ContractNumber)
	_, err = svc.Create(input)
	require.ErrorIs(t, err, pkgerrors.ErrContractDuplicate)
}

// Insert after the uniqueness read but before Create starts its transaction.
// This makes a competing writer deterministic without scheduling sleeps.
func installContractCreateRace(t *testing.T, userID int64, matchingNumber string) *int {
	t.Helper()
	db := database.GetDB()
	insertions := 0
	callbackName := "test:contract-race:" + t.Name()
	require.NoError(t, db.Callback().Create().Before("gorm:begin_transaction").Register(callbackName, func(tx *gorm.DB) {
		project, ok := tx.Statement.Dest.(*models.Project)
		if !ok || project.UserID != userID || project.Name != "合同编号回归" {
			return
		}
		if matchingNumber != "" && project.ContractNumber != matchingNumber {
			return
		}
		insertions++
		input := contractTestInput(userID)
		input.Name = "竞争写入"
		input.ContractNumber = project.ContractNumber
		insertContractProject(t, input)
	}))
	t.Cleanup(func() { require.NoError(t, db.Callback().Create().Remove(callbackName)) })
	return &insertions
}

func TestProjectContractCreateRetriesGeneratedConflict(t *testing.T) {
	user := contractTestUser(t, 21007)
	insertions := installContractCreateRace(t, user.ID, "HT202611220001")
	created, err := NewProjectService().Create(contractTestInput(user.ID))
	require.NoError(t, err)
	assert.Equal(t, 1, *insertions)
	assert.Equal(t, "HT202611220002", created.ContractNumber)
}

func TestProjectContractCreateRaceReturnsDuplicateForManualNumber(t *testing.T) {
	user := contractTestUser(t, 21008)
	input := contractTestInput(user.ID)
	input.ContractNumber = "MANUAL-RACE"
	insertions := installContractCreateRace(t, user.ID, input.ContractNumber)
	_, err := NewProjectService().Create(input)
	require.ErrorIs(t, err, pkgerrors.ErrContractDuplicate)
	assert.Equal(t, 1, *insertions)
}

func TestProjectContractCreateGeneratedConflictRetriesAreBounded(t *testing.T) {
	user := contractTestUser(t, 21009)
	insertions := installContractCreateRace(t, user.ID, "")
	_, err := NewProjectService().Create(contractTestInput(user.ID))
	require.ErrorIs(t, err, pkgerrors.ErrContractDuplicate)
	assert.Equal(t, 3, *insertions)
}

func TestProjectContractCreateOtherWriteErrorRemainsInternal(t *testing.T) {
	user := contractTestUser(t, 21010)
	db := database.GetDB()
	callbackName := "test:contract-write-error:" + t.Name()
	writeErr := errors.New("simulated disk failure")
	attempts := 0
	require.NoError(t, db.Callback().Create().Before("gorm:create").Register(callbackName, func(tx *gorm.DB) {
		if project, ok := tx.Statement.Dest.(*models.Project); ok && project.UserID == user.ID {
			attempts++
			tx.AddError(writeErr)
		}
	}))
	t.Cleanup(func() { require.NoError(t, db.Callback().Create().Remove(callbackName)) })
	_, err := NewProjectService().Create(contractTestInput(user.ID))
	require.ErrorIs(t, err, writeErr)
	assert.Equal(t, 500, pkgerrors.GetHTTPCode(err))
	assert.Equal(t, 1, attempts)
	assert.False(t, strings.Contains(err.Error(), "合同编号已存在"))
}

func TestProjectContractGenerateIgnoresNonNumericSuffix(t *testing.T) {
	user := contractTestUser(t, 21011)
	input := contractTestInput(user.ID)
	for _, number := range []string{"HT202611220001", "HT20261122CUSTOM", "HT202611229999-X"} {
		input.ContractNumber = number
		insertContractProject(t, input)
	}
	input.ContractNumber = ""
	created, err := NewProjectService().Create(input)
	require.NoError(t, err)
	assert.Equal(t, "HT202611220002", created.ContractNumber)
}

func TestProjectContractGenerateBeyondFourDigitSequence(t *testing.T) {
	user := contractTestUser(t, 21012)
	input := contractTestInput(user.ID)
	input.ContractNumber = "HT202611229999"
	insertContractProject(t, input)
	input.ContractNumber = ""
	svc := NewProjectService()
	first, err := svc.Create(input)
	require.NoError(t, err)
	assert.Equal(t, "HT2026112210000", first.ContractNumber)
	second, err := svc.Create(input)
	require.NoError(t, err)
	assert.Equal(t, "HT2026112210001", second.ContractNumber)
}

func TestProjectContractDuplicateTranslationAcrossDrivers(t *testing.T) {
	user := contractTestUser(t, 21013)
	input := contractTestInput(user.ID)
	input.ContractNumber = "SQLITE-DUPLICATE"
	project := insertContractProject(t, input)
	copy := *project
	copy.ID = 0
	sqliteErr := database.GetDB().Create(&copy).Error
	require.Error(t, sqliteErr)
	for _, tc := range []struct {
		name      string
		dialector gorm.Dialector
		err       error
		duplicate bool
	}{
		{"sqlite", database.GetDB().Dialector, sqliteErr, true},
		{"wrapped sqlite", database.GetDB().Dialector, fmt.Errorf("wrapped: %w", sqliteErr), true},
		{"mysql", mysql.Open(""), &mysqlDriver.MySQLError{Number: 1062}, true},
		{"mysql foreign key", mysql.Open(""), &mysqlDriver.MySQLError{Number: 1452}, false},
		{"postgres", postgres.Open(""), &pgconn.PgError{Code: "23505"}, true},
		{"postgres foreign key", postgres.Open(""), &pgconn.PgError{Code: "23503"}, false},
		{"translated", database.GetDB().Dialector, gorm.ErrDuplicatedKey, true},
		{"other failure", database.GetDB().Dialector, errors.New("write failed"), false},
		{"nil", database.GetDB().Dialector, nil, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.duplicate, isDuplicateDatabaseError(tc.dialector, tc.err))
		})
	}
}

func TestProjectContractOtherUniqueKeyRemainsInternal(t *testing.T) {
	user := contractTestUser(t, 21014)
	input := contractTestInput(user.ID)
	input.ContractNumber = "EXISTING"
	current := insertContractProject(t, input)
	input.ContractNumber = "OTHER-NUMBER"
	db := database.GetDB()
	callbackName := "test:contract-primary-key:" + t.Name()
	require.NoError(t, db.Callback().Create().Before("gorm:create").Register(callbackName, func(tx *gorm.DB) {
		if project, ok := tx.Statement.Dest.(*models.Project); ok && project.UserID == user.ID {
			project.ID = current.ID
		}
	}))
	t.Cleanup(func() { require.NoError(t, db.Callback().Create().Remove(callbackName)) })
	_, err := NewProjectService().Create(input)
	require.Error(t, err)
	assert.Equal(t, 500, pkgerrors.GetHTTPCode(err))
	assert.NotErrorIs(t, err, pkgerrors.ErrContractDuplicate)
}

func TestProjectContractGenerateNormalizesLeadingZeroes(t *testing.T) {
	user := contractTestUser(t, 21015)
	input := contractTestInput(user.ID)
	for _, number := range []string{"HT202611229999", "HT202611220000001"} {
		input.ContractNumber = number
		insertContractProject(t, input)
	}
	input.ContractNumber = ""
	created, err := NewProjectService().Create(input)
	require.NoError(t, err)
	assert.Equal(t, "HT2026112210000", created.ContractNumber)
}
