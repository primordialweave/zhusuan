import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { projectApi, type Project } from '@/api/project'
import { ProjectStatusChip } from '@/components/project/ProjectStatusChip'
import {
  Alert,
  AlertDialog,
  Button,
  Dropdown,
  EmptyScene,
  EmptyState,
  IconButton,
  JadeIcon,
  MultiSelect,
  PaginationBar,
  PageHeader,
  ProgressBar,
  RouterButton,
  RouterLink,
  SearchField,
  Select,
  Skeleton,
  Table,
} from '@/design-system'
import { useToastStore } from '@/composables/useToast'
import { usePrivacyMode } from '@/stores/desktop'
import { formatAmount, formatDate, maskAmount } from '@/utils/format'
import { useProjectExport } from '@/components/project/useProjectExport'
import '@/styles/project-domain.css'
import '@/styles/main-page-loading.css'

const statusOptions = [
  { label: '进行中', value: 'active' },
  { label: '已完成', value: 'completed' },
  { label: '未开始', value: 'notstarted' },
  { label: '已逾期', value: 'overdue' },
  { label: '已归档', value: 'archived' },
]

const pageSizeOptions = [
  { label: '5 条 / 页', value: '5' },
  { label: '10 条 / 页', value: '10' },
  { label: '20 条 / 页', value: '20' },
]

/** Real collection percentage; null when the contract amount gives no denominator. */
const getProgress = (project: Project) => {
  if (!project.total_amount) return null
  return Math.round(((project.received_amount || 0) / project.total_amount) * 100)
}

interface ConfirmationState {
  action: 'archive' | 'delete'
  projectId: number
}

