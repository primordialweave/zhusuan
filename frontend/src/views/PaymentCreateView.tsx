import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { projectApi, type Project } from '@/api/project'
import { PaymentPlanEditor } from '@/components/project/PaymentPlanEditor'
import { validatePaymentPlan } from '@/components/project/formValidation'
import { ProjectPicker } from '@/components/project/ProjectPicker'
import { ProjectFormSkeleton } from '@/components/project/ProjectFormSkeleton'
import { createPaymentPlanItem, type PaymentPlanItem } from '@/components/project/paymentPlan'
import {
  createPaymentPlanSaveState,
  hasUnsavedPaymentPlan,
  savePaymentPlan,
} from '@/components/project/paymentPlanSave'
import {
  Alert,
  Button,
  Card,
  EmptyState,
  Field,
  FormActions,
  IconButton,
  JadeIcon,
  PageHeader,
  Skeleton,
} from '@/design-system'
import { useToastStore } from '@/composables/useToast'
import '@/styles/project-domain.css'

const normalizePaymentItems = (items: PaymentPlanItem[], installment: boolean) => {
  if (installment) {
    return items.map((item) => (item.stage === 'all' ? { ...item, stage: 'deposit' } : item))
  }
  const first = items[0] || createPaymentPlanItem()
  return [{ ...first, stage: 'all' }]
}

