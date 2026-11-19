package middleware

import (
	"context"
	"errors"
	"log"
	"log/slog"
	"net/http"
	"strings"

	"crypto/sha256"
	"encoding/hex"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"github.com/primordialweave/zhusuan/internal/database"
	"github.com/primordialweave/zhusuan/internal/models"
	"github.com/primordialweave/zhusuan/internal/pkg/cache"
	"github.com/primordialweave/zhusuan/internal/pkg/jwt"
	"github.com/primordialweave/zhusuan/internal/pkg/response"
	"github.com/primordialweave/zhusuan/internal/repository"
)

// JWTAuth JWT 鉴权中间件
// 拦截 HTTP 请求，验证 Request Header 中的 Authorization 字段。
// 支持:
// 1. 标准 JWT (Bearer <token>)
// 2. 个人访问令牌 (Bearer pat_<token>)
func JWTAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 1. 从 Header 获取 Token
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			response.Unauthorized(c, "请先登录")
			return
		}

		// 2. 解析 Bearer Token 格式 (Bearer <token>)
		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || parts[0] != "Bearer" {
			response.Unauthorized(c, "Token格式错误")
			return
		}

		tokenString := parts[1]

		// 3.1 检查是否为 Personal Access Token (以 pat_ 开头)
		if strings.HasPrefix(tokenString, "pat_") {
			// 计算 Hash
			hash := sha256.Sum256([]byte(tokenString))
			tokenHash := hex.EncodeToString(hash[:])

			// 查找 Token
			repo := repository.NewTokenRepository()
			token, err := repo.FindByHash(tokenHash)
			if err != nil {
				response.Unauthorized(c, "无效的访问令牌")
				return
			}

			// 检查过期时间
			if token.ExpiresAt != nil && token.ExpiresAt.Before(time.Now()) {
				response.Unauthorized(c, "访问令牌已过期")
				return
			}

			// 降低更新频率：只有超过5分钟未更新才异步更新
			if token.LastUsedAt == nil || time.Since(*token.LastUsedAt) > 5*time.Minute {
				go func(id int64) {
					ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
					defer cancel()

					db := database.GetDB().WithContext(ctx)
					if err := db.Model(&models.PersonalAccessToken{}).
						Where("id = ?", id).
						Update("last_used_at", time.Now()).Error; err != nil {
						// 记录更新失败，便于监控告警
						log.Printf("Failed to update last_used_at for token %d: %v", id, err)
					}
				}(token.ID)
			}

			// 验证关联用户
			if token.User == nil || token.User.Status != 1 {
				response.Unauthorized(c, "关联用户无效")
				return
			}

			// 4. 将用户信息注入上下文 (Context)
			c.Set("user_id", token.User.ID)
			c.Set("username", token.User.Username)
			c.Set("role", token.User.Role)
			c.Set("access_token_id", token.ID) // 标记来源

			c.Next()
			return
		}

		// 3.2 校验并解析标准 JWT
		claims, err := jwt.ParseToken(tokenString)
		if err != nil {
			response.Error(c, response.CodeTokenExpired, "Token已过期或无效")
			c.Abort()
			return
		}

		// 校验用户当前状态与角色（带短期缓存）：JWT 本身无法撤销，
		// 此检查保证被禁用/删除的账号、被降级的管理员，
		// 最迟在缓存 TTL 内失去对应访问权限（不必等 Token 过期）
		active, role, authErr := currentUserAuthState(claims.UserID)
		if authErr != nil {
			c.AbortWithStatusJSON(http.StatusServiceUnavailable, response.Response{Code: response.CodeInternalError, Message: "暂时无法验证账号状态，请稍后重试"})
			return
		}
		if !active {
			response.Unauthorized(c, "账号已被禁用")
			return
		}
		// 4. 将用户信息注入上下文 (Context)
		c.Set("user_id", claims.UserID)
		c.Set("username", claims.Username)
		c.Set("role", role)

		c.Next()
	}
}

// userAuthCacheTTL 用户鉴权状态（启用+角色）的缓存时长，
// 同时是禁用账号/角色变更后存量 JWT 生效的最大延迟
const userAuthCacheTTL = time.Minute

// currentUserAuthState 查询用户当前是否启用及其角色（结果缓存 userAuthCacheTTL）
// 缓存值格式: "0" 表示禁用或已删除；"1:<role>" 表示启用及当前角色。
// 查询故障返回临时服务错误，不回退签发时的旧权限，也不将故障写成账号禁用缓存。
func currentUserAuthState(userID int64) (active bool, role string, err error) {
	key := cache.UserActiveKey(userID)
	if v, err := cache.Get(key); err == nil {
		s := string(v)
		if strings.HasPrefix(s, "1:") {
			return true, s[2:], nil
		}
		return false, "", nil
	}

	var user struct {
		Status int
		Role   string
	}
	err = database.GetDB().Model(&models.User{}).
		Select("status", "role").
		Where("id = ?", userID).
		Take(&user).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			// 用户已被删除：拒绝并缓存结果
			cacheUserAuthState(key, []byte("0"))
			return false, "", nil
		}
		log.Printf("Failed to query user auth state for %d: %v", userID, err)
		return false, "", err
	}

	if user.Status != 1 {
		cacheUserAuthState(key, []byte("0"))
		return false, "", nil
	}
	cacheUserAuthState(key, []byte("1:"+user.Role))
	return true, user.Role, nil
}

func cacheUserAuthState(key string, value []byte) {
	if err := cache.Set(key, value, userAuthCacheTTL); err != nil {
		slog.Debug("Unable to cache user auth state", "error", err)
	}
}

// GetUserID returns the authenticated user ID from the request context.
func GetUserID(c *gin.Context) int64 {
	if userID, exists := c.Get("user_id"); exists {
		return userID.(int64)
	}
	return 0
}

// GetUsername 从上下文获取用户名
func GetUsername(c *gin.Context) string {
	if username, exists := c.Get("username"); exists {
		return username.(string)
	}
	return ""
}

// GetRole 从上下文获取角色
func GetRole(c *gin.Context) string {
	if role, exists := c.Get("role"); exists {
		return role.(string)
	}
	return ""
}
