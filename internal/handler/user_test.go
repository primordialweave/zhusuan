package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"

	"github.com/primordialweave/zhusuan/internal/config"
	"github.com/primordialweave/zhusuan/internal/database"
	"github.com/primordialweave/zhusuan/internal/models"
)

func adminUserUpdateFixture(t *testing.T) (*gin.Engine, models.User) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	t.Setenv("ZHUSUAN_CONFIG_ROOT", t.TempDir())
	previous := config.AppConfig
	config.AppConfig = &config.Config{DBType: "sqlite", DBPath: "file:admin-user-handler?mode=memory&cache=shared"}
	t.Cleanup(func() { config.AppConfig = previous })
	db := database.GetDB()
	require.NoError(t, db.AutoMigrate(&models.User{}))
	user := models.User{ID: 55177, Username: "admin-user-update-fixture", Name: "old name", Password: "private-password-hash-fixture", Email: "admin-update@example.test", Phone: "13800000000", Role: "admin", Status: 1}
	require.NoError(t, db.Create(&user).Error)
	t.Cleanup(func() { require.NoError(t, db.Delete(&user).Error) })
	engine := gin.New()
	engine.PUT("/users/:id", NewUserHandler().Update)
	return engine, user
}

func adminUserUpdateHTTP(t *testing.T, engine *gin.Engine, path, body string) *httptest.ResponseRecorder {
	t.Helper()
	request := httptest.NewRequest(http.MethodPut, path, bytes.NewBufferString(body))
	request.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()
	engine.ServeHTTP(recorder, request)
	return recorder
}

func TestAdminUserUpdateReturnsAcceptedPublicProfile(t *testing.T) {
	engine, user := adminUserUpdateFixture(t)
	recorder := adminUserUpdateHTTP(t, engine, "/users/55177", `{"name":"accepted name","department":"new department","phone":"","role":"admin","status":1}`)
	require.Equal(t, http.StatusOK, recorder.Code, recorder.Body.String())
	var result struct {
		Data map[string]any `json:"data"`
	}
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &result))
	require.NotNil(t, result.Data, "successful admin update must return the accepted user")
	require.Equal(t, float64(user.ID), result.Data["id"])
	require.Equal(t, "accepted name", result.Data["name"])
	require.Equal(t, "new department", result.Data["department"])
	require.Equal(t, user.Phone, result.Data["phone"], "the response must reflect the server's unchanged empty-field rule")
	require.Equal(t, user.Username, result.Data["username"])
	require.Equal(t, "admin", result.Data["role"])
	require.Equal(t, float64(1), result.Data["status"])
	require.NotContains(t, result.Data, "password")
	require.NotContains(t, recorder.Body.String(), user.Password)
	var persisted models.User
	require.NoError(t, database.GetDB().First(&persisted, user.ID).Error)
	require.Equal(t, user.Password, persisted.Password)
	require.Equal(t, persisted.Name, result.Data["name"])
	require.Equal(t, persisted.Department, result.Data["department"])
	require.Equal(t, persisted.Phone, result.Data["phone"])
}

func TestAdminUserUpdateRejectsMissingOrInvalidUserWithoutChangingProfile(t *testing.T) {
	engine, user := adminUserUpdateFixture(t)
	for _, tc := range []struct {
		name string
		path string
		body string
		code int
	}{
		{"missing user", "/users/99955177", `{"name":"missing user"}`, http.StatusNotFound},
		{"invalid ID", "/users/not-a-user", `{"name":"invalid user"}`, http.StatusBadRequest},
		{"invalid role", "/users/55177", `{"name":"rejected name","role":"owner"}`, http.StatusBadRequest},
	} {
		t.Run(tc.name, func(t *testing.T) {
			recorder := adminUserUpdateHTTP(t, engine, tc.path, tc.body)
			require.Equal(t, tc.code, recorder.Code, recorder.Body.String())
			require.NotContains(t, recorder.Body.String(), user.Password)
			var persisted models.User
			require.NoError(t, database.GetDB().First(&persisted, user.ID).Error)
			require.Equal(t, user.Name, persisted.Name)
			require.Equal(t, user.Role, persisted.Role)
			require.Equal(t, user.Password, persisted.Password)
		})
	}
}

func TestAdminUserUpdateRejectsConflictingEmailWithoutPartialProfileChange(t *testing.T) {
	engine, user := adminUserUpdateFixture(t)
	other := models.User{ID: 55178, Username: "admin-user-update-email-fixture", Name: "other user", Password: "other-fixture-hash", Email: "already-used@example.test"}
	db := database.GetDB()
	require.NoError(t, db.Create(&other).Error)
	t.Cleanup(func() { require.NoError(t, db.Delete(&other).Error) })
	recorder := adminUserUpdateHTTP(t, engine, "/users/55177", `{"name":"rejected name","email":"already-used@example.test"}`)
	require.Equal(t, http.StatusBadRequest, recorder.Code, recorder.Body.String())
	var persisted models.User
	require.NoError(t, db.First(&persisted, user.ID).Error)
	require.Equal(t, user.Name, persisted.Name)
	require.Equal(t, user.Email, persisted.Email)
	require.Equal(t, user.Password, persisted.Password)
}
