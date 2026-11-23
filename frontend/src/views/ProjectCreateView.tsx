import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { dictionaryApi } from '@/api/dictionary'
import { projectApi, type Payment, type ProjectRequest } from '@/api/project'
import { PaymentPlanEditor } from '@/components/project/PaymentPlanEditor'
import { ProjectFormSkeleton } from '@/components/project/ProjectFormSkeleton'
import { MoneyInput } from '@/components/project/MoneyInput'
import {
  validateProject,
  validatePaymentPlan,
  type PaymentPlanErrors,
} from '@/components/project/formValidation'
import {
  createPaymentPlanItem,
  isReceivedPayment,
  type PaymentPlanItem,
} from '@/components/project/paymentPlan'
import {
  createPaymentPlanSaveState,
  createLoadedPaymentPlanSaveState,
  getUnsavedPaymentItems,
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
  TextArea,
  type SelectOption,
} from '@/design-system'
import { useToastStore } from '@/composables/useToast'
import { formatCurrency } from '@/utils/format'
import { toDateOnly } from '@/utils/dateOnly'
import { sortPaymentsByReceiptDate, sortReceiptItems } from '@/utils/receiptOrder'
import { parseRouteId } from '@/utils/routeId'
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

const getOptionLabel = (options: SelectOption[], value: string | undefined) =>
  options.find((option) => option.value === value)?.label || value || '待填写'

