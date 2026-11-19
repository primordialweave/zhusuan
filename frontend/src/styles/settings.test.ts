import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const readSource = (path: string) => readFileSync(resolve(path), 'utf8')

const dataSyncSource = readSource('src/components/settings/DataSyncPanel.tsx')
const dictionarySource = readSource('src/components/settings/DictionaryManagement.tsx')
const mainCss = readSource('src/assets/main.css')
const notificationSource = readSource('src/components/settings/NotificationManagement.tsx')
const radioCss = readSource('src/design-system/components/radio-group/radio-group.css')
const radioSource = readSource('src/design-system/components/radio-group/RadioGroup.tsx')
const settingsCss = readSource('src/styles/settings.css')
const settingsSource = readSource('src/views/SettingsView.tsx')
const tabsCss = readSource('src/design-system/components/tabs/tabs.css')
const tokenSource = readSource('src/components/settings/TokenManagement.tsx')
const userSource = readSource('src/components/settings/UserManagement.tsx')

const settingsProductionSource = [
  dataSyncSource,
  dictionarySource,
  notificationSource,
  settingsSource,
  tokenSource,
  userSource,
].join('\n')

describe('settings design-system ownership contract', () => {
  it('keeps feature CSS on business layout without reaching into ODS anatomy', () => {
    expect(settingsCss).not.toContain('.ods-')
    expect(settingsCss).not.toMatch(/var\(--(?!ods-)/)
    expect(settingsCss).not.toContain('!important')
  })

  it('uses shared card radios for the database, token-expiry and theme choices', () => {
    expect(radioSource).toContain("variant?: 'card' | 'default'")
    expect(radioSource).toContain('columns?: 1 | 2 | 3')
    expect(radioCss).toContain(".ods-radio[data-variant='card']")
    expect(dataSyncSource).toContain('columns={3}')
    expect(tokenSource).toContain('columns={2}')
    expect(settingsProductionSource.match(/variant="card"/g)).toHaveLength(3)
    expect(settingsSource).toContain('<RadioGroup')
    expect(settingsSource).not.toContain('<SegmentedControl')
  })

  it('uses shared Tabs treatments for the settings strip and dictionary sidebar', () => {
    expect(tabsCss).toContain(".ods-tabs__list[data-variant='underline']")
    expect(tabsCss).toContain(".ods-tabs__list[data-variant='navigation']")
    expect(tabsCss).toMatch(
      /data-variant='navigation'\] \.ods-tabs__tab\s*\{[\s\S]*gap:\s*var\(--ods-space-3\)/,
    )
    expect(tabsCss).toMatch(/data-variant='underline'\]\s*\{[\s\S]*overflow-x:\s*auto/)
    expect(settingsSource).toContain("variant={stacked ? 'underline' : 'navigation'}")
    expect(dictionarySource).toContain('variant="accent"')
  })

  it('builds every page from the one group card, with its actions packed to the end', () => {
    const groupSource = readSource('src/components/settings/SettingsGroup.tsx')

    expect(groupSource).toContain('<Card.Root')
    expect(settingsSource).not.toContain('<Card.Root')
    expect(settingsSource).not.toContain('<SectionHeader')
    expect(settingsSource).toContain('<PageHeader title="系统设置" />')
    expect(settingsSource.match(/<SettingsGroup\b/g)?.length).toBeGreaterThanOrEqual(6)
    expect(settingsCss).toMatch(/\.settings-group__footer\s*\{[^}]*justify-content:\s*flex-end/)
    expect(settingsCss).toMatch(/\.settings-row \+ \.settings-row\s*\{[^}]*border-block-start/)
  })

  it('shares the global foreground and typography tokens across settings', () => {
    expect(settingsCss).not.toContain('--ods-color-fg-default:')
    expect(settingsCss).not.toContain('--ods-font-weight-semibold:')
    expect(settingsCss).not.toContain('--ods-font-weight-bold:')
    expect(settingsSource).not.toContain('className="settings-overview"')
  })

  it('does not attach legacy primitive classes to ODS controls', () => {
    expect(settingsProductionSource).not.toMatch(
      /(?:dev-create-btn|dev-action-btn|sync-action-btn|update-btn|action-btn|dev-expiry-option|sync-db-type-option)/,
    )
    expect(settingsProductionSource).not.toContain('className="settings-modal"')
    expect(settingsProductionSource).not.toMatch(/className=.*(?:role-admin|status-active)/)
  })

  it('keeps portalled form spacing on an explicit modal-body layout hook', () => {
    expect(settingsCss).toMatch(/\.settings-modal-body\s*\{[\s\S]*display:\s*grid/)
    expect(settingsCss).not.toMatch(/\.settings-modal-body\s+\.ods-/)
    expect(settingsProductionSource).toContain('className="settings-modal-body"')
  })

  it('removes Settings component implementations from the legacy global bundle', () => {
    expect(mainCss).not.toContain('components/settings/')
    expect(mainCss).not.toContain('views/SettingsView.tsx')
    expect(mainCss).not.toMatch(
      /\.(?:dev-create-btn|dev-action-btn|sync-action-btn|update-btn|action-btn)(?:[.\s:{]|$)/,
    )
  })

  it('names a panel once, on its tab, and opens list pages with one toolbar row', () => {
    expect(settingsProductionSource).not.toContain('<SectionHeader')
    expect(settingsProductionSource).not.toMatch(/className="(?:dev|sync)-stat/)
    expect(settingsProductionSource.match(/className="settings-toolbar"/g)).toHaveLength(5)
    expect(settingsProductionSource).not.toMatch(
      /className="(?:nav-header|dev-header|dev-header-content|dev-title-section|dev-title-info|dev-title|dev-subtitle|dev-icon-wrapper|appearance-header|appearance-header-main|appearance-title-wrapper|appearance-title-content|appearance-title|appearance-subtitle|appearance-icon|sync-title-wrapper|sync-title|sync-subtitle|sync-icon)"/,
    )
    expect(settingsCss).not.toMatch(
      /\.(?:nav-header|dev-header|dev-header-content|dev-title-section|dev-title-info|dev-title|dev-subtitle|dev-icon-wrapper|appearance-header|appearance-header-main|appearance-title-wrapper|appearance-title-content|appearance-title|appearance-subtitle|appearance-icon|sync-title-wrapper|sync-title|sync-subtitle|sync-icon)(?:[\s,.:{]|$)/,
    )
  })

  it('lists users, dictionary entries and tokens in ODS tables, not hand-built cards', () => {
    for (const source of [userSource, dictionarySource, tokenSource]) {
      expect(source).toContain('<Table.Root')
      expect(source).not.toContain('<Card.Root')
    }
    expect(settingsCss).not.toMatch(/\.(?:user-card|dev-token-card|notification-card|dict-item)\b/)
  })

  it('uses ODS Table and form patterns instead of rebuilding card slots and tabular rows', () => {
    expect(dataSyncSource).toContain('<Table.Root')
    expect(dataSyncSource).toContain('<Table.Header>')
    expect(dataSyncSource).toContain('<Table.Column')
    expect(dataSyncSource).toContain('<Table.Body>')
    expect(dataSyncSource).not.toMatch(
      /className="sync-(?:form-header|form-body|form-footer|table-header|table-body|data-grid|data-row)"/,
    )
    expect(settingsCss).not.toMatch(
      /\.settings-view \.sync-(?:form-header|form-body|form-footer|table-header|table-body|data-grid|data-row)(?:[\s,.:{]|$)/,
    )
  })
})
