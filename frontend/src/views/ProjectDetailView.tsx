import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { dictionaryApi, type DictionaryItem } from '@/api/dictionary'
import { projectApi, type Payment, type Project } from '@/api/project'
import { PaymentStatusChip, ProjectStatusChip } from '@/components/project/ProjectStatusChip'
import {
  Button,
  ButtonGroup,
  Card,
  CircularProgress,
  EmptyScene,
  EmptyState,
  IconButton,
  JadeIcon,
  PageHeader,
  RouterButton,
  SectionHeader,
  Skeleton,
  Surface,
  Tabs,
} from '@/design-system'
import { useProjectExport } from '@/components/project/useProjectExport'
import { useToastStore } from '@/composables/useToast'
import { formatCurrency, formatDate } from '@/utils/format'
import { toDateOnly } from '@/utils/dateOnly'
import '@/styles/project-domain.css'
import '@/styles/main-page-loading.css'

const paymentStageLabels: Record<string, string> = {
  all: '全款',
  deposit: '预付款',
  final: '尾款',
  milestone: '阶段款',
  progress: '进度款',
  receipt: '收款',
}

const paymentMethodLabels: Record<string, string> = {
  alipay: '支付宝',
  bank_transfer: '银行转账',
  cash: '现金',
  wechat: '微信',
}

const projectTypeLabels: Record<string, string> = {
  consulting: '技术咨询',
  design: 'UI设计',
  mobile: '移动应用',
  other: '其他',
  saas: 'SaaS系统',
  service: '运营服务',
  software: '软件开发',
  web: 'Web开发',
}

const isPaymentSettled = (payment: Payment) =>
  payment.status === 'paid' || payment.status === 'confirmed'

const getPaymentStageLabel = (stage: string) => paymentStageLabels[stage] || stage || '款项'

const getPaymentMethodLabel = (method: string) => paymentMethodLabels[method] || method || '未设置'

