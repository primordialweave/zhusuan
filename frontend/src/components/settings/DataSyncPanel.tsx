import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { syncApi, type SyncConfig, type SyncResult, type TableCompareResult } from '@/api/sync'
import { useConfirm } from '@/composables/useConfirm'
import { useToastStore } from '@/composables/useToast'
import {
  Button,
  Chip,
  EmptyState,
  Field,
  FormGrid,
  Input,
  Radio,
  RadioGroup,
  Select,
  Spinner,
  Table,
} from '@/design-system'
import SettingsGroup from './SettingsGroup'

const defaultConfig: SyncConfig = {
  db_name: '',
  db_type: 'postgres',
  host: '',
  password: '',
  port: 5432,
  ssl_mode: 'require',
  user: '',
}

const dbTypeOptions = [
  { icon: 'ri-database-2-fill', label: 'PostgreSQL / Supabase / Nile', value: 'postgres' },
  { icon: 'ri-database-2-line', label: 'MySQL / TiDB', value: 'mysql' },
]

const tableLabels: Record<string, string> = {
  dictionaries: '字典分类',
  dictionary_item: '字典详情',
  notifications: '通知表',
  payments: '收款表',
  personal_access_tokens: '访问令牌',
  projects: '项目表',
  user_notifications: '用户通知状态',
  users: '用户表',
}

