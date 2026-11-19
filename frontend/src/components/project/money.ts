// Keep the editing text (including a trailing dot) while limiting precision to cents.
export const isMoneyDraft = (value: string) => /^\d*(?:\.\d{0,2})?$/.test(value)
export const isPositiveMoney = (value: string) =>
  /^\d+(?:\.\d{1,2})?$/.test(value) && Number.isFinite(Number(value)) && Number(value) > 0

export function formatMoneyDraft(value: string): string {
  if (!isMoneyDraft(value) || !/\d/.test(value)) return value
  const [whole = '', fraction = ''] = value.split('.')
  return `${whole.replace(/^0+(?=\d)/, '') || '0'}.${fraction.padEnd(2, '0')}`
}
