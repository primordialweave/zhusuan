import { useCallback, useState } from 'react'
import { dictionaryApi } from '@/api/dictionary'
import { projectApi, type Payment, type Project } from '@/api/project'
import { useToastStore } from '@/composables/useToast'
import { exportCsv } from '@/utils/csv'
import {
  buildProjectExportRows,
  projectExportFilename,
  type ProjectExportLabels,
} from '@/utils/projectExport'

/** The file should read as the app does. A dictionary that fails to load leaves stored values. */
const loadLabels = async (): Promise<ProjectExportLabels> => {
  const load = (code: string) =>
    dictionaryApi
      .getItems(code)
      .then((response) =>
        Object.fromEntries(response.data.data.map(({ label, value }) => [value, label])),
      )
      .catch(() => undefined)
  const [type, stage, method] = await Promise.all([
    load('project_type'),
    load('payment_stage'),
    load('payment_method'),
  ])
  return { method, stage, type }
}

export interface SavedProjectExportEvent {
  eventKey: number
  projectId: number
}

/**
 * Exports one project with its payment plan as a CSV. Pass the payments when the page already
 * has them; otherwise they are fetched first.
 */
export function useProjectExport() {
  const toastError = useToastStore((state) => state.error)
  const toastSuccess = useToastStore((state) => state.success)
  const [exportingId, setExportingId] = useState<number | null>(null)
  const [lastSavedExport, setLastSavedExport] = useState<SavedProjectExportEvent | null>(null)

  const exportProject = useCallback(
    async (project: Project, knownPayments?: Payment[]) => {
      setExportingId(project.id)
      try {
        const [payments, labels] = await Promise.all([
          knownPayments ??
            projectApi.getPayments(project.id).then((response) => response.data.data ?? []),
          loadLabels(),
        ])
        const result = await exportCsv(
          projectExportFilename(project),
          buildProjectExportRows(project, payments, labels),
        )
        if (result.status === 'saved') {
          toastSuccess('项目已导出')
          setLastSavedExport((current) => ({
            eventKey: (current?.eventKey ?? 0) + 1,
            projectId: project.id,
          }))
        }
      } catch {
        toastError('导出失败，请重试')
      } finally {
        setExportingId(null)
      }
    },
    [toastError, toastSuccess],
  )

  return { exportProject, exportingId, lastSavedExport }
}
