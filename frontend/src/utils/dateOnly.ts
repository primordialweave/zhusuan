/** Preserves the calendar date carried by an API timestamp without converting its timezone. */
export function toDateOnly(value: string | null | undefined): string {
  if (!value) return ''
  return /^\d{4}-\d{2}-\d{2}(?:T|$)/.test(value) ? value.slice(0, 10) : value
}
