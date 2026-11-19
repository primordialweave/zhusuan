// Package app initializes the shared desktop/server application runtime.
package app

import (
	"log/slog"
	"os"
	"runtime/debug"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/primordialweave/zhusuan/internal/config"
	"github.com/primordialweave/zhusuan/internal/constants"
	"github.com/primordialweave/zhusuan/internal/database"
	"github.com/primordialweave/zhusuan/internal/models"
	"github.com/primordialweave/zhusuan/internal/pkg/jwt"
	"github.com/primordialweave/zhusuan/internal/pkg/logger"
	"github.com/primordialweave/zhusuan/internal/router"
)

// RuntimeMode describes which host process is starting the shared backend.
type RuntimeMode string

const (
	// RuntimeModeDesktop runs the backend inside the Wails desktop process.
	RuntimeModeDesktop RuntimeMode = "desktop"
	// RuntimeModeServer runs the backend as a standalone HTTP API server.
	RuntimeModeServer RuntimeMode = "server"
)

// Runtime contains shared backend components initialized during startup.
type Runtime struct {
	Router *gin.Engine
}

// Bootstrap initializes shared backend dependencies for desktop and server hosts.
func Bootstrap(mode RuntimeMode) (*Runtime, func(), error) {
	if _, ok := os.LookupEnv("RUNTIME_MODE"); !ok {
		if err := os.Setenv("RUNTIME_MODE", string(mode)); err != nil {
			return nil, nil, err
		}
	}

	config.Load()

	if os.Getenv("ENV") == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	logger.Setup()
	cleanup := func() {
		if err := database.Close(); err != nil {
			slog.Warn("Failed to close database", "error", err)
		}
		logger.Sync()
	}

	defer func() {
		if r := recover(); r != nil {
			slog.Error("CRITICAL PANIC", "error", r, "stack", string(debug.Stack()))
			panic(r)
		}
	}()

	slog.Info("Application starting...", "version", "v"+constants.AppVersion, "mode", mode)

	jwt.SecretKey = []byte(config.AppConfig.JWTSecret)
	jwt.TokenExpiry = time.Duration(config.AppConfig.TokenExpiry) * time.Hour

	slog.Info("Initializing database...")
	db := database.GetDB()
	if err := db.AutoMigrate(
		&models.User{},
		&models.Project{},
		&models.Payment{},
		&models.Dictionary{},
		&models.DictionaryItem{},
		&models.Notification{},
		&models.UserNotification{},
		&models.PersonalAccessToken{},
	); err != nil {
		cleanup()
		return nil, nil, err
	}

	if err := database.NormalizeLegacyPaymentStatuses(db); err != nil {
		cleanup()
		return nil, nil, err
	}

	if err := database.Seed(db); err != nil {
		slog.Error("Failed to seed database", "error", err)
	}

	return &Runtime{Router: router.NewRouter()}, cleanup, nil
}
