import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { dictionaryApi } from '@/api/dictionary'
import { projectApi, type Payment, type ProjectRequest } from '@/api/project'
import { PaymentPlanEditor } from '@/components/project/PaymentPlanEditor'
import { ProjectFormSkeleton } from '@/components/project/ProjectFormSkeleton'
import { MoneyInput } from '@/components/project/MoneyInput'
import { validateProject, validatePaymentPlan } from '@/components/project/formValidation'
import { createPaymentPlanItem, type PaymentPlanItem } from '@/components/project/paymentPlan'
import {
  createPaymentPlanSaveState,
  hasUnsavedPaymentPlan,
  savePaymentPlan,
} from '@/components/project/paymentPlanSave'
import { ProjectStatusChip } from '@/components/project/ProjectStatusChip'
import {
  Button,
  Alert,
  Card,
  DatePicker,
  EmptyState,
  Field,
  FormActions,
  FormGrid,
  FormSection,
  IconButton,
  Input,
  JadeIcon,
  PageHeader,
  ProgressBar,
  Select,
  Skeleton,
  Surface,
  TextArea,
  type SelectOption,
} from '@/design-system'
import { useToastStore } from '@/composables/useToast'
import { formatCurrency } from '@/utils/format'
import '@/styles/project-domain.css'

const emptyForm: ProjectRequest = {
  company: '',
  contract_date: '',
  contract_number: '',
  description: '',
  end_date: '',
  name: '',
  payment_method: '一次性付款',
  start_date: '',
  status: 'active',
  total_amount: 0,
  type: '',
}

const defaultProjectTypeOptions: SelectOption[] = [
  { label: '软件开发', value: 'software' },
  { label: '技术咨询', value: 'consulting' },
  { label: '运营服务', value: 'service' },
  { label: '其他', value: 'other' },
]

const projectStatusOptions: SelectOption[] = [
  { label: '进行中', value: 'active' },
  { label: '已完成', value: 'completed' },
  { label: '即将交付', value: 'pending' },
  { label: '未开始', value: 'notstarted' },
  { label: '已归档', value: 'archived' },
]

const paymentMethodOptions: SelectOption[] = [
  { label: '一次性付款', value: '一次性付款' },
  { label: '分期付款', value: '分期付款' },
]

const installmentStageOptions: SelectOption[] = [
  { label: '预付款', value: 'deposit' },
  { label: '阶段款', value: 'milestone' },
  { label: '尾款', value: 'final' },
]

const oneTimeStageOptions: SelectOption[] = [
  { label: '全款', value: 'all' },
  ...installmentStageOptions,
]

const getOptionLabel = (options: SelectOption[], value: string | undefined) =>
  options.find((option) => option.value === value)?.label || value || '待填写'

const toPaymentPlanItem = (payment: Payment): PaymentPlanItem => ({
  ...createPaymentPlanItem(payment.stage !== 'all'),
  amount: String(payment.amount),
  id: payment.id,
  method: payment.method || 'bank_transfer',
  planDate: payment.plan_date || '',
  remark: payment.remark || '',
  stage: payment.stage || 'all',
  status: payment.status || 'pending',
})

