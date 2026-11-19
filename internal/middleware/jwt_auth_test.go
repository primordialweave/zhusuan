package middleware

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/primordialweave/zhusuan/internal/config"
	"github.com/primordialweave/zhusuan/internal/database"
	"github.com/primordialweave/zhusuan/internal/models"
	"github.com/primordialweave/zhusuan/internal/pkg/cache"
	"github.com/primordialweave/zhusuan/internal/pkg/jwt"
	"github.com/primordialweave/zhusuan/internal/pkg/password"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupJWTAuthTestDB(t *testing.T) {
	t.Helper()

	config.AppConfig = &config.Config{
		DBType: "sqlite",
		DBPath: "file:jwt_auth_test?mode=memory&cache=shared",
	}
	db := database.GetDB()
	require.NoError(t, db.AutoMigrate(&models.User{}, &models.PersonalAccessToken{}))
}

func TestJWTAuthDatabaseFailureDoesNotRestoreOldAdministratorRole(t *testing.T) {
	gin.SetMode(gin.TestMode)
	setupJWTAuthTestDB(t)
	jwt.SecretKey = []byte("release-auth-test-only-secret")
	jwt.TokenExpiry = time.Hour
	const userID int64 = 991006
	require.NoError(t, cache.Delete(cache.UserActiveKey(userID)))
	db := database.GetDB()
	require.NoError(t, db.Callback().Query().Before("gorm:query").Register("release_auth_failure", func(tx *gorm.DB) { tx.AddError(errors.New("simulated database outage")) }))
	t.Cleanup(func() { db.Callback().Query().Remove("release_auth_failure") })
	token, err := jwt.GenerateToken(userID, "outdated-admin", "admin")
	require.NoError(t, err)
	reached := false
	router := gin.New()
	router.GET("/admin", JWTAuth(), AdminOnly(), func(c *gin.Context) { reached = true; c.Status(http.StatusNoContent) })
	req := httptest.NewRequest(http.MethodGet, "/admin", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	require.Equal(t, http.StatusServiceUnavailable, rec.Code)
	require.False(t, reached)
}

func TestJWTAuthRejectsDisabledUser(t *testing.T) {
	gin.SetMode(gin.TestMode)
	setupJWTAuthTestDB(t)

	hash, err := password.HashPassword("Passw0rd")
	require.NoError(t, err)

	db := database.GetDB()
	user := models.User{
		Username: "disabled-user",
		Name:     "Disabled User",
		Password: hash,
		Role:     "user",
		Status:   0,
	}
	require.NoError(t, db.Create(&user).Error)
	require.NoError(t, db.Model(&models.User{}).Where("id = ?", user.ID).Update("status", 0).Error)

	jwt.SecretKey = []byte("test-secret-key-for-jwt-auth-only")
	jwt.TokenExpiry = time.Hour
	token, err := jwt.GenerateToken(user.ID, user.Username, user.Role)
	require.NoError(t, err)

	router := gin.New()
	router.GET("/protected", JWTAuth(), func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})

	req := httptest.NewRequest(http.MethodGet, "/protected", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	require.NotEqual(t, http.StatusNoContent, rec.Code)
}
