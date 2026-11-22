package handler

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"

	"github.com/primordialweave/zhusuan/internal/config"
	"github.com/primordialweave/zhusuan/internal/database"
	"github.com/primordialweave/zhusuan/internal/dto"
	"github.com/primordialweave/zhusuan/internal/models"
)

func receiptHandlerFixture(t *testing.T) (*gin.Engine, models.Project) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	previous := config.AppConfig
	config.AppConfig = &config.Config{DBType: "sqlite", DBPath: "file:receipt-handler?mode=memory&cache=shared"}
	t.Cleanup(func() { config.AppConfig = previous })
	db := database.GetDB()
	require.NoError(t, db.AutoMigrate(&models.User{}, &models.Project{}, &models.Payment{}))
	user := models.User{ID: 55001, Username: "receipt-handler", Password: "test"}
	require.NoError(t, db.Create(&user).Error)
	project := models.Project{UserID: user.ID, Name: "actual receipts", Company: "fixture", Type: "test", TotalAmount: 1000, ContractNumber: "HTTP-RECEIPT", Status: "active", StartDate: time.Now(), EndDate: time.Now()}
	require.NoError(t, db.Create(&project).Error)
	t.Cleanup(func() {
		require.NoError(t, db.Where("user_id = ?", user.ID).Delete(&models.Payment{}).Error)
		require.NoError(t, db.Delete(&project).Error)
		require.NoError(t, db.Delete(&user).Error)
	})
	engine := gin.New()
	engine.Use(func(c *gin.Context) { c.Set("user_id", user.ID) })
	dashboard := NewDashboardHandler()
	engine.GET("/overview", dashboard.ReceiptOverview)
	engine.GET("/trend", dashboard.ReceiptTrend)
	payment := NewPaymentHandler()
	engine.GET("/payments", payment.List)
	engine.POST("/payments", payment.Create)
	engine.PUT("/payments/:id", payment.Update)
	return engine, project
}

func receiptHTTP(t *testing.T, engine *gin.Engine, method, path string, body any) *httptest.ResponseRecorder {
	t.Helper()
	var data []byte
	if body != nil {
		var err error
		data, err = json.Marshal(body)
		require.NoError(t, err)
	}
	request := httptest.NewRequest(method, path, bytes.NewReader(data))
	request.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()
	engine.ServeHTTP(recorder, request)
	return recorder
}

func TestReceiptHTTPActualOnlyInputAndCalendarStatistics(t *testing.T) {
	engine, project := receiptHandlerFixture(t)
	createdResponse := receiptHTTP(t, engine, http.MethodPost, "/payments", map[string]any{
		"project_id": project.ID, "amount": 200, "actual_date": "2024-02-29", "status": "confirmed",
	})
	require.Equal(t, http.StatusOK, createdResponse.Code, createdResponse.Body.String())
	var created struct{ Data models.Payment }
	require.NoError(t, json.Unmarshal(createdResponse.Body.Bytes(), &created))
	require.Equal(t, "all", created.Data.Stage)
	require.NotNil(t, created.Data.ActualDate)
	overviewResponse := receiptHTTP(t, engine, http.MethodGet, "/overview?year=2024&month=2", nil)
	require.Equal(t, http.StatusOK, overviewResponse.Code, overviewResponse.Body.String())
	var overview struct{ Data dto.ReceiptOverview }
	require.NoError(t, json.Unmarshal(overviewResponse.Body.Bytes(), &overview))
	require.Equal(t, 1000.0, overview.Data.ContractTotal)
	require.Equal(t, 200.0, overview.Data.ReceivedTotal)
	require.Equal(t, 800.0, overview.Data.OutstandingTotal)
	require.Equal(t, 200.0, overview.Data.PeriodReceived)
	require.Equal(t, int64(1), overview.Data.PeriodCount)
	trendResponse := receiptHTTP(t, engine, http.MethodGet, "/trend?year=2024&month=2", nil)
	require.Equal(t, http.StatusOK, trendResponse.Code, trendResponse.Body.String())
	var trend struct{ Data dto.IncomeTrend }
	require.NoError(t, json.Unmarshal(trendResponse.Body.Bytes(), &trend))
	require.Len(t, trend.Data.ActualValues, 29)
	require.Equal(t, 200.0, trend.Data.ActualValues[28])
	require.Equal(t, "2024-02-01", trend.Data.StartDate)
	require.Equal(t, "2024-02-29", trend.Data.EndDate)
	require.Empty(t, trend.Data.ExpectedValues)
	updated := receiptHTTP(t, engine, http.MethodPut, fmt.Sprintf("/payments/%d", created.Data.ID), map[string]any{
		"project_id": project.ID, "amount": 300, "actual_date": "2024-03-01", "status": "confirmed",
	})
	require.Equal(t, http.StatusOK, updated.Code, updated.Body.String())
	var saved struct{ Data models.Payment }
	require.NoError(t, json.Unmarshal(updated.Body.Bytes(), &saved))
	require.Equal(t, created.Data.PlanDate, saved.Data.PlanDate)
	require.Equal(t, "2024-03-01", saved.Data.ActualDate.Format(time.DateOnly))
}

