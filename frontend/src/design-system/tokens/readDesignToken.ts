export type DesignTokenName = `--ods-${string}`

/**
 * Reads the resolved value of a semantic token for consumers that cannot use CSS variables,
 * such as Canvas and Chart.js. Returns an empty string when the token is not available, so the
 * consumer falls back to its own default instead of a second colour table.
 */
export function readDesignToken(name: DesignTokenName, element?: Element | null): string {
  if (typeof document === 'undefined') return ''
  return getComputedStyle(element ?? document.documentElement)
    .getPropertyValue(name)
    .trim()
}
