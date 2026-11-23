package handler

import (
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/primordialweave/zhusuan/internal/config"
	"github.com/primordialweave/zhusuan/internal/constants"
	"github.com/primordialweave/zhusuan/internal/pkg/response"
	"github.com/primordialweave/zhusuan/internal/updater"
)

// SystemHandler 系统级功能处理器
// 负责处理如版本检查、系统状态检测等全局性请求。
type SystemHandler struct{}

var updateHTTPClient = updater.NewHTTPClient(10 * time.Second)

// NewSystemHandler 创建系统处理器实例
func NewSystemHandler() *SystemHandler {
	return &SystemHandler{}
}

// SystemInfoResponse contains the public application identity shown on the about page.
type SystemInfoResponse struct {
	Version             string `json:"version"`
	Slogan              string `json:"slogan"`
	WeChatPublicAccount string `json:"wechat_public_account"`
}

// Info returns application metadata without exposing the runtime configuration.
// @Summary 获取应用公开信息
// @Description 返回关于页面使用的版本、介绍和微信公众号名称；不返回数据库、密钥或其他运行配置。
// @Tags System
// @Produce json
// @Security Bearer
// @Success 200 {object} response.Response{data=SystemInfoResponse}
// @Failure 401 {object} response.Response
// @Router /api/v1/system/info [get]
func (h *SystemHandler) Info(c *gin.Context) {
	slogan := config.DefaultAppSlogan
	wechatPublicAccount := config.DefaultWeChatPublicAccount
	if config.AppConfig != nil {
		if configured := strings.TrimSpace(config.AppConfig.AppSlogan); configured != "" {
			slogan = configured
		}
		if configured := strings.TrimSpace(config.AppConfig.WeChatPublicAccount); configured != "" {
			wechatPublicAccount = configured
		}
	}
	response.Success(c, SystemInfoResponse{Version: constants.AppVersion, Slogan: slogan, WeChatPublicAccount: wechatPublicAccount})
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
// @Produce json
// @Security Bearer
// @Success 200 {object} response.Response{data=updater.Release}
// @Failure 401 {object} response.Response
// @Failure 500 {object} response.Response
// @Router /api/v1/system/updates/check [get]
func (h *SystemHandler) CheckUpdate(c *gin.Context) {
	repo := ""
	if config.AppConfig != nil {
		repo = config.AppConfig.GitHubRepo
	}
	// FetchLatest resolves empty and legacy repository values to primordialweave/zhusuan.
	releaseInfo, err := updater.FetchLatest(c.Request.Context(), updateHTTPClient, repo)
	if err != nil {
		response.InternalError(c, "检查更新失败，请稍后重试")
		return
	}
	response.Success(c, releaseInfo)
}
