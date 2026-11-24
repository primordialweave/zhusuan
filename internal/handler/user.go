package handler

import (
	"github.com/gin-gonic/gin"

	"github.com/primordialweave/zhusuan/internal/dto"
	"github.com/primordialweave/zhusuan/internal/middleware"
	"github.com/primordialweave/zhusuan/internal/pkg/response"
	"github.com/primordialweave/zhusuan/internal/service"
)

// UserHandler manages user accounts behind the router's administrator guard.
type UserHandler struct {
	userService *service.UserService
}

// NewUserHandler creates the administrative account handler.
func NewUserHandler() *UserHandler {
	return &UserHandler{
		userService: service.NewUserService(),
	}
}

// List 获取用户列表
func (h *UserHandler) List(c *gin.Context) {
	// 权限校验由路由层 AdminOnly 中间件统一处理

	page, pageSize := response.GetPagination(c)
	keyword := c.Query("keyword")

	result, err := h.userService.ListUsers(page, pageSize, keyword)
	if err != nil {
		response.HandleServiceError(c, err, "获取用户列表失败")
		return
	}

	response.Success(c, result)
}

// Create 创建用户
func (h *UserHandler) Create(c *gin.Context) {
	// 权限校验由路由层 AdminOnly 中间件统一处理

	var req dto.CreateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.ParamError(c, err.Error())
		return
	}

	if err := h.userService.CreateUser(req); err != nil {
		response.HandleServiceError(c, err, "创建用户失败")
		return
	}

	response.SuccessWithMessage(c, "用户创建成功", nil)
}

// Update 更新用户
func (h *UserHandler) Update(c *gin.Context) {
	// 权限校验由路由层 AdminOnly 中间件统一处理

	id, err := response.ParseIDParam(c, "id")
	if err != nil {
		response.ParamError(c, "无效的用户ID")
		return
	}

	var req dto.UpdateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.ParamError(c, err.Error())
		return
	}

	user, err := h.userService.UpdateUserAndGet(id, req)
	if err != nil {
		response.HandleServiceError(c, err, "更新用户失败")
		return
	}

	// models.User omits the password from JSON, as the existing profile/list endpoints do.
	response.SuccessWithMessage(c, "更新成功", user)
}

// Delete 删除用户
func (h *UserHandler) Delete(c *gin.Context) {
	// 权限校验由路由层 AdminOnly 中间件统一处理

	id, err := response.ParseIDParam(c, "id")
	if err != nil {
		response.ParamError(c, "无效的用户ID")
		return
	}

	// 简单的自我保护：不能删除自己
	currentUserID := middleware.GetUserID(c)
	if id == currentUserID {
		response.ParamError(c, "不能删除当前登录账号")
		return
	}

	if err := h.userService.DeleteUser(id); err != nil {
		response.HandleServiceError(c, err, "删除用户失败")
		return
	}

	response.SuccessWithMessage(c, "删除成功", nil)
}

// ResetPassword 重置密码
func (h *UserHandler) ResetPassword(c *gin.Context) {
	// 权限校验由路由层 AdminOnly 中间件统一处理

	id, err := response.ParseIDParam(c, "id")
	if err != nil {
		response.ParamError(c, "无效的用户ID")
		return
	}

	var req dto.ResetPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.ParamError(c, "请输入新密码")
		return
	}

	if err := h.userService.ResetPassword(id, req.NewPassword); err != nil {
		response.HandleServiceError(c, err, "重置密码失败")
		return
	}

	response.SuccessWithMessage(c, "密码重置成功", nil)
}