export default function ProjectCreateView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toastError = useToastStore((state) => state.error)
  const toastSuccess = useToastStore((state) => state.success)
  const [form, setForm] = useState<ProjectRequest>(emptyForm)
  const [amountText, setAmountText] = useState('')
  const [validationScope, setValidationScope] = useState<string | null>(null)
  const showValidation = validationScope === (id ?? 'new')
  const fieldErrors = showValidation ? validateProject(form, amountText) : {}
  const [projectTypes, setProjectTypes] = useState<SelectOption[]>(defaultProjectTypeOptions)
  const [loadingProjectTypes, setLoadingProjectTypes] = useState(true)
  const [paymentItems, setPaymentItems] = useState<PaymentPlanItem[]>([createPaymentPlanItem()])
  const paymentSaveStateRef = useRef(createPaymentPlanSaveState())
  const savedProjectRef = useRef<{ id: number; signature: string } | null>(null)
  const currentFormRef = useRef(form)
  const currentPaymentItemsRef = useRef(paymentItems)
  const saveRequestRef = useRef<object | null>(null)
  const [saveIssue, setSaveIssue] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [loadedProjectId, setLoadedProjectId] = useState<number | null>(null)
  const [loadErrorProjectId, setLoadErrorProjectId] = useState<number | null>(null)
  const isMountedRef = useRef(false)
  const loadGenerationRef = useRef(0)
  const projectId = id ? Number(id) : null
  const activeProjectIdRef = useRef<number | null>(projectId)
  const isEdit = projectId !== null
  const isInstallment =
    form.payment_method === '分期付款' ||
    (!form.payment_method && paymentItems.some((item) => item.stage !== 'all'))
  const projectTypeOptions =
    form.type && !projectTypes.some((option) => option.value === form.type)
      ? [...projectTypes, { label: form.type, value: form.type }]
      : projectTypes
  const paymentErrors = showValidation ? validatePaymentPlan(paymentItems) : {}
  const plannedAmount = paymentItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)
  const requiredFields = [
    form.name.trim(),
    form.company.trim(),
    form.type,
    form.start_date,
    form.end_date,
    form.contract_date,
    form.total_amount > 0,
    paymentItems.every((item) => Boolean(item.amount && item.planDate)),
  ]
  const completion = Math.round(
    (requiredFields.filter(Boolean).length / requiredFields.length) * 100,
  )
  const planDifference = form.total_amount - plannedAmount
  const planAligned = form.total_amount > 0 && Math.abs(planDifference) < 0.01
  const planState = !form.total_amount ? 'neutral' : planAligned ? 'success' : 'warning'

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      loadGenerationRef.current += 1
    }
  }, [])

  useLayoutEffect(() => {
    activeProjectIdRef.current = projectId
    saveRequestRef.current = null
    savedProjectRef.current = null
    paymentSaveStateRef.current = createPaymentPlanSaveState()
  }, [projectId])

  useLayoutEffect(() => {
    currentFormRef.current = form
    currentPaymentItemsRef.current = paymentItems
  }, [form, paymentItems])

  useEffect(() => {
    let active = true
    void dictionaryApi
      .getItems('project_type')
      .then((response) => {
        if (active) {
          setProjectTypes(response.data.data.map(({ label, value }) => ({ label, value })))
        }
      })
      .catch(() => {
        if (active) toastError('获取项目类型失败，暂时显示默认选项')
      })
      .finally(() => {
        if (active) setLoadingProjectTypes(false)
      })
    return () => {
      active = false
    }
  }, [toastError])

  const updateForm = (patch: Partial<ProjectRequest>) =>
    setForm((current) => ({ ...current, ...patch }))

  const ensurePaymentItems = (paymentMethod: string) => {
    setPaymentItems((current) => {
      if (paymentMethod === '一次性付款') {
        const first = current[0] || createPaymentPlanItem()
        return [{ ...first, stage: 'all' }]
      }
      return current.length
        ? current.map((item) => (item.stage === 'all' ? { ...item, stage: 'deposit' } : item))
        : [createPaymentPlanItem(true)]
    })
  }

  const loadProject = useCallback(
    async (requestedProjectId: number) => {
      if (!isMountedRef.current || activeProjectIdRef.current !== requestedProjectId) return

      const loadGeneration = ++loadGenerationRef.current
      setSaveIssue(null)
      setLoadedProjectId(null)
      setLoadErrorProjectId(null)
      setSaving(true)
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
        const project = projectRes.data.data
        setAmountText(project.total_amount.toFixed(2))
        setForm({
          company: project.company,
          contract_date: project.contract_date || '',
          contract_number: project.contract_number || '',
          description: project.description || '',
          end_date: project.end_date || '',
          name: project.name,
          payment_method: project.payment_method || '一次性付款',
          start_date: project.start_date || '',
          status: project.status,
          total_amount: project.total_amount,
          type: project.type || '',
        })

        paymentSaveStateRef.current = createPaymentPlanSaveState(
          paymentsRes.data.data.map((payment) => payment.id),
        )
        setPaymentItems(
          paymentsRes.data.data.length
            ? paymentsRes.data.data.map(toPaymentPlanItem)
            : [createPaymentPlanItem()],
        )
        setLoadedProjectId(requestedProjectId)
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
          setSaving(false)
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

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (saving || saveRequestRef.current || (isEdit && loadedProjectId !== projectId)) return
    const errors = validateProject(form, amountText)
    const planErrors = validatePaymentPlan(paymentItems)
    setValidationScope(id ?? 'new')
    if (Object.keys(errors).length || Object.keys(planErrors).length || !paymentItems.length) {
      toastError('请检查并填写标红的必填项')
      requestAnimationFrame(() => {
        document.querySelector<HTMLElement>('.project-form [aria-invalid="true"]')?.focus()
      })
      return
    }

    const request = {}
    saveRequestRef.current = request
    const generation = loadGenerationRef.current
    const isCurrentSave = () =>
      isMountedRef.current &&
      loadGenerationRef.current === generation &&
      saveRequestRef.current === request
    const submittedForm = { ...form }
    const submittedItems = paymentItems.map((item) => ({ ...item }))
    const state = paymentSaveStateRef.current
    const signature = JSON.stringify(submittedForm)
    setSaving(true)
    setSaveIssue(null)
    try {
      let savedProjectId = savedProjectRef.current?.id ?? projectId
      if (savedProjectRef.current?.signature !== signature) {
        const response = savedProjectId
          ? await projectApi.update(savedProjectId, submittedForm)
          : await projectApi.create(submittedForm)
        if (!isCurrentSave()) return
        savedProjectId = savedProjectId ?? response.data.data.id
        savedProjectRef.current = { id: savedProjectId, signature }
      }
      if (!savedProjectId) throw new Error('项目保存结果无效，请检查已保存项目')
      const result = await savePaymentPlan(savedProjectId, submittedItems, state)
      if (!isCurrentSave()) return
      setPaymentItems((current) =>
        current.map((item) => ({ ...item, id: result.ids.get(item.clientKey) ?? item.id })),
      )
      if (result.issue) {
        setSaveIssue(result.issue)
        toastError('部分收款操作未完成')
        return
      }
      if (
        JSON.stringify(currentFormRef.current) !== signature ||
        hasUnsavedPaymentPlan(savedProjectId, currentPaymentItemsRef.current, state)
      ) {
        setSaveIssue('已保存提交的内容，期间的新修改尚未保存，请再次保存。')
        return
      }
      toastSuccess(isEdit ? '项目与收款已更新' : '项目已创建')
      navigate('/projects')
    } catch (error) {
      if (!isCurrentSave()) return
      toastError(error instanceof Error ? error.message : '保存项目失败')
    } finally {
      if (isCurrentSave()) {
        saveRequestRef.current = null
        setSaving(false)
      }
    }
  }

  return (
    <div className="project-create-view project-form-page" data-motion-scope="project-create">
      <PageHeader
        leading={
          <IconButton label="返回上一页" onClick={() => navigate(-1)} variant="ghost">
            <JadeIcon motionPreset="interactive" name="arrow-left" size="1em" />
          </IconButton>
        }
        title={isEdit ? '编辑项目' : '创建项目'}
      />

      {isEdit && loadErrorProjectId === projectId ? (
        <EmptyState
          action={<Button onClick={() => void loadProject(projectId)}>重试</Button>}
          icon={<JadeIcon name="warning" size="1em" />}
          role="alert"
          title="项目详情加载失败"
        />
      ) : null}

      {saveIssue ? (
        <Alert title="收款操作尚未完成" tone="warning" role="alert">
          {saveIssue}
        </Alert>
      ) : null}

      {isEdit && loadedProjectId !== projectId ? (
        loadErrorProjectId !== projectId ? (
          <ProjectFormSkeleton />
        ) : null
      ) : (
        <div className="project-compose-layout">
          <Card.Root className="project-form-card" padding="none" variant="transparent">
            <form
              aria-label="项目编辑表单"
              className="project-form"
              noValidate
              onSubmit={handleSubmit}
            >
              <FormSection className="project-form-section" title="基本信息">
                <FormGrid columns={2}>
                  <Field.Root required invalid={Boolean(fieldErrors.name)}>
                    <Field.Label>项目名称</Field.Label>
                    <Input
                      autoCapitalize="off"
                      autoComplete="off"
                      autoCorrect="off"
                      onChange={(event) => updateForm({ name: event.currentTarget.value })}
                      placeholder="请输入项目名称"
                      spellCheck={false}
                      type="text"
                      value={form.name}
                    />
                    {fieldErrors.name ? <Field.Error>{fieldErrors.name}</Field.Error> : null}
                  </Field.Root>

                  <Field.Root required invalid={Boolean(fieldErrors.company)}>
                    <Field.Label>客户名称</Field.Label>
                    <Input
                      autoCapitalize="off"
                      autoComplete="off"
                      autoCorrect="off"
                      onChange={(event) => updateForm({ company: event.currentTarget.value })}
                      placeholder="请输入客户名称"
                      spellCheck={false}
                      type="text"
                      value={form.company}
                    />
                    {fieldErrors.company ? <Field.Error>{fieldErrors.company}</Field.Error> : null}
                  </Field.Root>

                  <Field.Root required invalid={Boolean(fieldErrors.type)}>
                    <Field.Label>项目类型</Field.Label>
                    {loadingProjectTypes && !form.type ? (
                      <div aria-label="正在加载项目类型" role="status">
                        <Skeleton height="var(--ods-control-height-md)" />
                      </div>
                    ) : (
                      <Select
                        aria-label="项目类型"
                        onValueChange={(value) => updateForm({ type: value })}
                        options={projectTypeOptions}
                        placeholder="请选择项目类型"
                        value={form.type}
                      />
                    )}
                    {fieldErrors.type ? <Field.Error>{fieldErrors.type}</Field.Error> : null}
                  </Field.Root>

                  <Field.Root required invalid={Boolean(fieldErrors.status)}>
                    <Field.Label>项目状态</Field.Label>
                    <Select
                      aria-label="项目状态"
                      onValueChange={(value) => updateForm({ status: value })}
                      options={projectStatusOptions}
                      value={form.status}
                    />
                    {fieldErrors.status ? <Field.Error>{fieldErrors.status}</Field.Error> : null}
                  </Field.Root>

                  <Field.Root required invalid={Boolean(fieldErrors.start_date)}>
                    <Field.Label>开始日期</Field.Label>
                    <DatePicker
                      aria-label="开始日期"
                      onValueChange={(value) => updateForm({ start_date: value })}
                      placeholder="请选择开始日期"
                      value={form.start_date}
                    />
                    {fieldErrors.start_date ? (
                      <Field.Error>{fieldErrors.start_date}</Field.Error>
                    ) : null}
                  </Field.Root>

                  <Field.Root required invalid={Boolean(fieldErrors.end_date)}>
                    <Field.Label>截止日期</Field.Label>
                    <DatePicker
                      aria-label="截止日期"
                      min={form.start_date || undefined}
                      onValueChange={(value) => updateForm({ end_date: value })}
                      placeholder="请选择截止日期"
                      value={form.end_date}
                    />
                    {fieldErrors.end_date ? (
                      <Field.Error>{fieldErrors.end_date}</Field.Error>
                    ) : null}
                  </Field.Root>
                </FormGrid>
              </FormSection>

              <FormSection className="project-form-section" title="合同信息">
                <FormGrid columns={2}>
                  <Field.Root required invalid={Boolean(fieldErrors.total_amount)}>
                    <Field.Label>合同总金额 (¥)</Field.Label>
                    <MoneyInput
                      onValueChange={(value) => {
                        setAmountText(value)
                        updateForm({ total_amount: Number(value) || 0 })
                      }}
                      placeholder="0.00"
                      value={amountText}
                    />
                    {fieldErrors.total_amount ? (
                      <Field.Error>{fieldErrors.total_amount}</Field.Error>
                    ) : null}
                  </Field.Root>

                  <Field.Root required invalid={Boolean(fieldErrors.contract_date)}>
                    <Field.Label>合同日期</Field.Label>
                    <DatePicker
                      aria-label="合同日期"
                      onValueChange={(value) => updateForm({ contract_date: value })}
                      placeholder="请选择合同日期"
                      value={form.contract_date || ''}
                    />
                    {fieldErrors.contract_date ? (
                      <Field.Error>{fieldErrors.contract_date}</Field.Error>
                    ) : null}
                  </Field.Root>

                  <Field.Root>
                    <Field.Label>合同编号</Field.Label>
                    <Input
                      autoCapitalize="off"
                      autoComplete="off"
                      autoCorrect="off"
                      onChange={(event) =>
                        updateForm({ contract_number: event.currentTarget.value })
                      }
                      placeholder="选择合同日期后自动生成"
                      spellCheck={false}
                      type="text"
                      value={form.contract_number || ''}
                    />
                  </Field.Root>

                  <Field.Root required invalid={Boolean(fieldErrors.payment_method)}>
                    <Field.Label>付款模式</Field.Label>
                    <Select
                      aria-label="付款模式"
                      onValueChange={(value) => {
                        updateForm({ payment_method: value })
                        if (value) ensurePaymentItems(value)
                      }}
                      options={paymentMethodOptions}
                      value={form.payment_method}
                    />
                    {fieldErrors.payment_method ? (
                      <Field.Error>{fieldErrors.payment_method}</Field.Error>
                    ) : null}
                  </Field.Root>
                </FormGrid>
              </FormSection>

              <PaymentPlanEditor
                className="project-form-section"
                installment={isInstallment}
                errors={paymentErrors}
                items={paymentItems}
                onItemsChange={setPaymentItems}
                stageOptions={isInstallment ? installmentStageOptions : oneTimeStageOptions}
                title="收款计划"
              />

              <FormSection className="project-form-section" title="补充说明">
                <Field.Root>
                  <Field.Label>项目描述</Field.Label>
                  <TextArea
                    onChange={(event) => updateForm({ description: event.currentTarget.value })}
                    placeholder="请输入项目描述（选填）"
                    rows={4}
                    value={form.description || ''}
                  />
                </Field.Root>
              </FormSection>

              <div className="project-form-actions-shell">
                <FormActions>
                  <Button onClick={() => navigate(-1)} type="button" variant="ghost">
                    取消
                  </Button>
                  <Button
                    disabled={isEdit && loadedProjectId !== projectId}
                    pending={saving}
                    type="submit"
                  >
                    {saving ? '保存中...' : '确认保存'}
                  </Button>
                </FormActions>
              </div>
            </form>
          </Card.Root>

          <aside aria-label="项目草稿摘要" className="project-form-aside">
            <Card.Root className="project-draft-card" padding="none" variant="transparent">
              <div className="project-draft-card__heading">
                <h2>{form.name.trim() || '未命名项目'}</h2>
                <p>{form.company.trim() || '客户待填写'}</p>
              </div>

              <div className="project-draft-progress">
                <div>
                  <span>档案完整度</span>
                  <strong>{completion}%</strong>
                </div>
                <ProgressBar
                  label="项目档案完整度"
                  motion="reveal"
                  size="sm"
                  value={completion}
                  valueLabel={`${completion}%`}
                />
              </div>

              <dl className="project-draft-meta">
                <div>
                  <dt>项目状态</dt>
                  <dd>
                    <ProjectStatusChip status={form.status || 'active'} />
                  </dd>
                </div>
                <div>
                  <dt>项目类型</dt>
                  <dd>{getOptionLabel(projectTypeOptions, form.type)}</dd>
                </div>
                <div>
                  <dt>合同总额</dt>
                  <dd>{formatCurrency(form.total_amount)}</dd>
                </div>
                <div>
                  <dt>付款模式</dt>
                  <dd>{form.payment_method || '待填写'}</dd>
                </div>
                <div>
                  <dt>收款节点</dt>
                  <dd>{paymentItems.length} 笔</dd>
                </div>
              </dl>

              <div className="project-plan-check" data-state={planState}>
                <Surface padding="none" radius="control" tone="accent" variant="inset">
                  <JadeIcon name={planAligned ? 'check' : 'scales'} size="1em" />
                </Surface>
                <div className="project-plan-check__content">
                  <span>计划金额</span>
                  <strong>{formatCurrency(plannedAmount)}</strong>
                  <small>
                    {!form.total_amount
                      ? '填写合同金额后自动核对'
                      : planAligned
                        ? '与合同金额一致'
                        : planDifference > 0
                          ? `还有 ${formatCurrency(planDifference)} 待分配`
                          : `已超出 ${formatCurrency(Math.abs(planDifference))}`}
                  </small>
                </div>
              </div>
            </Card.Root>

            <p className="project-form-aside__note">
              <JadeIcon name="shield-check" size={16} tone="success" />
              保存后将同步生成项目台账与收款跟踪记录
            </p>
          </aside>
        </div>
      )}
    </div>
  )
}
