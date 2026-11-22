package dto

// PaymentRequest 收款请求
type PaymentRequest struct {
	ProjectID  int64   `json:"project_id" binding:"required"`
	Stage      string  `json:"stage"`
	Amount     float64 `json:"amount" binding:"required,gt=0"`
	Percentage float64 `json:"percentage"`
	PlanDate   string  `json:"plan_date"`
	ActualDate string  `json:"actual_date"`
	// Status on creation defaults to confirmed for actual-date input, pending for legacy plan-only input.
	// Omitted status on update preserves the existing state.
	// "paid" is a legacy alias normalized to confirmed.
	Status string `json:"status" binding:"omitempty,oneof=pending confirmed overdue paid"`
	Method string `json:"method"`
	Remark string `json:"remark"`
	UserID int64  `json:"-"`
}

// ConfirmPaymentRequest 确认收款请求
type ConfirmPaymentRequest struct {
	ActualDate string `json:"actual_date" binding:"required"`
	Method     string `json:"method"`
}
