import { FileExporter } from '../../bindings/github.com/primordialweave/zhusuan/internal/desktop'
import { isDesktopRuntime } from './desktopManager'

export type CsvValue = number | string | null | undefined

const escapeCsvCell = (value: CsvValue) => {
  const text = String(value ?? '')
  // Quoting alone does not stop spreadsheet apps from evaluating a formula.
  const safeText =
    typeof value === 'string' && /^(?:\s*[=+@-]|\s*[\t\r\n])/.test(text) ? `'${text}` : text
  return `"${safeText.replace(/"/g, '""')}"`
}

/** Excel-friendly CSV: a byte-order mark, quoted cells, and literal user-entered strings. */
export const buildCsv = (rows: CsvValue[][]) =>
  `\uFEFF${rows.map((row) => row.map(escapeCsvCell).join(',')).join('\n')}`

export type CsvExportResult =
  { status: 'cancelled' } | { status: 'downloaded' } | { path: string; status: 'saved' }

/**
 * Hands a CSV to the user. The desktop webview ignores download links, so there the app's
 * own save dialog writes the file; a browser downloads it. Rejects when the file cannot be
 * written.
 */
export async function exportCsv(filename: string, rows: CsvValue[][]): Promise<CsvExportResult> {
  const csv = buildCsv(rows)
  if (isDesktopRuntime()) {
    const path = await FileExporter.SaveText(filename, csv)
    return path ? { path, status: 'saved' } : { status: 'cancelled' }
  }

  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
  return { status: 'downloaded' }
}
