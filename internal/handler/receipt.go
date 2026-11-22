package handler

import (
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/primordialweave/zhusuan/internal/dto"
	"github.com/primordialweave/zhusuan/internal/pkg/response"
)

func receiptScope(c *gin.Context) (period string, year, month int, ok bool) {
	period = c.DefaultQuery("period", "month")
	year, month, chosen, ok := calendarPeriod(c)
	if !ok {
		return period, year, month, false
	}
	if !chosen && c.Query("month") != "" {
		value, err := strconv.Atoi(c.Query("month"))
		if err != nil || value != 0 {
			response.ParamError(c, "年份或月份无效")
			return period, 0, 0, false
		}
	}
	return period, year, month, true
}

// ReceiptOverview reports current balances of period-signed contracts and period cash receipts.
// @Summary 合同应收与实际收款统计
// @Description 合同指标按所选周期的签约日期筛选合同，计算该批合同截至现在的已收、未收和超收；期间收款按实际到账日独立统计。all包含无签约日期和无实际到账日的历史记录。
// @Tags Dashboard
// @Security Bearer
// @Produce json
// @Param period query string false "自然周期: week, month, quarter, year, all (默认month)"
// @Param year query int false "自选自然年份，传入后忽略period"
// @Param month query int false "自选月份1-12；0或不传表示全年"
// @Success 200 {object} response.Response{data=dto.ReceiptOverview}
// @Failure 400 {object} response.Response
// @Failure 401 {object} response.Response
// @Router /api/v1/dashboard/receipt-overview [get]
func (h *DashboardHandler) ReceiptOverview(c *gin.Context) {
	period, year, month, ok := receiptScope(c)
	if !ok {
		return
	}
	var result *dto.ReceiptOverview
	result, err := h.dashboardService.GetReceiptOverview(c.GetInt64("user_id"), period, year, month)
	if err != nil {
		response.HandleServiceError(c, err, "获取合同与收款统计失败")
		return
	}
	response.Success(c, result)
}

// ReceiptTrend returns actual cash receipts grouped by natural calendar days or months.
// @Summary 实际收款趋势
// @Description 自然周期按实际到账日聚合已确认收款；不包含待收计划或缺少实际到账日的历史记录。
// @Tags Dashboard
// @Security Bearer
// @Produce json
// @Param period query string false "自然周期: week, month, quarter, year, all (默认month)"
// @Param year query int false "自选自然年份，传入后忽略period"
// @Param month query int false "自选月份1-12；0或不传表示全年"
// @Success 200 {object} response.Response{data=dto.IncomeTrend}
// @Failure 400 {object} response.Response
// @Failure 401 {object} response.Response
// @Router /api/v1/dashboard/receipt-trend [get]
func (h *DashboardHandler) ReceiptTrend(c *gin.Context) {
	period, year, month, ok := receiptScope(c)
	if !ok {
		return
	}
	var result *dto.IncomeTrend
	result, err := h.dashboardService.GetReceiptTrend(c.GetInt64("user_id"), period, year, month)
	if err != nil {
		response.HandleServiceError(c, err, "获取实际收款趋势失败")
		return
	}
	response.Success(c, result)
}
