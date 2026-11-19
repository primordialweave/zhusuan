package service

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"errors"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"github.com/primordialweave/zhusuan/internal/models"
)

type capturedSyncCall struct {
	query string
	args  []interface{}
}

type captureSyncExecutor struct {
	calls      []capturedSyncCall
	failInsert bool
}

func (e *captureSyncExecutor) ExecContext(_ context.Context, query string, args ...interface{}) (sql.Result, error) {
	e.calls = append(e.calls, capturedSyncCall{query: query, args: append([]interface{}(nil), args...)})
	if e.failInsert && strings.HasPrefix(query, "INSERT") {
		return nil, errors.New("fixture insert failure")
	}
	return driver.RowsAffected(1), nil
}

func syncRecordFixture(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "sync.sqlite")), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatal(err)
	}
	raw, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if err := raw.Close(); err != nil {
			t.Error(err)
		}
	})
	if err := db.AutoMigrate(&models.User{}, &models.Project{}, &models.Payment{}); err != nil {
		t.Fatal(err)
	}
	return db
}

func TestSyncUserAndPaymentBindingsKeepColumnOrderAndCleanupIDs(t *testing.T) {
	db := syncRecordFixture(t)
	user := models.User{ID: 42, Username: "sync-fixture", Password: "fixture-hash", Name: "Fixture", Email: "sync@example.invalid", Phone: "123", Avatar: "avatar", Role: "user", Department: "team", Position: "role", Status: 1}
	if err := db.Create(&user).Error; err != nil {
		t.Fatal(err)
	}
	project := models.Project{ID: 31, Name: "Fixture", Company: "Fixture", ContractNumber: "SYNC-FIXTURE", TotalAmount: 100, UserID: user.ID}
	if err := db.Create(&project).Error; err != nil {
		t.Fatal(err)
	}
	payment := models.Payment{ID: 44, ProjectID: project.ID, Stage: "progress", Amount: 12.5, Percentage: 25, PlanDate: time.Date(2026, 11, 19, 0, 0, 0, 0, time.UTC), Status: "pending", Method: "bank_transfer", Remark: "memo", UserID: user.ID}
	if err := db.Create(&payment).Error; err != nil {
		t.Fatal(err)
	}
	service := NewSyncService()
	users := &captureSyncExecutor{}
	if count, message := service.syncUsers(context.Background(), db, users, "postgres"); count != 1 || message != "" {
		t.Fatalf("user sync=%d %s", count, message)
	}
	wantUser := []interface{}{user.ID, user.Username, user.Password, user.Name, user.Email, user.Phone, user.Avatar, user.Role, user.Department, user.Position, user.Status}
	if len(users.calls) != 2 || !reflect.DeepEqual(users.calls[0].args[:11], wantUser) || !reflect.DeepEqual(users.calls[1].args, []interface{}{user.ID}) {
		t.Fatal("user sync changed value order or cleanup IDs")
	}
	payments := &captureSyncExecutor{}
	if count, message := service.syncPayments(context.Background(), db, payments, "postgres"); count != 1 || message != "" {
		t.Fatalf("payment sync=%d %s", count, message)
	}
	wantPayment := []interface{}{payment.ID, payment.ProjectID, payment.Stage, payment.Amount, payment.Percentage, payment.PlanDate, payment.Status, payment.ActualDate, payment.Method, payment.Remark, payment.UserID}
	if len(payments.calls) != 2 || !reflect.DeepEqual(payments.calls[0].args[:11], wantPayment) || !reflect.DeepEqual(payments.calls[1].args, []interface{}{payment.ID}) {
		t.Fatal("payment sync changed value order or cleanup IDs")
	}
}

func TestSyncRecordsNeverCleanupAfterInsertFailureOrEmptyLocalIDs(t *testing.T) {
	db := syncRecordFixture(t)
	service := NewSyncService()
	empty := &captureSyncExecutor{}
	if count, message := service.syncUsers(context.Background(), db, empty, "postgres"); count != 0 || !strings.Contains(message, "local ID list is empty") {
		t.Fatalf("empty sync=%d %s", count, message)
	}
	if len(empty.calls) != 0 {
		t.Fatal("empty local table issued a destructive remote query")
	}
	user := models.User{ID: 55, Username: "failure-fixture", Password: "fixture", Role: "user", Status: 1}
	if err := db.Create(&user).Error; err != nil {
		t.Fatal(err)
	}
	failed := &captureSyncExecutor{failInsert: true}
	if count, message := service.syncUsers(context.Background(), db, failed, "postgres"); count != 0 || !strings.Contains(message, "fixture insert failure") {
		t.Fatalf("failed sync=%d %s", count, message)
	}
	if len(failed.calls) != 1 {
		t.Fatal("insert failure proceeded to remote cleanup")
	}
}
