package service

import (
	"context"
	"errors"
	"net"
	"testing"

	"github.com/go-sql-driver/mysql"
	"github.com/primordialweave/zhusuan/internal/models"
	"github.com/stretchr/testify/require"
)

type captureSyncTransaction struct {
	captureSyncExecutor
	commits, rollbacks     int
	commitErr, rollbackErr error
}

func (tx *captureSyncTransaction) Commit() error   { tx.commits++; return tx.commitErr }
func (tx *captureSyncTransaction) Rollback() error { tx.rollbacks++; return tx.rollbackErr }

func TestSyncTransactionMarksEarlierTablesUnsuccessfulAfterLaterFailure(t *testing.T) {
	db := syncRecordFixture(t)
	require.NoError(t, db.Create(&models.User{ID: 701, Username: "transaction-fixture", Password: "fixture-hash", Status: 1}).Error)
	require.NoError(t, db.Create(&models.Project{ID: 701, UserID: 701, Name: "fixture", ContractNumber: "TX-1", Status: "active"}).Error)
	service := NewSyncService()
	tx := &captureSyncTransaction{}
	results, err := service.syncTablesInTransaction(context.Background(), db, tx, "postgres", []string{"users", "projects", "dictionaries"})
	require.NoError(t, err)
	require.Len(t, results, 3)
	require.Equal(t, 0, tx.commits)
	require.Equal(t, 1, tx.rollbacks)
	for _, result := range results {
		require.False(t, result.Success)
		require.Zero(t, result.SyncedCount)
		require.Equal(t, "同步失败，本次事务已回滚", result.ErrorMessage)
		require.NotContains(t, result.ErrorMessage, "local ID")
	}
}

func TestSyncTransactionSucceedsWhenOptionalTablesAreEmpty(t *testing.T) {
	db := syncRecordFixture(t)
	require.NoError(t, db.Create(&models.User{ID: 710, Username: "optional-empty-user", Password: "fixture-hash", Status: 1}).Error)
	service := NewSyncService()
	tx := &captureSyncTransaction{}
	tables := []string{"users", "projects", "payments", "notifications", "user_notifications", "personal_access_tokens"}
	results, err := service.syncTablesInTransaction(context.Background(), db, tx, "postgres", tables)
	require.NoError(t, err)
	require.Len(t, results, len(tables))
	require.Equal(t, 1, tx.commits)
	require.Zero(t, tx.rollbacks)
	for _, result := range results {
		require.True(t, result.Success, "table %s should succeed when empty", result.TableName)
		require.Empty(t, result.ErrorMessage)
	}
}

func TestSyncTransactionReportsCommitAndRollbackOutcomes(t *testing.T) {
	db := syncRecordFixture(t)
	require.NoError(t, db.Create(&models.User{ID: 702, Username: "transaction-outcome", Password: "fixture-hash", Status: 1}).Error)
	service := NewSyncService()
	t.Run("commit", func(t *testing.T) {
		tx := &captureSyncTransaction{}
		results, err := service.syncTablesInTransaction(context.Background(), db, tx, "postgres", []string{"users"})
		require.NoError(t, err)
		require.True(t, results[0].Success)
		require.Equal(t, int64(1), results[0].SyncedCount)
		require.Equal(t, 1, tx.commits)
		require.Zero(t, tx.rollbacks)
	})
	t.Run("commit failure", func(t *testing.T) {
		tx := &captureSyncTransaction{commitErr: errors.New("fixture commit failure")}
		results, err := service.syncTablesInTransaction(context.Background(), db, tx, "postgres", []string{"users"})
		require.Error(t, err)
		require.False(t, results[0].Success)
		require.Zero(t, results[0].SyncedCount)
		require.Equal(t, 1, tx.commits)
		require.Equal(t, 1, tx.rollbacks)
	})
	t.Run("rollback failure", func(t *testing.T) {
		tx := &captureSyncTransaction{rollbackErr: errors.New("fixture rollback failure")}
		results, err := service.syncTablesInTransaction(context.Background(), db, tx, "postgres", []string{"users", "dictionaries"})
		require.Error(t, err)
		require.Equal(t, 1, tx.rollbacks)
		for _, result := range results {
			require.False(t, result.Success)
			require.NotContains(t, result.ErrorMessage, "已回滚")
		}
	})
}

func TestSyncMySQLDSNPreservesCredentialsAndIPv6Address(t *testing.T) {
	cfg := SyncConfig{DBType: "mysql", Host: "::1", Port: 3306, User: "user-fixture", Password: "pass:word@/() ?", DBName: "book name"}
	parsed, err := mysql.ParseDSN(NewSyncService().buildDSN(cfg))
	require.NoError(t, err)
	require.Equal(t, cfg.User, parsed.User)
	require.Equal(t, cfg.Password, parsed.Passwd)
	require.Equal(t, cfg.DBName, parsed.DBName)
	require.Equal(t, net.JoinHostPort(cfg.Host, "3306"), parsed.Addr)
	require.True(t, parsed.ClientFoundRows, "unchanged updates must still count as matched IDs")
}
