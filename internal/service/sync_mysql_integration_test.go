package service

import (
	"context"
	"database/sql"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/go-sql-driver/mysql"
	"github.com/primordialweave/zhusuan/internal/models"
	"github.com/stretchr/testify/require"
)

func TestSyncMySQLMirrorPrimaryKeySafetyIntegration(t *testing.T) {
	rawDSN := os.Getenv("ZHUSUAN_SYNC_MYSQL_TEST_DSN")
	if rawDSN == "" {
		t.Skip("set ZHUSUAN_SYNC_MYSQL_TEST_DSN to an isolated disposable schema to run MySQL integration coverage")
	}

	config, err := mysql.ParseDSN(rawDSN)
	require.NoError(t, err)
	require.True(t, strings.HasPrefix(config.DBName, "zhusuan_sync_qa_"), "integration tests only run against a named disposable QA schema")
	config.ClientFoundRows = true
	dsn := config.FormatDSN()

	remote, err := sql.Open(mysqlDialect, dsn)
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, remote.Close()) })
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	require.NoError(t, remote.PingContext(ctx))

	service := NewSyncService()
	type remoteUser struct {
		ID            int64
		Username      string
		Password      string
		Name          string
		LastLoginTime *time.Time
	}
	resetRemoteUsers := func() {
		t.Helper()
		_, dropErr := remote.ExecContext(ctx, "DROP TABLE IF EXISTS `users`")
		require.NoError(t, dropErr)
		require.NoError(t, service.ensureRemoteTables(ctx, remote, mysqlDialect, []string{syncTableUsers}))
	}
	t.Cleanup(func() {
		_, cleanupErr := remote.ExecContext(context.Background(), "DROP TABLE IF EXISTS `users`")
		require.NoError(t, cleanupErr)
		_, cleanupErr = remote.ExecContext(context.Background(), "DROP TABLE IF EXISTS `projects`")
		require.NoError(t, cleanupErr)
	})
	readRemoteUsers := func() map[int64]remoteUser {
		t.Helper()
		rows, queryErr := remote.QueryContext(ctx, "SELECT id, username, password, name, last_login_time FROM users ORDER BY id")
		require.NoError(t, queryErr)
		defer rows.Close()
		result := make(map[int64]remoteUser)
		for rows.Next() {
			var user remoteUser
			require.NoError(t, rows.Scan(&user.ID, &user.Username, &user.Password, &user.Name, &user.LastLoginTime))
			result[user.ID] = user
		}
		require.NoError(t, rows.Err())
		return result
	}

	t.Run("secondary unique key conflict cannot redirect the update or delete the row", func(t *testing.T) {
		local := syncRecordFixture(t)
		resetRemoteUsers()
		_, err := remote.ExecContext(ctx, "INSERT INTO users(id, username, password, name) VALUES (99, 'shared-name', 'remote-hash', 'Remote owner')")
		require.NoError(t, err)
		require.NoError(t, local.Create(&models.User{ID: 2, Username: "shared-name", Password: "local-hash", Name: "Local owner", Role: "user", Status: 1}).Error)

		tx, err := remote.BeginTx(ctx, nil)
		require.NoError(t, err)
		results, err := service.syncTablesInTransaction(ctx, local, tx, mysqlDialect, []string{syncTableUsers})
		require.NoError(t, err)
		require.Len(t, results, 1)
		require.False(t, results[0].Success)
		users := readRemoteUsers()
		require.Len(t, users, 1)
		require.Equal(t, "Remote owner", users[99].Name)
		require.Equal(t, "remote-hash", users[99].Password)
	})

	t.Run("same id update and new id insert retain found rows and prune cloud-only rows", func(t *testing.T) {
		local := syncRecordFixture(t)
		resetRemoteUsers()
		now := time.Date(2026, 11, 20, 10, 30, 0, 0, time.UTC)
		_, err := remote.ExecContext(ctx, "INSERT INTO users(id, username, password, name, role, status) VALUES (2, 'existing', 'old-hash', 'Before', 'user', 1), (99, 'cloud-only', 'cloud-hash', 'Cloud only', 'user', 1)")
		require.NoError(t, err)
		require.NoError(t, local.Create(&models.User{ID: 2, Username: "existing", Password: "new-hash", Name: "After", Role: "user", Status: 1, LastLoginTime: &now}).Error)
		require.NoError(t, local.Create(&models.User{ID: 3, Username: "new", Password: "insert-hash", Name: "New user", Role: "user", Status: 1}).Error)

		tx, err := remote.BeginTx(ctx, nil)
		require.NoError(t, err)
		results, err := service.syncTablesInTransaction(ctx, local, tx, mysqlDialect, []string{syncTableUsers})
		require.NoError(t, err)
		require.True(t, results[0].Success)
		require.Equal(t, int64(2), results[0].SyncedCount)
		users := readRemoteUsers()
		require.Len(t, users, 2)
		require.Equal(t, "After", users[2].Name)
		require.Equal(t, "new-hash", users[2].Password)
		require.NotNil(t, users[2].LastLoginTime)
		require.True(t, users[2].LastLoginTime.Equal(now))
		require.Equal(t, "New user", users[3].Name)

		unchangedTx, err := remote.BeginTx(ctx, nil)
		require.NoError(t, err)
		unchangedResults, err := service.syncTablesInTransaction(ctx, local, unchangedTx, mysqlDialect, []string{syncTableUsers})
		require.NoError(t, err)
		require.True(t, unchangedResults[0].Success, "identical rows must match by ID instead of falling through to INSERT")
	})

	t.Run("an actually missing table is classified separately from query failures", func(t *testing.T) {
		var count int64
		err := remote.QueryRowContext(ctx, "SELECT COUNT(*) FROM table_that_is_not_present").Scan(&count)
		require.Error(t, err)
		require.True(t, isRemoteTableMissing(err))
	})

	t.Run("an empty mirrorable business table clears its remote rows", func(t *testing.T) {
		local := syncRecordFixture(t)
		_, err := remote.ExecContext(ctx, "DROP TABLE IF EXISTS `projects`")
		require.NoError(t, err)
		require.NoError(t, service.ensureRemoteTables(ctx, remote, mysqlDialect, []string{syncTableProjects}))
		_, err = remote.ExecContext(ctx, "INSERT INTO projects(id, name, company, total_amount, status, type, start_date, end_date, user_id) VALUES (99, 'Cloud only', 'Customer', 10, 'active', 'service', '2026-01-01', '2026-12-31', 1)")
		require.NoError(t, err)

		tx, err := remote.BeginTx(ctx, nil)
		require.NoError(t, err)
		results, err := service.syncTablesInTransaction(ctx, local, tx, mysqlDialect, []string{syncTableProjects})
		require.NoError(t, err)
		require.True(t, results[0].Success)
		var count int64
		require.NoError(t, remote.QueryRowContext(ctx, "SELECT COUNT(*) FROM projects").Scan(&count))
		require.Zero(t, count)
	})
}
