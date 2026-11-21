package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"

	"github.com/primordialweave/zhusuan/internal/config"
	"github.com/primordialweave/zhusuan/internal/constants"
)

func TestSystemInfoReturnsOnlyPublicBranding(t *testing.T) {
	for _, tc := range []struct {
		name        string
		cfg         *config.Config
		want        string
		wantAccount string
	}{
		{name: "configured", cfg: &config.Config{AppSlogan: "  每一笔，都有数  ", WeChatPublicAccount: "  自定义公众号  ", JWTSecret: "private-secret", DBPassword: "private-password"}, want: "每一笔，都有数", wantAccount: "自定义公众号"},
		{name: "blank falls back", cfg: &config.Config{AppSlogan: " \t ", WeChatPublicAccount: " \t "}, want: config.DefaultAppSlogan, wantAccount: config.DefaultWeChatPublicAccount},
		{name: "uninitialized falls back", want: config.DefaultAppSlogan, wantAccount: config.DefaultWeChatPublicAccount},
	} {
		t.Run(tc.name, func(t *testing.T) {
			previous := config.AppConfig
			config.AppConfig = tc.cfg
			t.Cleanup(func() { config.AppConfig = previous })
			router := gin.New()
			router.GET("/system/info", NewSystemHandler().Info)
			recorder := httptest.NewRecorder()

			router.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/system/info", nil))

			require.Equal(t, http.StatusOK, recorder.Code)
			var payload struct {
				Code int               `json:"code"`
				Data map[string]string `json:"data"`
			}
			require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &payload))
			require.Zero(t, payload.Code)
			require.Equal(t, map[string]string{"version": constants.AppVersion, "slogan": tc.want, "wechat_public_account": tc.wantAccount}, payload.Data)
		})
	}
}

func TestUpdateHTTPClientHasTimeout(t *testing.T) {
	require.NotNil(t, updateHTTPClient)
	require.GreaterOrEqual(t, updateHTTPClient.Timeout, 5*time.Second)
}
