package main

import (
	"path/filepath"
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/primordialweave/zhusuan/internal/models"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func TestSQLiteIndexDefinitionsMatchCurrentSchemaAndOptionalEmail(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "indexes.db")), &gorm.Config{Logger: logger.Discard})
	require.NoError(t, err)
	raw, err := db.DB()
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, raw.Close()) })
	require.NoError(t, db.AutoMigrate(&models.User{}, &models.Project{}, &models.Payment{}, &models.Notification{}, &models.UserNotification{}))
	require.NoError(t, db.Create(&[]models.User{{Username: "email-empty-one", Password: "fixture"}, {Username: "email-empty-two", Password: "fixture"}}).Error)
	for _, group := range indexGroups {
		require.NoError(t, addIndexGroup(db, group))
	}
	require.Error(t, addIndexGroup(db, indexGroup{indexes: []indexSpec{{name: "invalid-fixture", statement: "CREATE INDEX invalid_fixture ON missing_table(id)"}}}))
}
