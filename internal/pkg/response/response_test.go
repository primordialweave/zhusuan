package response

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

func init() {
	gin.SetMode(gin.TestMode)
}

func TestGetPagination(t *testing.T) {
	t.Run("offset multiplication cannot overflow", func(t *testing.T) {
		c, _ := gin.CreateTestContext(httptest.NewRecorder())
		c.Request = httptest.NewRequest(http.MethodGet, fmt.Sprintf("/test?page=%d&page_size=100", int(^uint(0)>>1)), nil)
		page, size := GetPagination(c)
		assert.Equal(t, 1, page)
		assert.Equal(t, 100, size)
	})
	t.Run("数字溢出使用默认值", func(t *testing.T) {
		c, _ := gin.CreateTestContext(httptest.NewRecorder())
		request, err := http.NewRequest(http.MethodGet, "/test?page=999999999999999999999999999999&page_size=999999999999999999999999999999", nil)
		if err != nil {
			t.Fatal(err)
		}
		c.Request = request
		page, pageSize := GetPagination(c)
		assert.Equal(t, 1, page)
		assert.Equal(t, 10, pageSize)
	})
	t.Run("默认分页参数", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request, _ = http.NewRequest("GET", "/test", nil)

		page, pageSize := GetPagination(c)
		assert.Equal(t, 1, page)
		assert.Equal(t, 10, pageSize)
	})

	t.Run("自定义分页参数", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request, _ = http.NewRequest("GET", "/test?page=3&page_size=20", nil)

		page, pageSize := GetPagination(c)
		assert.Equal(t, 3, page)
		assert.Equal(t, 20, pageSize)
	})

	t.Run("限制最大页面大小", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request, _ = http.NewRequest("GET", "/test?page=1&page_size=500", nil)

		page, pageSize := GetPagination(c)
		assert.Equal(t, 1, page)
		assert.Equal(t, 100, pageSize, "页面大小应该被限制在100")
	})

	t.Run("无效分页参数使用默认值", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request, _ = http.NewRequest("GET", "/test?page=abc&page_size=-1", nil)

		page, pageSize := GetPagination(c)
		assert.Equal(t, 1, page, "无效page应返回默认值1")
		assert.Equal(t, 10, pageSize, "无效pageSize应返回默认值10")
	})

	t.Run("page为0时使用默认值", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request, _ = http.NewRequest("GET", "/test?page=0&page_size=0", nil)

		page, pageSize := GetPagination(c)
		assert.Equal(t, 1, page)
		assert.Equal(t, 10, pageSize)
	})
}

func TestParseIDParam(t *testing.T) {
	t.Run("zero ID is rejected", func(t *testing.T) {
		c, _ := gin.CreateTestContext(httptest.NewRecorder())
		c.Params = gin.Params{{Key: "id", Value: "0"}}
		id, err := ParseIDParam(c, "id")
		assert.Error(t, err)
		assert.Zero(t, id)
	})
	t.Run("有效ID", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Params = gin.Params{{Key: "id", Value: "123"}}

		id, err := ParseIDParam(c, "id")
		assert.NoError(t, err)
		assert.Equal(t, int64(123), id)
	})

	t.Run("无效ID-非数字", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Params = gin.Params{{Key: "id", Value: "abc"}}

		id, err := ParseIDParam(c, "id")
		assert.Error(t, err)
		assert.Equal(t, int64(0), id)
	})

	t.Run("无效ID-空字符串", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Params = gin.Params{{Key: "id", Value: ""}}

		id, err := ParseIDParam(c, "id")
		assert.Error(t, err)
		assert.Equal(t, int64(0), id)
	})

	t.Run("负数ID被拒绝", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Params = gin.Params{{Key: "id", Value: "-1"}}

		id, err := ParseIDParam(c, "id")
		assert.Error(t, err)
		assert.Equal(t, int64(0), id)
	})

	t.Run("无效ID-超出范围", func(t *testing.T) {
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Params = gin.Params{{Key: "id", Value: "99999999999999999999999999"}}

		id, err := ParseIDParam(c, "id")
		assert.Error(t, err)
		assert.Equal(t, int64(0), id)
	})
}

func TestErrorResponsesUseHTTPStatusCodes(t *testing.T) {
	tests := []struct {
		name string
		call func(*gin.Context)
		want int
	}{
		{name: "param", call: func(c *gin.Context) { ParamError(c) }, want: http.StatusBadRequest},
		{name: "not found", call: func(c *gin.Context) { NotFound(c) }, want: http.StatusNotFound},
		{name: "unauthorized", call: func(c *gin.Context) { Unauthorized(c) }, want: http.StatusUnauthorized},
		{name: "forbidden", call: func(c *gin.Context) { Forbidden(c) }, want: http.StatusForbidden},
		{name: "internal", call: func(c *gin.Context) { InternalError(c) }, want: http.StatusInternalServerError},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)

			tt.call(c)

			assert.Equal(t, tt.want, w.Code)
		})
	}
}