export default function ProjectsView() {
  const navigate = useNavigate()
  const privacyMode = usePrivacyMode()
  const showAmount = (value: number) => maskAmount(formatAmount(value), privacyMode)
  const toastError = useToastStore((state) => state.error)
  const toastSuccess = useToastStore((state) => state.success)

  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [loadedQueryScope, setLoadedQueryScope] = useState<string | null>(null)
  const [failedQueryScope, setFailedQueryScope] = useState<string | null>(null)
  const [totalItems, setTotalItems] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [keyword, setKeyword] = useState('')
  const [searchKeyword, setSearchKeyword] = useState('')
  const [activeFilters, setActiveFilters] = useState<string[]>([])
  const [activeDropdownId, setActiveDropdownId] = useState<number | null>(null)
  const [confirmation, setConfirmation] = useState<ConfirmationState | null>(null)
  const [confirming, setConfirming] = useState(false)
  const { exportProject } = useProjectExport()
  const mountedRef = useRef(false)
  const requestIdRef = useRef(0)

  const statusFilter = activeFilters.join(',')
  const queryScope = JSON.stringify([currentPage, pageSize, statusFilter, searchKeyword])
  const dataIsCurrent = hasLoaded && loadedQueryScope === queryScope
  const loadError = failedQueryScope === queryScope
  const showingSkeleton = !dataIsCurrent && !loadError
  const busy = loading || showingSkeleton
  const totalPages = Math.ceil(totalItems / pageSize)
  const colSpan = 8

  const paginationInfo = useMemo(() => {
    if (!dataIsCurrent) return loadError ? '数据暂不可用' : '正在加载'
    if (totalItems === 0) return '暂无数据'
    const start = (currentPage - 1) * pageSize + 1
    const end = Math.min(currentPage * pageSize, totalItems)
    return `显示 ${start}-${end} 条，共 ${totalItems} 条`
  }, [currentPage, dataIsCurrent, loadError, pageSize, totalItems])

  const fetchProjects = useCallback(async () => {
    if (!mountedRef.current) return
    const requestId = ++requestIdRef.current
    setLoading(true)
    setFailedQueryScope(null)
    try {
      const response = await projectApi.list({
        keyword: searchKeyword || undefined,
        page: currentPage,
        page_size: pageSize,
        status: statusFilter || undefined,
      })
      if (!mountedRef.current || requestId !== requestIdRef.current) return
      setProjects(response.data.data.list)
      setTotalItems(response.data.data.total)
      setHasLoaded(true)
      setLoadedQueryScope(queryScope)
    } catch {
      if (!mountedRef.current || requestId !== requestIdRef.current) return
      setFailedQueryScope(queryScope)
      toastError('获取项目列表失败')
    } finally {
      if (mountedRef.current && requestId === requestIdRef.current) setLoading(false)
    }
  }, [currentPage, pageSize, queryScope, searchKeyword, statusFilter, toastError])

  useEffect(() => {
    mountedRef.current = true
    const timer = window.setTimeout(fetchProjects, 0)
    return () => {
      mountedRef.current = false
      requestIdRef.current += 1
      window.clearTimeout(timer)
    }
  }, [fetchProjects])

  const handleSearch = () => {
    setCurrentPage(1)
    setSearchKeyword(keyword)
  }

  const handleFilterChange = (filters: string[]) => {
    setActiveFilters(
      statusOptions.map((option) => option.value).filter((value) => filters.includes(value)),
    )
    setCurrentPage(1)
  }

  const performConfirmedAction = async () => {
    if (!confirmation) return
    const pendingConfirmation = confirmation
    setConfirming(true)
    try {
      if (pendingConfirmation.action === 'delete') {
        await projectApi.delete(pendingConfirmation.projectId)
        if (!mountedRef.current) return
        toastSuccess('项目删除成功')
      } else {
        await projectApi.archive(pendingConfirmation.projectId)
        if (!mountedRef.current) return
        toastSuccess('项目归档成功')
      }
      setConfirmation(null)
      if (projects.length === 1 && currentPage > 1) {
        setCurrentPage((page) => page - 1)
      } else {
        await fetchProjects()
      }
    } catch {
      if (!mountedRef.current) return
      toastError(pendingConfirmation.action === 'delete' ? '删除失败' : '归档失败')
    } finally {
      if (mountedRef.current) setConfirming(false)
    }
  }

  const clearSearch = () => {
    setKeyword('')
    setSearchKeyword('')
    setCurrentPage(1)
  }

  const isFiltered = searchKeyword !== '' || activeFilters.length > 0

  const clearFilters = () => {
    setActiveFilters([])
    clearSearch()
  }

  return (
    <div className="projects-view" data-motion-scope="projects">
      <PageHeader
        actions={
          <>
            <SearchField
              aria-label="搜索项目"
              className="project-search"
              onClear={clearSearch}
              onKeyDown={(event) => {
                if (event.key === 'Enter') handleSearch()
              }}
              onValueChange={setKeyword}
              pending={busy}
              placeholder="搜索项目"
              value={keyword}
            />
            <MultiSelect
              aria-label="项目状态筛选"
              className="project-status-filter"
              onValueChange={handleFilterChange}
              options={statusOptions}
              placeholder="全部状态"
              value={activeFilters}
            />
            <RouterButton to="/projects/create">
              <JadeIcon name="add" size="1em" />
              <span>新建项目</span>
            </RouterButton>
          </>
        }
        title="项目管理"
      />

      <section aria-label="项目台账" className="projects-workspace" data-motion="entrance">
        {busy ? (
          <span aria-label="正在加载项目列表" className="ods-sr-only" role="status">
            正在加载项目列表
          </span>
        ) : null}
        {busy && dataIsCurrent ? <Skeleton className="projects-load-indicator" height={2} /> : null}
        <Table.Root
          aria-busy={busy}
          aria-label="项目列表"
          className="project-table"
          stickyHeader
          variant="plain"
          wrapperClassName="project-table-scroll"
        >
          <Table.Header>
            <Table.Row>
              <Table.Column className="project-name-column">项目名称</Table.Column>
              <Table.Column className="project-client-column">客户</Table.Column>
              <Table.Column>截止日期</Table.Column>
              <Table.Column align="end">合同金额</Table.Column>
              <Table.Column align="end">已收款</Table.Column>
              <Table.Column className="project-progress-column">收款进度</Table.Column>
              <Table.Column>状态</Table.Column>
              <Table.Column align="end" sticky="end">
                <span className="ods-sr-only">操作</span>
              </Table.Column>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {loadError ? (
              <Table.Row>
                <Table.Cell colSpan={colSpan}>
                  <Alert
                    action={
                      <Button
                        aria-label="重试项目列表"
                        onClick={() => void fetchProjects()}
                        size="sm"
                        variant="secondary"
                      >
                        <JadeIcon name="refresh" size="1em" />
                        重试
                      </Button>
                    }
                    icon={<JadeIcon name="warning" size="1em" />}
                    title="项目列表加载失败"
                    tone="danger"
                  >
                    {dataIsCurrent
                      ? '当前展示最近一次成功加载的数据。'
                      : '暂时无法获取项目数据，请稍后重试。'}
                  </Alert>
                </Table.Cell>
              </Table.Row>
            ) : null}

            {(dataIsCurrent ? projects : []).map((project) => {
              const progress = getProgress(project)
              const progressLabel = progress === null ? '—' : `${progress}%`
              return (
                <Table.Row
                  data-motion-item
                  interactive
                  key={project.id}
                  onClick={() => navigate(`/projects/${project.id}`)}
                >
                  <Table.Cell className="project-name-column" title={project.name}>
                    <RouterLink
                      className="project-name-link"
                      tone="foreground"
                      onClick={(event) => event.stopPropagation()}
                      to={`/projects/${project.id}`}
                    >
                      {project.name}
                    </RouterLink>
                  </Table.Cell>
                  <Table.Cell className="project-client-column" title={project.company}>
                    {project.company || '—'}
                  </Table.Cell>
                  <Table.Cell className="project-date-cell">
                    {formatDate(project.end_date)}
                  </Table.Cell>
                  <Table.Cell align="end" className="project-amount-cell">
                    {showAmount(project.total_amount)}
                  </Table.Cell>
                  <Table.Cell align="end" className="project-amount-cell">
                    {showAmount(project.received_amount || 0)}
                  </Table.Cell>
                  <Table.Cell className="project-progress-column">
                    <div className="project-progress-cell">
                      <ProgressBar
                        label={`${project.name} 收款进度`}
                        motion="reveal"
                        value={progress ?? 0}
                        valueLabel={progressLabel}
                      />
                      <div className="project-progress-caption">
                        <span>
                          {showAmount(project.received_amount || 0)} /{' '}
                          {showAmount(project.total_amount)}
                        </span>
                        <span>{progressLabel}</span>
                      </div>
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <ProjectStatusChip size="lg" status={project.status} />
                  </Table.Cell>
                  <Table.Cell align="end" sticky="end">
                    <Dropdown
                      onOpenChange={(open) => setActiveDropdownId(open ? project.id : null)}
                      open={activeDropdownId === project.id}
                      placement="bottom-end"
                    >
                      <Dropdown.Trigger>
                        <IconButton
                          aria-haspopup="menu"
                          label={`${project.name}：项目操作`}
                          onClick={(event) => event.stopPropagation()}
                          variant="ghost"
                        >
                          <JadeIcon name="more" size="1em" />
                        </IconButton>
                      </Dropdown.Trigger>
                      <Dropdown.Menu
                        label={`${project.name} 的操作`}
                        onClick={(event) => event.stopPropagation()}
                      >
                        <Dropdown.Item
                          onSelect={() => navigate(`/projects/edit/${project.id}`)}
                          startContent={<JadeIcon name="edit" size="1em" />}
                        >
                          编辑项目
                        </Dropdown.Item>
                        <Dropdown.Item
                          onSelect={() => navigate(`/projects/${project.id}/payment/create`)}
                          startContent={<JadeIcon name="currency" size="1em" />}
                        >
                          添加收款
                        </Dropdown.Item>
                        <Dropdown.Item
                          onSelect={() => {
                            setActiveDropdownId(null)
                            void exportProject(project)
                          }}
                          startContent={<JadeIcon name="download" size="1em" />}
                        >
                          导出项目
                        </Dropdown.Item>
                        <Dropdown.Item
                          onSelect={() => {
                            setActiveDropdownId(null)
                            setConfirmation({ action: 'archive', projectId: project.id })
                          }}
                          startContent={<JadeIcon name="archive" size="1em" />}
                        >
                          归档项目
                        </Dropdown.Item>
                        <Dropdown.Item
                          onSelect={() => {
                            setActiveDropdownId(null)
                            setConfirmation({ action: 'delete', projectId: project.id })
                          }}
                          startContent={<JadeIcon name="trash" size="1em" />}
                          tone="danger"
                        >
                          删除项目
                        </Dropdown.Item>
                      </Dropdown.Menu>
                    </Dropdown>
                  </Table.Cell>
                </Table.Row>
              )
            })}

            {showingSkeleton
              ? Array.from({ length: 4 }, (_, index) => (
                  <Table.Row aria-hidden="true" key={`project-loading-${index}`}>
                    <Table.Cell>
                      <Skeleton height="1.25rem" width={index % 2 ? '68%' : '82%'} />
                    </Table.Cell>
                    <Table.Cell>
                      <Skeleton height="1rem" width="80%" />
                    </Table.Cell>
                    <Table.Cell>
                      <Skeleton height="1rem" width="85%" />
                    </Table.Cell>
                    <Table.Cell align="end">
                      <Skeleton height="1rem" width="88%" />
                    </Table.Cell>
                    <Table.Cell align="end">
                      <Skeleton height="1rem" width="78%" />
                    </Table.Cell>
                    <Table.Cell>
                      <div className="main-loading-stack">
                        <Skeleton height="0.5rem" />
                        <Skeleton height="0.75rem" width="72%" />
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <Skeleton height="1.5rem" width="80%" />
                    </Table.Cell>
                    <Table.Cell align="end" sticky="end">
                      <Skeleton height="1.5rem" width="1.5rem" shape="circle" />
                    </Table.Cell>
                  </Table.Row>
                ))
              : null}

            {dataIsCurrent && projects.length === 0 && !loadError ? (
              <Table.Row>
                <Table.Cell colSpan={colSpan}>
                  <EmptyState
                    action={
                      isFiltered ? (
                        <Button onClick={clearFilters} size="sm" variant="ghost">
                          清除筛选
                        </Button>
                      ) : (
                        <RouterButton size="sm" to="/projects/create">
                          新建项目
                        </RouterButton>
                      )
                    }
                    scene={
                      <EmptyScene
                        name={isFiltered ? 'search-empty' : 'projects-empty'}
                        size={isFiltered ? 'standard' : 'hero'}
                      />
                    }
                    size="lg"
                    title={isFiltered ? '没有符合条件的项目' : '还没有项目'}
                  />
                </Table.Cell>
              </Table.Row>
            ) : null}
          </Table.Body>
        </Table.Root>

        {showingSkeleton ? (
          <div
            aria-hidden="true"
            className="projects-pagination projects-loading-pagination main-loading-row"
          >
            <Skeleton height="1rem" width="12rem" />
            <Skeleton height="2rem" width="9rem" />
          </div>
        ) : dataIsCurrent && totalItems > 0 && totalPages > 0 ? (
          <PaginationBar
            className="projects-pagination"
            info={paginationInfo}
            onPageChange={setCurrentPage}
            page={currentPage}
            pageCount={totalPages}
            paginationLabel="项目分页"
            trailing={
              <Select
                aria-label="每页条数"
                clearable={false}
                onValueChange={(value) => {
                  setPageSize(Number(value))
                  setCurrentPage(1)
                }}
                options={pageSizeOptions}
                size="sm"
                value={String(pageSize)}
                width="content"
              />
            }
          />
        ) : null}

        <AlertDialog
          action={confirmation?.action === 'archive' ? '确认归档' : '确认删除'}
          actionVariant={confirmation?.action === 'archive' ? 'primary' : 'danger'}
          description={
            confirmation?.action === 'archive'
              ? '归档后仍可在归档项目筛选中查看。'
              : '删除后无法恢复，相关项目数据也将不可访问。'
          }
          onAction={() => void performConfirmedAction()}
          onClose={() => setConfirmation(null)}
          open={confirmation !== null}
          pending={confirming}
          title={confirmation?.action === 'archive' ? '归档项目？' : '删除项目？'}
        />
      </section>
    </div>
  )
}