export default function PaymentCreateView() {
  const params = useParams()
  const navigate = useNavigate()
  const toastError = useToastStore((state) => state.error)
  const toastSuccess = useToastStore((state) => state.success)
  const routeProjectId = Number(params.id) || 0
  const [selectedProject, setSelectedProject] = useState<Project | undefined>()
  const selectedProjectId = selectedProject?.id || routeProjectId
  const [paymentItems, setPaymentItems] = useState<PaymentPlanItem[]>([createPaymentPlanItem()])
  const [saving, setSaving] = useState(false)
  const [loadingProject, setLoadingProject] = useState(true)
  const [projectLoadFailed, setProjectLoadFailed] = useState(false)
  const [saveIssue, setSaveIssue] = useState<string | null>(null)
  const [showValidation, setShowValidation] = useState(false)
  const paymentErrors = showValidation ? validatePaymentPlan(paymentItems) : {}
  const [lockedProjectId, setLockedProjectId] = useState<number | null>(null)
  const paymentSaveStateRef = useRef(createPaymentPlanSaveState())
  const currentPaymentItemsRef = useRef(paymentItems)
  const saveRequestRef = useRef<object | null>(null)
  const mountedRef = useRef(false)
  const loadGenerationRef = useRef(0)
  const activeRouteRef = useRef(routeProjectId)

  useLayoutEffect(() => {
    activeRouteRef.current = routeProjectId
    saveRequestRef.current = null
    paymentSaveStateRef.current = createPaymentPlanSaveState()
  }, [routeProjectId])
  useLayoutEffect(() => {
    currentPaymentItemsRef.current = paymentItems
  }, [paymentItems])
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      loadGenerationRef.current += 1
    }
  }, [])

  const currentProject =
    routeProjectId && routeProjectId !== selectedProject?.id ? undefined : selectedProject
  const isInstallment = currentProject?.payment_method === '分期付款'

  const loadProjects = useCallback(async () => {
    const generation = ++loadGenerationRef.current
    setSaving(false)
    setLoadingProject(true)
    setProjectLoadFailed(false)
    setLockedProjectId(null)
    setSaveIssue(null)
    try {
      const list = routeProjectId
        ? [(await projectApi.get(routeProjectId)).data.data]
        : (await projectApi.list({ page: 1, page_size: 20 })).data.data.list
      if (
        !mountedRef.current ||
        generation !== loadGenerationRef.current ||
        activeRouteRef.current !== routeProjectId
      )
        return
      const nextProjectId = routeProjectId || list[0]?.id || 0
      const nextProject = list.find((project) => project.id === nextProjectId)
      setSelectedProject(nextProject)
      setPaymentItems((current) =>
        normalizePaymentItems(current, nextProject?.payment_method === '分期付款'),
      )
    } catch {
      if (
        !mountedRef.current ||
        generation !== loadGenerationRef.current ||
        activeRouteRef.current !== routeProjectId
      )
        return
      setProjectLoadFailed(true)
      toastError('获取项目列表失败')
    } finally {
      if (
        mountedRef.current &&
        generation === loadGenerationRef.current &&
        activeRouteRef.current === routeProjectId
      )
        setLoadingProject(false)
    }
  }, [routeProjectId, toastError])

  useEffect(() => {
    const timer = window.setTimeout(loadProjects, 0)
    return () => {
      window.clearTimeout(timer)
      loadGenerationRef.current += 1
    }
  }, [loadProjects])

  const selectProject = (nextProject: Project) => {
    if (saveRequestRef.current || paymentSaveStateRef.current.knownIds.size > 0) return
    paymentSaveStateRef.current = createPaymentPlanSaveState()
    setSaveIssue(null)
    setSelectedProject(nextProject)
    setPaymentItems((current) =>
      normalizePaymentItems(current, nextProject?.payment_method === '分期付款'),
    )
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (saving || saveRequestRef.current || loadingProject || !currentProject) return
    if (!selectedProjectId) {
      toastError('请选择项目')
      return
    }
    setShowValidation(true)
    if (paymentItems.length === 0 || Object.keys(validatePaymentPlan(paymentItems)).length) {
      toastError('请检查并填写标红的必填项')
      requestAnimationFrame(() => {
        document.querySelector<HTMLElement>('.payment-create-view [aria-invalid="true"]')?.focus()
      })
      return
    }

    const request = {}
    saveRequestRef.current = request
    const state = paymentSaveStateRef.current
    const submittedItems = paymentItems.map((item) => ({ ...item }))
    setSaving(true)
    setSaveIssue(null)
    const generation = loadGenerationRef.current
    const isCurrentSave = () =>
      mountedRef.current &&
      generation === loadGenerationRef.current &&
      saveRequestRef.current === request
    try {
      const result = await savePaymentPlan(selectedProjectId, submittedItems, state)
      if (!isCurrentSave()) return
      setPaymentItems((current) =>
        current.map((item) => ({ ...item, id: result.ids.get(item.clientKey) ?? item.id })),
      )
      if (state.knownIds.size > 0) setLockedProjectId(selectedProjectId)
      if (result.issue) {
        setSaveIssue(result.issue)
        toastError('部分收款操作未完成')
        return
      }
      if (hasUnsavedPaymentPlan(selectedProjectId, currentPaymentItemsRef.current, state)) {
        setSaveIssue('已保存提交的内容，期间的新修改尚未保存，请再次保存。')
        return
      }
      toastSuccess('收款计划已创建')
      navigate(`/projects/${selectedProjectId}`)
    } catch (error) {
      if (!isCurrentSave()) return
      toastError(error instanceof Error ? error.message : '创建收款失败')
    } finally {
      if (isCurrentSave()) {
        saveRequestRef.current = null
        setSaving(false)
      }
    }
  }

  return (
    <div className="payment-create-view project-form-page">
      <PageHeader
        actions={
          routeProjectId ? null : (
            <Field.Root className="payment-project-selector" required>
              <Field.Label>所属项目</Field.Label>
              {loadingProject ? (
                <Skeleton height="var(--ods-control-height-md)" width="16rem" />
              ) : (
                <ProjectPicker
                  disabled={saving || loadingProject || lockedProjectId !== null}
                  onValueChange={selectProject}
                  value={currentProject}
                />
              )}
            </Field.Root>
          )
        }
        // The selector already names the chosen project; only a fixed project needs saying.
        description={routeProjectId ? currentProject?.name : undefined}
        leading={
          <IconButton label="返回上一页" onClick={() => navigate(-1)} variant="ghost">
            <JadeIcon motionPreset="interactive" name="arrow-left" size="1em" />
          </IconButton>
        }
        title="创建收款计划"
      />

      {projectLoadFailed ? (
        <EmptyState
          action={<Button onClick={() => void loadProjects()}>重试</Button>}
          icon={<JadeIcon name="warning" size="1em" />}
          role="alert"
          title="所属项目加载失败"
        />
      ) : null}
      {saveIssue ? (
        <Alert title="收款操作尚未完成" tone="warning" role="alert">
          {saveIssue}
        </Alert>
      ) : null}

      {loadingProject ? (
        <ProjectFormSkeleton payment />
      ) : (
        <Card.Root className="project-form-card" padding="none" variant="transparent">
          <form className="payment-form" noValidate onSubmit={handleSubmit}>
            <PaymentPlanEditor
              installment={isInstallment}
              errors={paymentErrors}
              items={paymentItems}
              onItemsChange={setPaymentItems}
            />

            <FormActions>
              <Button onClick={() => navigate(-1)} type="button" variant="ghost">
                取消
              </Button>
              <Button disabled={loadingProject || !currentProject} pending={saving} type="submit">
                {saving ? '保存中...' : '确认保存'}
              </Button>
            </FormActions>
          </form>
        </Card.Root>
      )}
    </div>
  )
}
