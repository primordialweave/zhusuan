/** Parses a positive integer deep-link ID without accepting NaN, exponents, or rounded IDs. */
export function parseRouteId(value: string | undefined): number | null {
  if (!value || !/^\d+$/.test(value)) return null
  const id = Number(value)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}
