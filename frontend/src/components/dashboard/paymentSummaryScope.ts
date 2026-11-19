/** What the workbench summary counts: everything, this calendar year, or this calendar month. */
export type PaymentSummaryScope = 'all' | 'year' | 'month'

export const PAYMENT_SUMMARY_SCOPES: PaymentSummaryScope[] = ['all', 'year', 'month']
