package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"

	"github.com/primordialweave/zhusuan/internal/config"
	"github.com/primordialweave/zhusuan/internal/database"
	"github.com/primordialweave/zhusuan/internal/middleware"
	"github.com/primordialweave/zhusuan/internal/models"
	"github.com/primordialweave/zhusuan/internal/service"
)

func TestNotificationTargetJSONUsesNumericIDsAndZeroForBroadcast(t *testing.T) {
	for _, fixture := range []struct {
		name   string
		field  string
		target int64
		valid  bool
	}{
		{name: "number", field: `,"target_user_id":12`, target: 12, valid: true},
		{name: "all", field: `,"target_user_id":0`, valid: true},
		{name: "omitted", valid: true},
		{name: "null", field: `,"target_user_id":null`, valid: true},
		{name: "quoted ID", field: `,"target_user_id":"12"`},
	} {
		t.Run(fixture.name, func(t *testing.T) {
			context, _ := gin.CreateTestContext(httptest.NewRecorder())
			context.Request = httptest.NewRequest("PUT", "/notifications/1", strings.NewReader(`{"title":"fixture","content":"content"`+fixture.field+`}`))
			context.Request.Header.Set("Content-Type", "application/json")
			var request CreateNotificationRequest
			err := context.ShouldBindJSON(&request)
			if fixture.valid {
				require.NoError(t, err)
				require.Equal(t, fixture.target, request.TargetUserID)
			} else {
				require.Error(t, err)
			}
		})
	}
}

func TestNotificationTargetHandlersPreserveInboxAccessAndAdminWrites(t *testing.T) {
	previous := config.AppConfig
	config.AppConfig = &config.Config{DBType: "sqlite", DBPath: "file:notification-target-handler?mode=memory&cache=shared"}
	t.Cleanup(func() { config.AppConfig = previous })
	db := database.GetDB()
	require.NoError(t, db.AutoMigrate(&models.User{}, &models.Notification{}, &models.UserNotification{}))
	users := []models.User{
		{ID: 992201, Username: "notification-handler-admin", Name: "admin fixture", Password: "fixture", Role: "admin", Status: 1},
		{ID: 992202, Username: "notification-handler-recipient", Name: "recipient fixture", Password: "fixture", Role: "user", Status: 1},
	}
	require.NoError(t, db.Create(&users).Error)
	t.Cleanup(func() { require.NoError(t, db.Where("id IN ?", []int64{users[0].ID, users[1].ID}).Delete(&models.User{}).Error) })
	svc := service.NewNotificationService()
	global, err := svc.Create(users[0].ID, "handler broadcast", "fixture", "system", 0)
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, svc.Delete(global.ID)) })
	private, err := svc.Create(users[0].ID, "handler recipient", "fixture", "private", users[1].ID)
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, svc.Delete(private.ID)) })
	engine := gin.New()
	engine.Use(func(c *gin.Context) {
		id, parseErr := strconv.ParseInt(c.GetHeader("Fixture-User"), 10, 64)
		require.NoError(t, parseErr)
		c.Set("user_id", id)
		c.Set("role", c.GetHeader("Fixture-Role"))
	})
	h := NewNotificationHandler()
	engine.GET("/notifications", h.List)
	engine.GET("/notifications/:id", h.Get)
	engine.PUT("/notifications/:id", middleware.AdminOnly(), h.Update)
	request := func(method, path, body string, user models.User) *httptest.ResponseRecorder {
		t.Helper()
		req := httptest.NewRequest(method, path, strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Fixture-User", strconv.FormatInt(user.ID, 10))
		req.Header.Set("Fixture-Role", user.Role)
		recorder := httptest.NewRecorder()
		engine.ServeHTTP(recorder, req)
		return recorder
	}
	path := fmt.Sprintf("/notifications/%d", private.ID)
	adminList := request(http.MethodGet, "/notifications", "", users[0])
	require.Equal(t, http.StatusOK, adminList.Code)
	var listResponse struct {
		Data struct {
			List  []models.Notification `json:"list"`
			Total int64                 `json:"total"`
		} `json:"data"`
	}
	require.NoError(t, json.Unmarshal(adminList.Body.Bytes(), &listResponse))
	require.Equal(t, int64(1), listResponse.Data.Total, "admin list must remain the admin's inbox")
	require.Len(t, listResponse.Data.List, 1)
	require.Equal(t, global.ID, listResponse.Data.List[0].ID)
	require.Equal(t, http.StatusNotFound, request(http.MethodGet, path, "", users[0]).Code)
	detail := request(http.MethodGet, path, "", users[1])
	require.Equal(t, http.StatusOK, detail.Code)
	require.Contains(t, detail.Body.String(), fmt.Sprintf(`"target_user_id":%d`, users[1].ID))
	body := fmt.Sprintf(`{"title":"handler updated","content":"accepted","type":"private","target_user_id":%d}`, users[0].ID)
	require.Equal(t, http.StatusForbidden, request(http.MethodPut, path, body, users[1]).Code)
	invalid := request(http.MethodPut, path, `{"title":"invalid","content":"invalid","target_user_id":-1}`, users[0])
	require.Equal(t, http.StatusBadRequest, invalid.Code, invalid.Body.String())
	accepted := request(http.MethodPut, path, body, users[0])
	require.Equal(t, http.StatusOK, accepted.Code, accepted.Body.String())
	require.Contains(t, accepted.Body.String(), fmt.Sprintf(`"target_user_id":%d`, users[0].ID))
	require.Contains(t, accepted.Body.String(), `"type":3`)
	require.Equal(t, http.StatusNotFound, request(http.MethodGet, path, "", users[1]).Code)
	reopened := request(http.MethodGet, path, "", users[0])
	require.Equal(t, http.StatusOK, reopened.Code)
	require.Contains(t, reopened.Body.String(), `"title":"handler updated"`)
	require.Contains(t, reopened.Body.String(), fmt.Sprintf(`"target_user_id":%d`, users[0].ID))
}
