import { useCallback, useEffect, useRef, useState } from 'react'
import { projectApi, type Project } from '@/api/project'
import {
  Button,
  ButtonGroup,
  EmptyState,
  Field,
  IconButton,
  Listbox,
  Popover,
  SearchField,
  Spinner,
  useFieldControlProps,
} from '@/design-system'

const PAGE_SIZE = 20

interface ProjectPickerProps {
  disabled?: boolean
  onValueChange: (project: Project) => void
  value?: Project
}

/** Loads one searchable project page while keeping the chosen project independent of results. */
export function ProjectPicker({ disabled, onValueChange, value }: ProjectPickerProps) {
  const control = useFieldControlProps<{
    disabled?: boolean
    id?: string
    'aria-describedby'?: string
  }>({ disabled })
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [projects, setProjects] = useState<Project[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const generationRef = useRef(0)

  const load = useCallback(async () => {
    const generation = ++generationRef.current
    setLoading(true)
    setFailed(false)
    try {
      const response = await projectApi.list({
        page,
        page_size: PAGE_SIZE,
        keyword: keyword || undefined,
      })
      if (generation !== generationRef.current) return
      setProjects(response.data.data.list)
      setTotal(response.data.data.total)
    } catch {
      if (generation === generationRef.current) setFailed(true)
    } finally {
      if (generation === generationRef.current) setLoading(false)
    }
  }, [keyword, page])

  useEffect(() => {
    if (!open) return
    const timer = window.setTimeout(() => void load(), 0)
    return () => {
      window.clearTimeout(timer)
      generationRef.current += 1
    }
  }, [load, open])

  const search = (text: string) => {
    setKeyword(text.trim())
    setPage(1)
  }
  const choose = (id: string) => {
    const project = projects.find((item) => String(item.id) === id)
    if (project) {
      onValueChange(project)
      setOpen(false)
    }
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen} placement="bottom-start">
      <Popover.Trigger>
        <Button
          id={control.id}
          aria-describedby={control['aria-describedby']}
          aria-label="选择项目"
          className="payment-project-trigger"
          disabled={control.disabled}
          variant="outline"
        >
          <span>{value?.name || '请选择项目'}</span>
          <i aria-hidden="true" className="ri-arrow-down-s-line" />
        </Button>
      </Popover.Trigger>
      <Popover.Content
        className="payment-project-popover"
        initialFocus="input[type=search]"
        role="presentation"
      >
        <Field.Root>
          <SearchField
            aria-label="搜索所属项目"
            onValueChange={setInput}
            value={input}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                search(input)
              }
            }}
            onClear={() => search('')}
            placeholder="搜索项目"
            pending={loading}
          />
        </Field.Root>
        {loading ? (
          <Spinner label="正在加载项目" />
        ) : failed ? (
          <EmptyState
            title="项目暂时不可用"
            size="sm"
            action={
              <Button size="sm" onClick={() => void load()}>
                重试
              </Button>
            }
          />
        ) : projects.length === 0 ? (
          <EmptyState title="没有匹配项目" size="sm" />
        ) : (
          <Listbox
            aria-label="所属项目"
            onSelect={choose}
            selectedValues={value ? [String(value.id)] : []}
          >
            {projects.map((project) => (
              <Listbox.Item key={project.id} value={String(project.id)}>
                {project.name}
              </Listbox.Item>
            ))}
          </Listbox>
        )}
        <ButtonGroup aria-label="项目分页" className="payment-project-pages">
          <IconButton
            label="上一页项目"
            disabled={loading || page <= 1}
            onClick={() => setPage((current) => current - 1)}
            variant="ghost"
          >
            <i aria-hidden="true" className="ri-arrow-left-s-line" />
          </IconButton>
          <span>
            {page} / {Math.max(1, Math.ceil(total / PAGE_SIZE))}
          </span>
          <IconButton
            label="下一页项目"
            disabled={loading || page * PAGE_SIZE >= total}
            onClick={() => setPage((current) => current + 1)}
            variant="ghost"
          >
            <i aria-hidden="true" className="ri-arrow-right-s-line" />
          </IconButton>
        </ButtonGroup>
      </Popover.Content>
    </Popover.Root>
  )
}