export default function DataSyncPanel() {
  const { confirm } = useConfirm()
  const toastError = useToastStore((state) => state.error)
  const toastSuccess = useToastStore((state) => state.success)
  const toastWarning = useToastStore((state) => state.warning)
  const [cloudConfig, setCloudConfig] = useState<SyncConfig>(defaultConfig)
  const [loading, setLoading] = useState(false)
  const [testLoading, setTestLoading] = useState(false)
  const [syncLoading, setSyncLoading] = useState(false)
  const [compareResults, setCompareResults] = useState<TableCompareResult[]>([])
  const [syncResults, setSyncResults] = useState<SyncResult[]>([])
  const [step, setStep] = useState<'compare' | 'config' | 'sync'>('config')
  const refreshTimer = useRef<number | null>(null)

  const diffCount = useMemo(
    () => compareResults.filter((result) => result.local_count !== result.remote_count).length,
    [compareResults],
  )
  const syncedCount = useMemo(
    () => syncResults.filter((result) => result.success).length,
    [syncResults],
  )

  const updateConfig = (patch: Partial<SyncConfig>) => {
    setCloudConfig((current) => ({ ...current, ...patch }))
  }

  const handleDbTypeChange = (dbType: string) => {
    setCloudConfig((current) => ({
      ...current,
      db_type: dbType,
      port: dbType === 'mysql' ? 3306 : 5432,
      ssl_mode: dbType === 'mysql' ? 'false' : 'require',
    }))
  }

  const getSyncResultForTable = useCallback(
    (tableName: string) => syncResults.find((result) => result.table_name === tableName),
    [syncResults],
  )

  const compareData = useCallback(async () => {
    setLoading(true)
    setStep('compare')
    setCompareResults([])
    setSyncResults([])

    try {
      const response = await syncApi.compare(cloudConfig)
      setCompareResults(response.data.data)
    } catch {
      toastError('获取对比数据失败')
    } finally {
      setLoading(false)
    }
  }, [cloudConfig, toastError])

  const testConnection = async () => {
    if (!cloudConfig.host || !cloudConfig.user || !cloudConfig.db_name) {
      toastWarning('请填写完整的数据库连接信息')
      return
    }

    setTestLoading(true)
    try {
      await syncApi.testConnection(cloudConfig)
      toastSuccess('连接成功')
      await compareData()
    } catch {
      toastError('连接失败，请检查网络或配置')
    } finally {
      setTestLoading(false)
    }
  }

  const startSync = async () => {
    const confirmed = await confirm({
      actionLabel: '开始同步',
      actionVariant: 'danger',
      message: '此操作将把本地数据覆盖写入到云端数据库，云端已有的同ID数据将被更新。确定要继续吗？',
      title: '确认同步',
    })
    if (!confirmed) return

    setSyncLoading(true)
    setStep('sync')

    try {
      const tables = compareResults.map((result) => result.table_name)
      const response = await syncApi.execute(cloudConfig, tables)
      const results = response.data.data
      setSyncResults(results)

      const failed = results.filter((result) => !result.success)
      if (failed.length > 0) {
        toastWarning(`同步完成，但有 ${failed.length} 个表同步失败`)
      } else {
        toastSuccess('所有数据同步成功！')
        refreshTimer.current = window.setTimeout(() => {
          void compareData()
        }, 1000)
      }
    } catch {
      toastError('同步过程中发生错误')
    } finally {
      setSyncLoading(false)
    }
  }

  const loadConfig = useCallback(async () => {
    try {
      const response = await syncApi.getConfig()
      const config = response.data.data as Partial<SyncConfig> | undefined
      if (!config?.host) return

      setCloudConfig((current) => ({
        ...current,
        ...config,
        port: Number(config.port) || current.port,
      }))
    } catch {
      toastError('加载同步配置失败')
    }
  }, [toastError])

  useEffect(() => {
    const timer = window.setTimeout(loadConfig, 0)
    return () => window.clearTimeout(timer)
  }, [loadConfig])

  useEffect(() => {
    return () => {
      if (refreshTimer.current) window.clearTimeout(refreshTimer.current)
    }
  }, [])

  return (
    <div className="data-sync-panel settings-page">
      {step === 'config' ? (
        <SettingsGroup
          footer={
            <>
              <span className="settings-group__note">
                本地数据单向同步到云端；数据库凭据只用于本机连接
              </span>
              <Button onClick={() => void testConnection()} pending={testLoading}>
                <span>{testLoading ? '正在测试...' : '测试连接并下一步'}</span>
                {!testLoading ? <i aria-hidden="true" className="ri-arrow-right-line" /> : null}
              </Button>
            </>
          }
          title="云端数据库"
        >
          <div className="sync-config">
            <RadioGroup
              aria-label="数据库类型"
              columns={3}
              onValueChange={handleDbTypeChange}
              value={cloudConfig.db_type}
            >
              {dbTypeOptions.map((option) => (
                <Radio key={option.value} value={option.value} variant="card">
                  <span className="sync-db-option-content">
                    <i aria-hidden="true" className={option.icon} />
                    <span>{option.label}</span>
                  </span>
                </Radio>
              ))}
            </RadioGroup>

            <FormGrid columns={3}>
              <Field.Root className="settings-field--wide">
                <Field.Label>主机地址</Field.Label>
                <Input
                  onChange={(event) => updateConfig({ host: event.target.value })}
                  placeholder="例如: aws-0-ap-northeast-1.pooler.supabase.com"
                  type="text"
                  value={cloudConfig.host}
                />
              </Field.Root>
              <Field.Root>
                <Field.Label>端口</Field.Label>
                <Input
                  inputMode="numeric"
                  onChange={(event) =>
                    updateConfig({ port: Number(event.target.value.replace(/\D/g, '')) })
                  }
                  type="text"
                  value={cloudConfig.port || ''}
                />
              </Field.Root>
              <Field.Root>
                <Field.Label>数据库名</Field.Label>
                <Input
                  onChange={(event) => updateConfig({ db_name: event.target.value })}
                  placeholder="例如: postgres"
                  type="text"
                  value={cloudConfig.db_name}
                />
              </Field.Root>
              <Field.Root>
                <Field.Label>用户名</Field.Label>
                <Input
                  onChange={(event) => updateConfig({ user: event.target.value })}
                  type="text"
                  value={cloudConfig.user}
                />
              </Field.Root>
              <Field.Root>
                <Field.Label>密码</Field.Label>
                <Input
                  onChange={(event) => updateConfig({ password: event.target.value })}
                  placeholder="••••••••"
                  type="password"
                  value={cloudConfig.password || ''}
                />
              </Field.Root>
              {cloudConfig.db_type === 'postgres' ? (
                <Field.Root>
                  <Field.Label>SSL 模式</Field.Label>
                  <Select
                    aria-label="SSL 模式"
                    onValueChange={(value) => updateConfig({ ssl_mode: value })}
                    options={[
                      { label: 'Disable', value: 'disable' },
                      { label: 'Require (推荐)', value: 'require' },
                      { label: 'Verify Full', value: 'verify-full' },
                    ]}
                    value={cloudConfig.ssl_mode || 'require'}
                  />
                </Field.Root>
              ) : null}
            </FormGrid>
          </div>
        </SettingsGroup>
      ) : (
        <>
          <div className="settings-toolbar">
            <div className="sync-connection">
              <span className="sync-connection-indicator">
                <span className="sync-pulse" />
                <span className="sync-dot" />
              </span>
              <Chip size="sm" tone="success">
                {cloudConfig.db_type === 'postgres' ? 'PostgreSQL' : 'MySQL'}
              </Chip>
              <span className="sync-connection-host">{cloudConfig.host}</span>
            </div>
            <div className="settings-toolbar__actions">
              <Button onClick={() => setStep('config')} variant="ghost">
                修改配置
              </Button>
              <Button
                disabled={loading || syncLoading}
                onClick={() => void compareData()}
                variant="secondary"
              >
                <i aria-hidden="true" className={`ri-refresh-line ${loading ? 'spinning' : ''}`} />
                <span>重新对比</span>
              </Button>
              <Button disabled={loading} onClick={() => void startSync()} pending={syncLoading}>
                {!syncLoading ? <i aria-hidden="true" className="ri-upload-cloud-2-line" /> : null}
                <span>开始同步</span>
              </Button>
            </div>
          </div>

          <dl className="settings-stats">
            <div>
              <dt>数据表</dt>
              <dd>{compareResults.length}</dd>
            </div>
            <div>
              <dt>待同步</dt>
              <dd>{diffCount}</dd>
            </div>
            <div>
              <dt>已同步</dt>
              <dd>{syncedCount}</dd>
            </div>
          </dl>

          {loading ? (
            <Spinner className="settings-empty" label="正在分析数据库差异" size="lg" />
          ) : compareResults.length === 0 ? (
            <EmptyState
              className="settings-empty"
              icon={<i className="ri-inbox-archive-line" />}
              size="md"
              title="暂无对比数据"
            />
          ) : (
            <Table.Root aria-label="数据对比明细" className="settings-table">
              <Table.Header>
                <Table.Row>
                  <Table.Column>数据表</Table.Column>
                  <Table.Column align="center">本地</Table.Column>
                  <Table.Column align="center">云端</Table.Column>
                  <Table.Column align="center">状态</Table.Column>
                  <Table.Column align="end">同步结果</Table.Column>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {compareResults.map((result) => {
                  const syncResult = getSyncResultForTable(result.table_name)
                  return (
                    <Table.Row key={result.table_name}>
                      <Table.Cell>
                        <div className="sync-table-info">
                          <div className="sync-table-name">
                            {tableLabels[result.table_name] || result.table_name}
                          </div>
                          <div className="sync-table-code">{result.table_name}</div>
                        </div>
                      </Table.Cell>
                      <Table.Cell align="center">{result.local_count}</Table.Cell>
                      <Table.Cell align="center">
                        {result.remote_count === -1 ? (
                          <Chip size="sm" tone="danger">
                            连接失败
                          </Chip>
                        ) : (
                          result.remote_count
                        )}
                      </Table.Cell>
                      <Table.Cell align="center">
                        {result.local_count !== result.remote_count ? (
                          <Chip size="sm" tone="warning">
                            <i className="ri-alert-line" />
                            <span>差异</span>
                          </Chip>
                        ) : (
                          <Chip size="sm" tone="success">
                            <i className="ri-check-line" />
                            <span>一致</span>
                          </Chip>
                        )}
                      </Table.Cell>
                      <Table.Cell align="end">
                        {syncResult ? (
                          syncResult.success ? (
                            <span className="sync-result-success">
                              <i className="ri-check-double-line" />
                              <span>已同步 {syncResult.synced_count} 条</span>
                            </span>
                          ) : (
                            <span className="sync-result-error" title={syncResult.error_message}>
                              <i className="ri-error-warning-line" />
                              <span>同步失败</span>
                            </span>
                          )
                        ) : (
                          <span className="sync-result-pending">—</span>
                        )}
                      </Table.Cell>
                    </Table.Row>
                  )
                })}
              </Table.Body>
            </Table.Root>
          )}
        </>
      )}
    </div>
  )
}
