package handler

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/primordialweave/zhusuan/internal/config"
	"github.com/primordialweave/zhusuan/internal/pkg/response"
	"github.com/primordialweave/zhusuan/internal/updater"
)

// SystemHandler 系统级功能处理器
// 负责处理如版本检查、系统状态检测等全局性请求。
type SystemHandler struct{}

var updateHTTPClient = &http.Client{
	Timeout: 10 * time.Second,
}

// NewSystemHandler 创建系统处理器实例
func NewSystemHandler() *SystemHandler {
	return &SystemHandler{}
}

// CheckUpdateResponse 版本检查响应结构
type CheckUpdateResponse struct {
	TagName string          `json:"tag_name"` // 版本标签 (如 v1.0.1)
	HTMLURL string          `json:"html_url"` // 发布页面链接
	Body    string          `json:"body"`     // 更新日志内容
	Assets  []updater.Asset `json:"assets"`
}

// CheckUpdate 检查是否有新版本
// @Summary 检查更新
// @Description 从 GitHub 获取最新 Release 信息
// @Tags System
// @Success 200 {object} CheckUpdateResponse
// @Router /api/v1/system/check-update [get]
func (h *SystemHandler) CheckUpdate(c *gin.Context) {
	repo := config.AppConfig.GitHubRepo
	if repo == "" {
		repo = "FruitsAI/Orange" // Fallback
	}
	releaseInfo, err := updater.FetchLatest(c.Request.Context(), updateHTTPClient, repo)
	if err != nil {
		response.InternalError(c, "检查更新失败，请稍后重试")
		return
	}
	response.Success(c, releaseInfo)
}