const toPaymentPlanItem = (payment: Payment): PaymentPlanItem => ({
  ...createPaymentPlanItem(),
  amount: String(payment.amount),
  id: payment.id,
  method: payment.method || 'bank_transfer',
  planDate: toDateOnly(payment.plan_date),
  actualDate: toDateOnly(payment.actual_date),
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
  const [paymentItems, setPaymentItems] = useState<PaymentPlanItem[]>([])
  const [paymentErrors, setPaymentErrors] = useState<PaymentPlanErrors>({})
  const paymentSaveStateRef = useRef(createPaymentPlanSaveState())
  const savedProjectRef = useRef<{ id: number; signature: string } | null>(null)
  const currentFormRef = useRef(form)
  const currentPaymentItemsRef = useRef(paymentItems)
  const saveRequestRef = useRef<object | null>(null)
  const contractNumberGenerationRef = useRef(0)
  const automaticContractNumberRef = useRef<string | null>(null)
  const [saveIssue, setSaveIssue] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [loadedProjectId, setLoadedProjectId] = useState<number | null>(null)
  const [loadErrorProjectId, setLoadErrorProjectId] = useState<number | null>(null)
  const isMountedRef = useRef(false)
  const loadGenerationRef = useRef(0)
  const projectId = parseRouteId(id)
  const activeProjectIdRef = useRef<number | null>(projectId)
  const isEdit = projectId !== null
  const projectTypeOptions =
    form.type && !projectTypes.some((option) => option.value === form.type)
      ? [...projectTypes, { label: form.type, value: form.type }]
      : projectTypes
  const receivedAmount = paymentItems.reduce(
    (sum, item) => sum + (isReceivedPayment(item.status) ? Number(item.amount) || 0 : 0),
    0,
  )
  const requiredFields = [
    form.name.trim(),
    form.company.trim(),
    form.type,
    form.start_date,
    form.end_date,
    form.contract_date,
    form.total_amount > 0,
  ]
  const completion = Math.round(
    (requiredFields.filter(Boolean).length / requiredFields.length) * 100,
  )

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      loadGenerationRef.current += 1
      contractNumberGenerationRef.current += 1
    }
  }, [])

  useLayoutEffect(() => {
    activeProjectIdRef.current = projectId
    saveRequestRef.current = null
    savedProjectRef.current = null
    paymentSaveStateRef.current = createPaymentPlanSaveState()
    contractNumberGenerationRef.current += 1
    automaticContractNumberRef.current = null
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

  const updatePaymentItems = (items: PaymentPlanItem[]) => {
    setPaymentItems(sortReceiptItems(items))
    if (showValidation) {
      setPaymentErrors(
        validatePaymentPlan(
          getUnsavedPaymentItems(
            projectId || savedProjectRef.current?.id || 0,
            items,
            paymentSaveStateRef.current,
          ),
        ),
      )
    }
  }

  const updateContractDate = async (date: string) => {
    const contractNumber = currentFormRef.current.contract_number || ''
    const shouldGenerate =
      !isEdit &&
      !savedProjectRef.current &&
      !saveRequestRef.current &&
      (!contractNumber.trim() || contractNumber === automaticContractNumberRef.current)
    const generation = ++contractNumberGenerationRef.current
    updateForm({
      contract_date: date,
      ...(shouldGenerate ? { contract_number: '' } : {}),
    })
    if (!shouldGenerate) return
    automaticContractNumberRef.current = null
    if (!date) return

    const isCurrentRequest = () =>
      isMountedRef.current &&
      activeProjectIdRef.current === null &&
      contractNumberGenerationRef.current === generation
    try {
      const response = await projectApi.generateContractNumber(date)
      if (!isCurrentRequest()) return
      automaticContractNumberRef.current = response.data.data.contract_number
      updateForm({ contract_number: response.data.data.contract_number })
    } catch {
      if (isCurrentRequest()) toastError('合同编号生成失败')
    }
  }

  const updateContractNumber = (contractNumber: string) => {
    contractNumberGenerationRef.current += 1
    automaticContractNumberRef.current = null
    updateForm({ contract_number: contractNumber })
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
          contract_date: toDateOnly(project.contract_date),
          contract_number: project.contract_number || '',
          description: project.description || '',
          end_date: toDateOnly(project.end_date),
          name: project.name,
          payment_method: project.payment_method || '一次性付款',
          start_date: toDateOnly(project.start_date),
          status: project.status,
          total_amount: project.total_amount,
          type: project.type || '',
        })

        const loadedItems = sortPaymentsByReceiptDate(paymentsRes.data.data).map(toPaymentPlanItem)
        paymentSaveStateRef.current = createLoadedPaymentPlanSaveState(
          requestedProjectId,
          loadedItems,
        )
        setPaymentItems(loadedItems)
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
    const planErrors = validatePaymentPlan(
      getUnsavedPaymentItems(
        projectId || savedProjectRef.current?.id || 0,
        paymentItems,
        paymentSaveStateRef.current,
      ),
    )
    setPaymentErrors(planErrors)
    setValidationScope(id ?? 'new')
    if (Object.keys(errors).length || Object.keys(planErrors).length) {
      toastError('请检查并填写标红的必填项')
      requestAnimationFrame(() => {
        document.querySelector<HTMLElement>('.project-form [aria-invalid="true"]')?.focus()
      })
      return
    }

    const request = {}
    saveRequestRef.current = request
    const contractNumberGeneration = ++contractNumberGenerationRef.current
    const generation = loadGenerationRef.current
    const isCurrentSave = () =>
      isMountedRef.current &&
      loadGenerationRef.current === generation &&
      saveRequestRef.current === request
    let submittedForm = {
      ...form,
      start_date: toDateOnly(form.start_date),
      end_date: toDateOnly(form.end_date),
      contract_date: toDateOnly(form.contract_date),
    }
    const submittedItems = paymentItems.map((item) => ({ ...item }))
    const state = paymentSaveStateRef.current
    let signature = JSON.stringify(submittedForm)
    setSaving(true)
    setSaveIssue(null)
    try {
      let savedProjectId = savedProjectRef.current?.id ?? projectId
      if (savedProjectRef.current?.signature !== signature) {
        const response = savedProjectId
          ? await projectApi.update(savedProjectId, submittedForm)
          : await projectApi.create(submittedForm)
        if (!isCurrentSave()) return
        const acceptedNumber = response.data.data.contract_number
        if (!submittedForm.contract_number?.trim() && acceptedNumber) {
          submittedForm = { ...submittedForm, contract_number: acceptedNumber }
          signature = JSON.stringify(submittedForm)
          if (contractNumberGenerationRef.current === contractNumberGeneration) {
            const acceptedForm = { ...currentFormRef.current, contract_number: acceptedNumber }
            currentFormRef.current = acceptedForm
            setForm(acceptedForm)
          }
        }
        savedProjectId = savedProjectId ?? response.data.data.id
        savedProjectRef.current = { id: savedProjectId, signature }
      }
      if (!savedProjectId) throw new Error('项目保存结果无效，请检查已保存项目')
      const result = await savePaymentPlan(savedProjectId, submittedItems, state)
      if (!isCurrentSave()) return
      setPaymentItems((current) =>
        sortReceiptItems(
          current.map((item) => ({ ...item, id: result.ids.get(item.clientKey) ?? item.id })),
        ),
      )
      if (result.issue) {
        setSaveIssue(result.issue)
        toastError(result.summary)
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

  if (id !== undefined && projectId === null) {
    return (
      <Card.Root>
        <EmptyState
          action={<Button onClick={() => navigate('/projects')}>返回项目列表</Button>}
          icon={<JadeIcon name="warning" size="1em" />}
          role="alert"
          title="项目地址无效"
        />
      </Card.Root>
    )
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
                      onValueChange={(value) => void updateContractDate(value)}
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
                      onChange={(event) => updateContractNumber(event.currentTarget.value)}
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
                errors={showValidation ? paymentErrors : {}}
                items={paymentItems}
                onItemsChange={updatePaymentItems}
                title="收款记录"
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
                  <dt>收款记录</dt>
                  <dd>{paymentItems.length} 笔</dd>
                </div>
                <div>
                  <dt>已录收款</dt>
                  <dd>{formatCurrency(receivedAmount)}</dd>
                </div>
              </dl>
            </Card.Root>
          </aside>
        </div>
      )}
    </div>
  )
}
