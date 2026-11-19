import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildCsv, exportCsv } from './csv'

const saveText = vi.hoisted(() => vi.fn())

vi.mock('../../bindings/github.com/primordialweave/zhusuan/internal/desktop', () => ({
  FileExporter: { SaveText: saveText },
}))

type WailsWindow = Window & { _wails?: { environment?: { OS?: string } } }

afterEach(() => {
  delete (window as WailsWindow)._wails
  saveText.mockReset()
  vi.restoreAllMocks()
})

describe('CSV export', () => {
  it('quotes every cell and opens with a byte-order mark for Excel', () => {
    expect(
      buildCsv([
        ['名称', '金额'],
        ['他说 "好"', 1200.5],
        [null, undefined],
      ]),
    ).toBe('\uFEFF"名称","金额"\n"他说 ""好""","1200.5"\n"",""')
  })

  it.each([
    '=HYPERLINK("https://example.invalid","项目")',
    '+SUM(1,2)',
    '-1+2',
    '@SUM(1,2)',
    '  =1+2',
    '\t项目',
    '\r项目',
    '\n项目',
    '  \t项目',
  ])('exports a spreadsheet-sensitive string as literal text: %j', (value) => {
    expect(buildCsv([[value]])).toBe(`\uFEFF"'${value.replace(/"/g, '""')}"`)
  })

  it('preserves numeric amounts including negative values and safe literal strings', () => {
    expect(buildCsv([[-1200.5, 0, 1200.5, '项目-1', ' 客户', "'备注"]])).toBe(
      '\uFEFF"-1200.5","0","1200.5","项目-1"," 客户","\'备注"',
    )
  })

  it('saves through the native dialog in the desktop app', async () => {
    ;(window as WailsWindow)._wails = { environment: { OS: 'darwin' } }
    saveText.mockResolvedValueOnce('/Users/me/报表.csv').mockResolvedValueOnce('')

    await expect(exportCsv('报表.csv', [['a']])).resolves.toEqual({
      path: '/Users/me/报表.csv',
      status: 'saved',
    })
    expect(saveText).toHaveBeenCalledWith('报表.csv', '\uFEFF"a"')
    await expect(exportCsv('报表.csv', [['a']])).resolves.toEqual({ status: 'cancelled' })
  })

  it('downloads through a link in a browser', async () => {
    const createObjectURL = vi.fn(() => 'blob:orange')
    const revokeObjectURL = vi.fn()
    Object.assign(URL, { createObjectURL, revokeObjectURL })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    await expect(exportCsv('报表.csv', [['a']])).resolves.toEqual({ status: 'downloaded' })
    expect(click).toHaveBeenCalledOnce()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:orange')
    expect(saveText).not.toHaveBeenCalled()
    expect(document.querySelector('a[download]')).toBeNull()
  })
})
