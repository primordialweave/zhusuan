package database

import (
	"bytes"
	"database/sql"
	"errors"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"github.com/primordialweave/zhusuan/internal/config"
	"github.com/primordialweave/zhusuan/internal/models"
)

func seedTransactionFixture(t *testing.T) (*gorm.DB, string, *bytes.Buffer) {
	t.Helper()
	root := t.TempDir()
	previousConfig, previousLogger := config.AppConfig, slog.Default()
	config.AppConfig = &config.Config{DataDir: root}
	logs := &bytes.Buffer{}
	slog.SetDefault(slog.New(slog.NewJSONHandler(logs, nil)))
	t.Cleanup(func() { config.AppConfig = previousConfig; slog.SetDefault(previousLogger) })
	db, err := gorm.Open(sqlite.Open(filepath.Join(root, "seed.db")), &gorm.Config{Logger: logger.Discard})
	require.NoError(t, err)
	raw, err := db.DB()
	require.NoError(t, err)
	raw.SetMaxOpenConns(1)
	t.Cleanup(func() { require.NoError(t, raw.Close()) })
	require.NoError(t, db.AutoMigrate(&models.User{}, &models.Dictionary{}, &models.DictionaryItem{}))
	return db, filepath.Join(root, "initial-credentials.txt"), logs
}

func TestConcurrentSeedPublishesOnlyWinningTransactionCredentials(t *testing.T) {
	db, credentialsPath, logs := seedTransactionFixture(t)
	readersReady := make(chan struct{}, 2)
	releaseReaders, writerReady, releaseWriter := make(chan struct{}), make(chan struct{}), make(chan struct{})
	var readersOnce, writerOnce sync.Once
	defer readersOnce.Do(func() { close(releaseReaders) })
	defer writerOnce.Do(func() { close(releaseWriter) })
	var outerReads atomic.Int32
	require.NoError(t, db.Callback().Query().After("gorm:query").Register("seed_outer_empty_barrier", func(tx *gorm.DB) {
		if tx.Statement.Table != "users" {
			return
		}
		if _, inTransaction := tx.Statement.ConnPool.(*sql.Tx); inTransaction {
			return
		}
		if outerReads.Add(1) <= 2 {
			readersReady <- struct{}{}
			<-releaseReaders
		}
	}))
	var firstWriter sync.Once
	require.NoError(t, db.Callback().Create().Before("gorm:create").Register("seed_first_writer_barrier", func(tx *gorm.DB) {
		if tx.Statement.Table == "users" {
			firstWriter.Do(func() { close(writerReady); <-releaseWriter })
		}
	}))
	errorsReturned := make(chan error, 2)
	received := 0
	defer func() {
		readersOnce.Do(func() { close(releaseReaders) })
		writerOnce.Do(func() { close(releaseWriter) })
		for received < 2 {
			select {
			case <-errorsReturned:
				received++
			case <-time.After(10 * time.Second):
				return
			}
		}
	}()
	for range 2 {
		go func() { errorsReturned <- Seed(db) }()
	}
	for range 2 {
		select {
		case <-readersReady:
		case <-time.After(10 * time.Second):
			t.Fatal("both seed calls must observe the empty database")
		}
	}
	readersOnce.Do(func() { close(releaseReaders) })
	select {
	case <-writerReady:
	case <-time.After(10 * time.Second):
		t.Fatal("first seed transaction did not reach the user write")
	}
	_, statErr := os.Lstat(credentialsPath)
	assert.True(t, errors.Is(statErr, os.ErrNotExist), "credentials must not publish before the winning database writes")
	writerOnce.Do(func() { close(releaseWriter) })
	for range 2 {
		err := <-errorsReturned
		received++
		require.NoError(t, err)
	}
	require.NoError(t, db.Callback().Query().Remove("seed_outer_empty_barrier"))
	require.NoError(t, db.Callback().Create().Remove("seed_first_writer_barrier"))
	var users []models.User
	require.NoError(t, db.Order("username").Find(&users).Error)
	require.Len(t, users, 2)
	credentials, err := os.ReadFile(credentialsPath)
	require.NoError(t, err)
	passwordByUser := make(map[string]string)
	for _, line := range strings.Split(string(credentials), "\n") {
		username, password, ok := strings.Cut(line, ": ")
		if ok {
			passwordByUser[username] = password
		}
	}
	for _, user := range users {
		password, found := passwordByUser[user.Username]
		require.True(t, found, "credential entry missing")
		assert.NoError(t, bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(password)), "published credentials must belong to committed users")
		assert.False(t, strings.Contains(logs.String(), password), "passwords must never be logged")
	}
	require.Equal(t, 1, strings.Count(logs.String(), "已创建默认用户"), "the skipped seed must not claim account creation")
}

func TestSeedDatabaseFailurePreservesExistingCredentialFile(t *testing.T) {
	db, credentialsPath, logs := seedTransactionFixture(t)
	require.NoError(t, os.WriteFile(credentialsPath, []byte("prior-fixture"), 0o600))
	require.NoError(t, db.Create(&models.Dictionary{Code: "payment_stage", Name: "fixture", Status: 1}).Error)
	require.Error(t, Seed(db))
	contents, err := os.ReadFile(credentialsPath)
	require.NoError(t, err)
	require.True(t, string(contents) == "prior-fixture", "a failed transaction must not replace the prior credential file")
	var count int64
	require.NoError(t, db.Model(&models.User{}).Count(&count).Error)
	require.Zero(t, count)
	require.NotContains(t, logs.String(), "已创建默认用户")
}

func TestSeedCredentialPublicationFailureRollsBackDatabaseWrites(t *testing.T) {
	db, credentialsPath, logs := seedTransactionFixture(t)
	require.NoError(t, os.Mkdir(credentialsPath, 0o700))
	require.Error(t, Seed(db))
	for _, model := range []any{&models.User{}, &models.Dictionary{}, &models.DictionaryItem{}} {
		var count int64
		require.NoError(t, db.Model(model).Count(&count).Error)
		require.Zero(t, count)
	}
	require.NotContains(t, logs.String(), "已创建默认用户")
}