export default function ProjectDetailView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedTab = searchParams.get('tab')
  const requestedPayment = searchParams.get('payment')
  const toastError = useToastStore((state) => state.error)
  const { exportProject, lastSavedExport } = useProjectExport()
  const [project, setProject] = useState<Project | null>(null)
  const [projectTypes, setProjectTypes] = useState<DictionaryItem[]>([])
  const [projectTypesLoading, setProjectTypesLoading] = useState(true)
  const [payments, setPayments] = useState<Payment[]>([])
  const [loadErrorProjectId, setLoadErrorProjectId] = useState<number | null>(null)
  const [loadingProjectId, setLoadingProjectId] = useState<number | null>(null)
  const positionedPaymentRef = useRef<string | null>(null)
  const isMountedRef = useRef(false)
  const loadGenerationRef = useRef(0)
  const projectId = id ? Number(id) : null
  const activeProjectIdRef = useRef<number | null>(projectId)

  const activeTab = requestedTab === 'payments' ? 'payments' : 'overview'

  useLayoutEffect(() => {
    activeProjectIdRef.current = projectId
  }, [projectId])

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      loadGenerationRef.current += 1
    }
  }, [])

  useEffect(() => {
    let active = true
    void dictionaryApi
      .getItems('project_type')
      .then((response) => {
        if (active) setProjectTypes(response.data.data)
      })
      .catch(() => {
        // A dictionary failure must not prevent viewing the project or its payment plan.
      })
      .finally(() => {
        if (active) setProjectTypesLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const selectTab = (tab: string) => {
    const nextSearchParams = new URLSearchParams(searchParams)
    if (tab === 'payments') {
      nextSearchParams.set('tab', 'payments')
    } else {
      nextSearchParams.delete('tab')
      nextSearchParams.delete('payment')
    }
    setSearchParams(nextSearchParams, { replace: true })
  }

  const loadProject = useCallback(
    async (requestedProjectId: number) => {
      if (!isMountedRef.current || activeProjectIdRef.current !== requestedProjectId) return

      const loadGeneration = ++loadGenerationRef.current
      setLoadErrorProjectId(null)
      setLoadingProjectId(requestedProjectId)
      try {
        const [projectRes, paymentsRes] = await Promise.all([
          projectApi.get(requestedProjectId),
          projectApi.getPayments(requestedProjectId),
        ])
        if (
          !isMountedRef.current ||
          loadGeneration !== loadGenerationRef.current ||
          activeProjectIdRef.current !== requestedProjectId
        ) {
          return
        }
        setProject(projectRes.data.data)
        setPayments(paymentsRes.data.data)
      } catch {
        if (
          !isMountedRef.current ||
          loadGeneration !== loadGenerationRef.current ||
          activeProjectIdRef.current !== requestedProjectId
        ) {
          return
        }
        setLoadErrorProjectId(requestedProjectId)
        toastError('获取项目详情失败')
      } finally {
        if (
          isMountedRef.current &&
          loadGeneration === loadGenerationRef.current &&
          activeProjectIdRef.current === requestedProjectId
        ) {
          setLoadingProjectId(null)
        }
      }
    },
    [toastError],
  )

  useEffect(() => {
    const routeGeneration = ++loadGenerationRef.current
    if (projectId === null) return

    const timer = window.setTimeout(() => {
      if (routeGeneration === loadGenerationRef.current) void loadProject(projectId)
    }, 0)
    return () => {
      window.clearTimeout(timer)
      loadGenerationRef.current += 1
    }
  }, [loadProject, projectId])

  useEffect(() => {
    if (activeTab !== 'payments' || !requestedPayment || payments.length === 0) return

    const positionKey = `${id}:${requestedPayment}`
    if (positionedPaymentRef.current === positionKey) return

    const target = document.getElementById(`payment-${requestedPayment}`)
    if (!target) return

    positionedPaymentRef.current = positionKey
    target.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
    target.focus?.({ preventScroll: true })
  }, [activeTab, id, payments, requestedPayment])

  if (projectId !== null && loadErrorProjectId === projectId) {
    return (
      <Card.Root>
        <EmptyState
          action={
            <ButtonGroup>
              <Button onClick={() => void loadProject(projectId)}>重试</Button>
              <RouterButton to="/projects" variant="ghost">
                返回项目列表
              </RouterButton>
            </ButtonGroup>
          }
          icon={<JadeIcon name="warning" size="1em" />}
          role="alert"
          title="项目详情加载失败"
        />
      </Card.Root>
    )
  }

  if (!project || project.id !== projectId) {
    return (
      <div
        aria-busy="true"
        aria-label="正在加载项目详情"
        className="project-detail-view project-detail-loading"
        role="status"
      >
        <PageHeader
          actions={
            <div className="main-loading-row">
              <Skeleton height="2.5rem" width="2.5rem" />
              <Skeleton height="2.5rem" width="2.5rem" />
            </div>
          }
          description={
            <div className="main-loading-row">
              <Skeleton height="1rem" width="60%" />
              <Skeleton height="1.5rem" width="4rem" />
            </div>
          }
          leading={
            <IconButton label="返回项目列表" onClick={() => navigate('/projects')} variant="ghost">
              <JadeIcon motionPreset="interactive" name="arrow-left" size="1em" />
            </IconButton>
          }
          title={
            <>
              <span className="ods-sr-only">项目详情</span>
              <Skeleton height="2.5rem" width="min(100%, 28rem)" />
            </>
          }
        />
        <Skeleton height="2.5rem" width="14rem" />
        {activeTab === 'payments' ? (
          <div className="main-loading-stack main-detail-loading-payments">
            <Skeleton height="1.5rem" width="7rem" />
            {[0, 1, 2].map((row) => (
              <div className="main-detail-loading-payment main-loading-row" key={row}>
                <Skeleton height="2.5rem" shape="circle" width="2.5rem" />
                <div className="main-loading-stack">
                  <Skeleton height="1.25rem" width="40%" />
                  <Skeleton height="1rem" width="65%" />
                </div>
                <Skeleton height="1.25rem" width="5rem" />
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className="main-detail-loading-overview">
              <div className="main-loading-stack">
                <Skeleton height="1rem" width="4rem" />
                <Skeleton height="3rem" width="50%" />
                <Skeleton height="1rem" width="78%" />
              </div>
              <Skeleton height="5.5rem" shape="circle" width="5.5rem" />
            </div>
            <div className="main-detail-loading-columns">
              {[0, 1, 2].map((column) => (
                <div className="main-loading-stack" key={column}>
                  <Skeleton height="1rem" width="40%" />
                  <Skeleton height="1.75rem" width="65%" />
                  <Skeleton height="1rem" width="75%" />
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    )
  }

  const paidAmount = Math.max(project.received_amount || 0, 0)
  const projectTypeLabel =
    projectTypes.find(({ value }) => value === project.type)?.label ||
    projectTypeLabels[project.type] ||
    project.type ||
    '-'
  const remainingAmount = Math.max(project.total_amount - paidAmount, 0)
  const progress = project.total_amount
    ? Math.min(100, Math.max(0, Math.round((paidAmount / project.total_amount) * 100)))
    : 0
  const latestReceipt = payments
    .filter(isPaymentSettled)
    .sort((left, right) =>
      toDateOnly(right.actual_date).localeCompare(toDateOnly(left.actual_date)),
    )[0]
  const runwayStage =
    project.status === 'completed' || project.status === 'archived'
      ? 3
      : project.status === 'notstarted'
        ? 1
        : 2
  const runwayProgress = ((runwayStage - 1) / 2) * 100
  const runwayItems = [
    { date: project.contract_date, label: '合同签署' },
    { date: project.start_date, label: '项目启动' },
    { date: project.end_date, label: '预计完成' },
  ]

  return (
    <div
      aria-busy={loadingProjectId === projectId || undefined}
      className="project-detail-view"
      data-motion-scope="project-detail"
    >
      {loadingProjectId === projectId ? (
        <>
          <span className="ods-sr-only" role="status">
            正在更新项目详情
          </span>
          <Skeleton className="project-detail-load-indicator" height={2} />
        </>
      ) : null}
      <PageHeader
        actions={
          <ButtonGroup aria-label="项目操作" className="project-detail-actions">
            <IconButton
              label="编辑项目"
              onClick={() => navigate(`/projects/edit/${project.id}`)}
              title="编辑项目"
              variant="tertiary"
            >
              <JadeIcon motionPreset="interactive" name="edit" size="1em" />
            </IconButton>
            <IconButton
              label={`导出项目：${project.name}`}
              onClick={() => void exportProject(project, payments)}
              title="导出项目"
              variant="tertiary"
            >
              <JadeIcon
                motionPreset="interactive"
                name="download"
                reaction={
                  lastSavedExport?.projectId === project.id
                    ? { eventKey: lastSavedExport.eventKey, kind: 'saved' }
                    : undefined
                }
                size="1em"
              />
            </IconButton>
          </ButtonGroup>
        }
        description={
          <span className="project-detail-meta">
            <span>客户：{project.company}</span>
            {project.contract_number ? (
              <span className="project-detail-meta__contract">{project.contract_number}</span>
            ) : null}
            <ProjectStatusChip status={project.status} />
          </span>
        }
        leading={
          <IconButton label="返回项目列表" onClick={() => navigate('/projects')} variant="ghost">
            <JadeIcon motionPreset="interactive" name="arrow-left" size="1em" />
          </IconButton>
        }
        title={project.name}
      />

      <Tabs.Root className="project-detail-tabs" onValueChange={selectTab} value={activeTab}>
        <Tabs.List aria-label="项目详情视图" className="project-detail-tab-list" variant="accent">
          <Tabs.Tab
            className={`project-detail-tab${activeTab === 'overview' ? ' active' : ''}`}
            value="overview"
          >
            <JadeIcon name="layout-grid" size="1em" />
            项目概览
          </Tabs.Tab>
          <Tabs.Tab
            className={`project-detail-tab${activeTab === 'payments' ? ' active' : ''}`}
            value="payments"
          >
            <JadeIcon name="payment" size="1em" />
            收款记录
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="overview">
          {activeTab === 'overview' ? (
            <div className="project-detail-content">
              <Card.Root
                aria-label="项目结算概览"
                className="project-settlement-board"
                data-motion="entrance"
                gap="none"
                padding="none"
                variant="transparent"
              >
                <div className="project-settlement-board__main">
                  <div className="project-settlement-board__headline">
                    <span className="project-settlement-board__label">合同未收</span>
                    <strong className="project-settlement-board__amount">
                      {formatCurrency(remainingAmount)}
                    </strong>
                  </div>

                  <div className="project-settlement-progress">
                    <CircularProgress
                      aria-label="回款完成度"
                      className="project-overview-progress"
                      showValueLabel
                      size="lg"
                      tone={progress >= 100 ? 'success' : 'accent'}
                      value={progress}
                    />
                    <div>
                      <strong className="project-settlement-progress__label">回款完成度</strong>
                      <span>以合同回款计算</span>
                    </div>
                  </div>

                  <dl className="project-settlement-stats">
                    <div>
                      <dt>合同总额</dt>
                      <dd>{formatCurrency(project.total_amount)}</dd>
                    </div>
                    <div>
                      <dt>已收款</dt>
                      <dd className="project-settlement-stats__success">
                        {formatCurrency(paidAmount)}
                      </dd>
                    </div>
                    <div>
                      <dt>收款记录</dt>
                      <dd>{payments.length} 笔</dd>
                    </div>
                  </dl>
                </div>

                <div
                  className="project-runway"
                  style={{ '--project-runway-scale': runwayProgress / 100 } as CSSProperties}
                >
                  <div className="project-runway__header">
                    <strong>项目履约轨道</strong>
                    <span>{project.status === 'completed' ? '已完成' : '按合同周期推进'}</span>
                  </div>
                  <ol className="project-runway__track">
                    {runwayItems.map((item, index) => (
                      <li data-reached={index + 1 <= runwayStage} key={item.label}>
                        <span aria-hidden="true" className="project-runway__node">
                          {index + 1 <= runwayStage ? (
                            <JadeIcon name="check" size="1em" />
                          ) : (
                            index + 1
                          )}
                        </span>
                        <strong>{item.label}</strong>
                        <time dateTime={item.date}>{formatDate(item.date)}</time>
                      </li>
                    ))}
                  </ol>
                </div>
              </Card.Root>

              <div className="project-overview-grid" data-motion="entrance">
                <Card.Root className="project-record-card" padding="lg" variant="tertiary">
                  <Card.Header>
                    <Card.Title>项目档案</Card.Title>
                    <Card.Description>合同与交付的核心信息</Card.Description>
                  </Card.Header>
                  <Card.Content>
                    <dl className="project-record-list">
                      <div>
                        <dt>项目类型</dt>
                        <dd aria-busy={projectTypesLoading || undefined}>
                          {projectTypesLoading ? (
                            <span aria-label="正在加载项目类型" role="status">
                              <Skeleton height="1rem" width="6rem" />
                            </span>
                          ) : (
                            projectTypeLabel
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt>付款方式</dt>
                        <dd>{project.payment_method || '-'}</dd>
                      </div>
                      <div>
                        <dt>合同编号</dt>
                        <dd className="font-mono">{project.contract_number || '-'}</dd>
                      </div>
                      <div>
                        <dt>签约日期</dt>
                        <dd>{formatDate(project.contract_date)}</dd>
                      </div>
                      <div>
                        <dt>项目周期</dt>
                        <dd>
                          {formatDate(project.start_date)} - {formatDate(project.end_date)}
                        </dd>
                      </div>
                      <div>
                        <dt>建档日期</dt>
                        <dd>{formatDate(project.create_time)}</dd>
                      </div>
                      <div>
                        <dt>创建人</dt>
                        <dd>{project.user?.name || '-'}</dd>
                      </div>
                    </dl>
                  </Card.Content>
                </Card.Root>

                <div className="project-overview-aside">
                  <Card.Root className="project-next-payment-card" padding="lg" variant="tertiary">
                    <Card.Header>
                      <div className="project-card-heading-row">
                        <div>
                          <Card.Title>最近收款</Card.Title>
                        </div>
                        <Surface
                          className="project-card-heading-icon"
                          padding="none"
                          radius="control"
                          tone="accent"
                          variant="inset"
                        >
                          <JadeIcon name="payment" size="1em" />
                        </Surface>
                      </div>
                    </Card.Header>
                    <Card.Content>
                      {latestReceipt ? (
                        <div className="project-next-payment">
                          <div>
                            <span>{getPaymentStageLabel(latestReceipt.stage)}</span>
                            <strong>{formatCurrency(latestReceipt.amount)}</strong>
                          </div>
                          <time dateTime={toDateOnly(latestReceipt.actual_date) || undefined}>
                            {latestReceipt.actual_date
                              ? formatDate(toDateOnly(latestReceipt.actual_date))
                              : '日期未记录'}
                          </time>
                          <RouterButton
                            size="sm"
                            to={`/projects/${project.id}?tab=payments&payment=${latestReceipt.id}`}
                            variant="secondary"
                          >
                            查看收款记录
                            <JadeIcon name="arrow-right" size="1em" />
                          </RouterButton>
                        </div>
                      ) : (
                        <div className="project-next-payment project-next-payment--empty">
                          <Surface
                            as="span"
                            className="project-next-payment__badge"
                            padding="none"
                            radius="pill"
                            tone="accent"
                            variant="inset"
                          >
                            <JadeIcon detail="carved" name="payment" size={28} tone="jade" />
                          </Surface>
                          <strong>暂无实际收款</strong>
                          <RouterButton
                            size="sm"
                            to={`/projects/${project.id}/payment/create`}
                            variant="secondary"
                          >
                            录入收款
                          </RouterButton>
                        </div>
                      )}
                    </Card.Content>
                  </Card.Root>

                  <Card.Root className="project-notes-card" padding="lg" variant="tertiary">
                    <Card.Header>
                      <Card.Title>项目说明</Card.Title>
                    </Card.Header>
                    <Card.Content>
                      <p className="project-description">{project.description || '暂无项目描述'}</p>
                    </Card.Content>
                  </Card.Root>
                </div>
              </div>
            </div>
          ) : null}
        </Tabs.Panel>

        <Tabs.Panel value="payments">
          {activeTab === 'payments' ? (
            <div className="project-detail-content">
              <SectionHeader
                actions={
                  <RouterButton size="sm" to={`/projects/${project.id}/payment/create`}>
                    <JadeIcon name="add" size="1em" />
                    录入收款
                  </RouterButton>
                }
                className="payments-header-card"
                description={`共 ${payments.length} 笔记录`}
                headingLevel={3}
                title="收款记录"
              />

              {payments.length === 0 ? (
                <Card.Root>
                  <EmptyState
                    action={
                      <RouterButton size="sm" to={`/projects/${project.id}/payment/create`}>
                        录入收款
                      </RouterButton>
                    }
                    scene={<EmptyScene name="plans-empty" size="hero" />}
                    size="lg"
                    title="暂无收款记录"
                  />
                </Card.Root>
              ) : (
                <div className="payments-list">
                  {payments.map((payment, index) => (
                    <Card.Root
                      className="payment-item"
                      data-motion-item
                      data-payment-id={payment.id}
                      data-testid={`payment-${payment.id}`}
                      id={`payment-${payment.id}`}
                      key={payment.id}
                      orientation="horizontal"
                      tabIndex={-1}
                      tone={String(payment.id) === requestedPayment ? 'accent' : 'neutral'}
                    >
                      <span aria-hidden="true" className="payment-sequence">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <div className="payment-left">
                        <Surface
                          className="payment-icon"
                          padding="none"
                          radius="pill"
                          tone="accent"
                          variant="inset"
                        >
                          <JadeIcon name="payment" size="1em" />
                        </Surface>
                        <div>
                          <div className="payment-title-row">
                            <strong>{getPaymentStageLabel(payment.stage)}</strong>
                            <PaymentStatusChip status={payment.status} />
                          </div>
                          <div className="payment-meta-row">
                            <span className="payment-date">
                              {isPaymentSettled(payment) ? '实际到账' : '历史计划日期'}：
                              {isPaymentSettled(payment)
                                ? payment.actual_date
                                  ? formatDate(toDateOnly(payment.actual_date))
                                  : '日期未记录'
                                : formatDate(toDateOnly(payment.plan_date))}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>{getPaymentMethodLabel(payment.method)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="payment-right">
                        <div className="amount-text">{formatCurrency(payment.amount)}</div>
                        {!isPaymentSettled(payment) ? (
                          <RouterButton
                            aria-label={`${getPaymentStageLabel(payment.stage)}：登记到账`}
                            to={`/projects/edit/${project.id}`}
                            size="sm"
                            variant="tertiary"
                          >
                            <JadeIcon name="edit" size="1em" />
                            登记到账
                          </RouterButton>
                        ) : null}
                      </div>
                    </Card.Root>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </Tabs.Panel>
      </Tabs.Root>
    </div>
  )
}
