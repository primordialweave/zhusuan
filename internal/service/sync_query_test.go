package service

import (
	"context"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestBuildPostgresUpsertQueryRejectsUnknownTable(t *testing.T) {
	service := NewSyncService()

	_, err := service.buildPostgresUpsertQuery("users; DROP TABLE users")

	require.Error(t, err)
}

func TestBuildPostgresUpsertQueryUsesFixedTableDefinition(t *testing.T) {
	service := NewSyncService()

	query, err := service.buildPostgresUpsertQuery("users")

	require.NoError(t, err)
	require.Contains(t, query, `INSERT INTO "users"`)
	require.Contains(t, query, `"username" = EXCLUDED."username"`)
	require.NotContains(t, strings.ToLower(query), "drop table")
}

func TestEnsureRemoteTablesBuildsDDLForAllWhitelistedTables(t *testing.T) {
	service := NewSyncService()
	_, err := service.buildCreateTableQuery("users; DROP TABLE users", "postgres")
	require.Error(t, err)

	tables := []string{
		syncTableUsers,
		syncTableProjects,
		syncTablePayments,
		syncTableDictionaries,
		syncTableDictionaryItems,
		syncTableNotifications,
		syncTableUserNotifications,
		syncTablePersonalAccessTokens,
	}

	for _, dbType := range []string{postgresDialect, mysqlDialect} {
		exec := &captureSyncExecutor{}
		require.NoError(t, service.ensureRemoteTables(context.Background(), exec, dbType, tables))
		require.Len(t, exec.calls, len(tables))

		for i, table := range tables {
			ddl := exec.calls[i].query
			require.True(t, strings.HasPrefix(ddl, "CREATE TABLE IF NOT EXISTS "), "unexpected DDL prefix: %s", ddl)
			for _, col := range syncTableColumns[table] {
				require.Contains(t, ddl, service.quoteColumn(col, dbType), "table %s (%s) DDL missing column %s", table, dbType, col)
			}
		}
	}
}