func TestReceiptHTTPActualDateListKeepsLegacyPlanListCompatible(t *testing.T) {
	engine, project := receiptHandlerFixture(t)
	for _, body := range []map[string]any{
		{"project_id": project.ID, "amount": 200, "plan_date": "2024-01-01", "actual_date": "2024-02-29", "status": "confirmed"},
		{"project_id": project.ID, "amount": 100, "plan_date": "2024-02-29", "status": "pending"},
	} {
		created := receiptHTTP(t, engine, http.MethodPost, "/payments", body)
		require.Equal(t, http.StatusOK, created.Code, created.Body.String())
	}
	actualResponse := receiptHTTP(t, engine, http.MethodGet, "/payments?start_date=2024-02-01&end_date=2024-02-29&date_field=actual&status=pending", nil)
	require.Equal(t, http.StatusOK, actualResponse.Code)
	var actual struct{ Data []models.Payment }
	require.NoError(t, json.Unmarshal(actualResponse.Body.Bytes(), &actual))
	require.Len(t, actual.Data, 1)
	require.Equal(t, "confirmed", actual.Data[0].Status)
	require.Equal(t, 200.0, actual.Data[0].Amount)
	planResponse := receiptHTTP(t, engine, http.MethodGet, "/payments?start_date=2024-02-01&end_date=2024-02-29", nil)
	require.Equal(t, http.StatusOK, planResponse.Code)
	var planned struct{ Data []models.Payment }
	require.NoError(t, json.Unmarshal(planResponse.Body.Bytes(), &planned))
	require.Len(t, planned.Data, 1)
	require.Equal(t, "pending", planned.Data[0].Status)
	require.Nil(t, planned.Data[0].ActualDate)
}

func TestReceiptHTTPRejectsAmbiguousRangesAndInvalidActualDates(t *testing.T) {
	engine, project := receiptHandlerFixture(t)
	for _, path := range []string{
		"/overview?period=unsupported", "/trend?period=unsupported", "/overview?year=0",
		"/trend?year=2024&month=13", "/overview?month=2", "/trend?month=invalid",
		"/payments?date_field=other", "/payments?date_field=actual&start_date=2024-02-01",
		"/payments?date_field=actual&start_date=2024-02-30&end_date=2024-02-29",
		"/payments?date_field=actual&start_date=2024-03-01&end_date=2024-02-29",
	} {
		t.Run(path, func(t *testing.T) {
			result := receiptHTTP(t, engine, http.MethodGet, path, nil)
			require.Equal(t, http.StatusBadRequest, result.Code, result.Body.String())
		})
	}
	invalid := receiptHTTP(t, engine, http.MethodPost, "/payments", map[string]any{
		"project_id": project.ID, "amount": 200, "actual_date": "2024-02-29T00:00:00Z", "status": "confirmed",
	})
	require.Equal(t, http.StatusBadRequest, invalid.Code)
	require.Contains(t, invalid.Body.String(), "实际日期格式错误")
}
