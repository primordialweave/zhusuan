package dto

// ReceiptOverview separates current balances of contracts signed in the selected
// calendar period from cash received in it. An all scope includes every contract.
type ReceiptOverview struct {
	ContractTotal    float64 `json:"contract_total"`
	ReceivedTotal    float64 `json:"received_total"`
	ContractReceived float64 `json:"contract_received"`
	OutstandingTotal float64 `json:"outstanding_total"`
	OverpaidTotal    float64 `json:"overpaid_total"`
	PeriodReceived   float64 `json:"period_received"`
	PeriodCount      int64   `json:"period_count"`
	StartDate        string  `json:"start_date"`
	EndDate          string  `json:"end_date"`
}
