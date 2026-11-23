package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"

	"github.com/primordialweave/zhusuan/internal/config"
	"github.com/primordialweave/zhusuan/internal/database"
	"github.com/primordialweave/zhusuan/internal/dto"
	"github.com/primordialweave/zhusuan/internal/models"
)

func TestProjectHTTPListAcceptsStatusUnionWithScopedTotal(t *testing.T) {
	gin.SetMode(gin.TestMode)
	previous := config.AppConfig
	config.AppConfig = &config.Config{DBType: "sqlite", DBPath: "file:project-status-handler?mode=memory&cache=shared"}
	t.Cleanup(func() { config.AppConfig = previous })
	db := database.GetDB()
	require.NoError(t, db.AutoMigrate(&models.User{}, &models.Project{}))
	users := []models.User{{ID: 55801, Username: "project-status-http-one", Password: "test"}, {ID: 55802, Username: "project-status-http-two", Password: "test"}}
	require.NoError(t, db.Create(&users).Error)
	projects := []models.Project{
		{UserID: users[0].ID, Name: "match active", Company: "fixture", Status: "active", ContractNumber: "STATUS-HTTP-1"},
		{UserID: users[0].ID, Name: "completed", Company: "match company", Status: "completed", ContractNumber: "STATUS-HTTP-2"},
		{UserID: users[0].ID, Name: "match archived", Company: "fixture", Status: "archived", ContractNumber: "STATUS-HTTP-3"},
		{UserID: users[1].ID, Name: "match other", Company: "fixture", Status: "active", ContractNumber: "STATUS-HTTP-1"},
	}
	for i := range projects {
		projects[i].CreateTime = time.Date(2026, 11, 23, 0, i, 0, 0, time.UTC)
	}
	require.NoError(t, db.Create(&projects).Error)
	t.Cleanup(func() {
		require.NoError(t, db.Where("user_id IN ?", []int64{users[0].ID, users[1].ID}).Delete(&models.Project{}).Error)
		require.NoError(t, db.Delete(&users).Error)
	})
	engine := gin.New()
	engine.Use(func(c *gin.Context) { c.Set("user_id", users[0].ID) })
	engine.GET("/projects", NewProjectHandler().List)
	for _, tc := range []struct {
		status string
		page   int
		total  int64
		ids    []int64
	}{
		{" active,completed,active ", 1, 2, []int64{projects[1].ID}},
		{"active,completed", 2, 2, []int64{projects[0].ID}},
		{"completed", 1, 1, []int64{projects[1].ID}},
		{"unknown", 1, 0, []int64{}},
		{"", 1, 3, []int64{projects[2].ID}},
	} {
		t.Run(fmt.Sprintf("status=%q/page=%d", tc.status, tc.page), func(t *testing.T) {
			query := url.Values{"status": {tc.status}, "keyword": {"match"}, "page": {fmt.Sprint(tc.page)}, "page_size": {"1"}}
			recorder := httptest.NewRecorder()
			engine.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/projects?"+query.Encode(), nil))
			require.Equal(t, http.StatusOK, recorder.Code, recorder.Body.String())
			var response struct {
				Data dto.ProjectListResult `json:"data"`
			}
			require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &response))
			require.Equal(t, tc.total, response.Data.Total)
			require.Equal(t, tc.page, response.Data.Page)
			require.Equal(t, 1, response.Data.PageSize)
			ids := make([]int64, 0, len(response.Data.List))
			for _, project := range response.Data.List {
				ids = append(ids, project.ID)
				require.Equal(t, users[0].ID, project.UserID)
			}
			require.Equal(t, tc.ids, ids)
		})
	}
}
