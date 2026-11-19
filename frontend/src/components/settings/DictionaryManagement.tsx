import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { dictionaryApi, type Dictionary, type DictionaryItem } from '@/api/dictionary'
import { useConfirm } from '@/composables/useConfirm'
import { useToastStore } from '@/composables/useToast'
import {
  Button,
  Code,
  EmptyState,
  Field,
  FormActions,
  IconButton,
  Input,
  Modal,
  Table,
  Tabs,
} from '@/design-system'

interface DictionaryItemForm {
  id: number
  label: string
  sort: number
  value: string
}

const emptyForm: DictionaryItemForm = {
  id: 0,
  label: '',
  sort: 0,
  value: '',
}

export default function DictionaryManagement() {
  const { confirm } = useConfirm()
  const toastError = useToastStore((state) => state.error)
  const toastSuccess = useToastStore((state) => state.success)
  const toastWarning = useToastStore((state) => state.warning)
  const [activeDictId, setActiveDictId] = useState('')
  const [dictionaries, setDictionaries] = useState<Dictionary[]>([])
  const [activeDictItems, setActiveDictItems] = useState<DictionaryItem[]>([])
  const [showModal, setShowModal] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [modalForm, setModalForm] = useState<DictionaryItemForm>(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const dictionariesRequestRef = useRef(0)
  const itemsRequestRef = useRef(0)
  const submitInFlightRef = useRef(false)
  const returnFocusRef = useRef<HTMLButtonElement | null>(null)
  const nameInputRef = useRef<HTMLInputElement | null>(null)

  const activeDictName = useMemo(() => {
    const dictionary = dictionaries.find((item) => item.code === activeDictId)
    return dictionary?.name || activeDictId
  }, [activeDictId, dictionaries])

  const fetchDictItems = useCallback(
    async (code: string) => {
      if (!code) return
      const requestId = ++itemsRequestRef.current
      try {
        const response = await dictionaryApi.getItems(code)
        if (requestId === itemsRequestRef.current) setActiveDictItems(response.data.data)
      } catch {
        if (requestId === itemsRequestRef.current) toastError('获取字典项失败')
      }
    },
    [toastError],
  )

  const fetchDictionaries = useCallback(async () => {
    const requestId = ++dictionariesRequestRef.current
    try {
      const response = await dictionaryApi.list()
      const nextDictionaries = response.data.data
      if (requestId === dictionariesRequestRef.current) {
        setDictionaries(nextDictionaries)
        setActiveDictId((current) => current || nextDictionaries[0]?.code || '')
      }
    } catch {
      if (requestId === dictionariesRequestRef.current) toastError('获取字典失败')
    }
  }, [toastError])

  useEffect(() => {
    const timer = window.setTimeout(fetchDictionaries, 0)
    return () => {
      window.clearTimeout(timer)
      dictionariesRequestRef.current += 1
    }
  }, [fetchDictionaries])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchDictItems(activeDictId)
    }, 0)
    return () => {
      window.clearTimeout(timer)
      itemsRequestRef.current += 1
    }
  }, [activeDictId, fetchDictItems])

  const openAddModal = (event: MouseEvent<HTMLButtonElement>) => {
    returnFocusRef.current = event.currentTarget
    setIsEditing(false)
    setModalForm({
      ...emptyForm,
      sort: activeDictItems.length + 1,
    })
    setShowModal(true)
  }

  const openEditModal = (item: DictionaryItem, event: MouseEvent<HTMLButtonElement>) => {
    returnFocusRef.current = event.currentTarget
    setIsEditing(true)
    setModalForm({
      id: item.id,
      label: item.label,
      sort: item.sort,
      value: item.value,
    })
    setShowModal(true)
  }

  const handleModalSubmit = async () => {
    if (!activeDictId || submitInFlightRef.current) return

    const label = modalForm.label.trim()
    const value = modalForm.value.trim()
    if (!label || !value) {
      toastWarning('请输入名称和值')
      return
    }

    submitInFlightRef.current = true
    setSubmitting(true)
    try {
      if (isEditing) {
        await dictionaryApi.updateItem(activeDictId, modalForm.id, {
          label,
          sort: modalForm.sort,
          value,
        })
      } else {
        await dictionaryApi.createItem(activeDictId, {
          label,
          sort: modalForm.sort,
          value,
        })
      }

      toastSuccess(isEditing ? '修改成功' : '添加成功')
      setShowModal(false)
      await fetchDictItems(activeDictId)
    } catch {
      toastError(isEditing ? '修改失败' : '添加失败')
    } finally {
      submitInFlightRef.current = false
      setSubmitting(false)
    }
  }

  const deleteDictItem = async (id: number) => {
    if (!activeDictId) return

    const confirmed = await confirm({
      actionLabel: '删除选项',
      actionVariant: 'danger',
      message: '确定要删除这个选项吗？',
      title: '删除字典项？',
    })
    if (!confirmed) return

    try {
      await dictionaryApi.deleteItem(activeDictId, id)
      await fetchDictItems(activeDictId)
      toastSuccess('删除成功')
    } catch {
      toastError('删除失败')
    }
  }

  return (
    <div className="dict-management settings-page">
      <Tabs.Root className="dict-layout" onValueChange={setActiveDictId} value={activeDictId}>
        <div className="settings-toolbar">
          <Tabs.List aria-label="字典分类" variant="accent">
            {dictionaries.map((dictionary) => (
              <Tabs.Tab key={dictionary.id} value={dictionary.code}>
                {dictionary.name}
              </Tabs.Tab>
            ))}
          </Tabs.List>
          <Button disabled={!activeDictId} onClick={openAddModal}>
            <i aria-hidden="true" className="ri-add-line" />
            <span>新增条目</span>
          </Button>
        </div>

        <Tabs.Panel value={activeDictId}>
          {activeDictItems.length === 0 ? (
            <EmptyState
              className="settings-empty"
              icon={<i aria-hidden="true" className="ri-file-list-3-line" />}
              size="md"
              title={`${activeDictName || '字典'}还没有条目`}
            />
          ) : (
            <Table.Root aria-label={`${activeDictName}条目`} className="settings-table">
              <Table.Header>
                <Table.Row>
                  <Table.Column>名称</Table.Column>
                  <Table.Column className="dict-value-column">值</Table.Column>
                  <Table.Column align="end" className="dict-sort-column">
                    排序
                  </Table.Column>
                  <Table.Column align="end" className="settings-actions-column">
                    <span className="ods-sr-only">操作</span>
                  </Table.Column>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {activeDictItems.map((item) => (
                  <Table.Row key={item.id}>
                    <Table.Cell>{item.label}</Table.Cell>
                    <Table.Cell>
                      <Code>{item.value}</Code>
                    </Table.Cell>
                    <Table.Cell align="end" className="settings-table__number">
                      {item.sort}
                    </Table.Cell>
                    <Table.Cell align="end">
                      <div className="settings-table__actions">
                        <IconButton
                          label="编辑字典条目"
                          onClick={(event) => openEditModal(item, event)}
                          size="sm"
                          title="编辑"
                          variant="ghost"
                        >
                          <i aria-hidden="true" className="ri-edit-line" />
                        </IconButton>
                        <IconButton
                          label="删除字典条目"
                          onClick={() => void deleteDictItem(item.id)}
                          size="sm"
                          title="删除"
                          tone="danger"
                          variant="ghost"
                        >
                          <i aria-hidden="true" className="ri-delete-bin-line" />
                        </IconButton>
                      </div>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          )}
        </Tabs.Panel>
      </Tabs.Root>

      <Modal.Root
        dismissable={!submitting}
        onClose={() => setShowModal(false)}
        open={showModal}
        returnFocusRef={returnFocusRef}
        initialFocusRef={nameInputRef}
      >
        <Modal.Header>{isEditing ? '编辑条目' : '新增条目'}</Modal.Header>
        {!submitting ? (
          <Modal.Close label={isEditing ? '关闭编辑条目弹窗' : '关闭新增条目弹窗'} />
        ) : null}
        <Modal.Body className="settings-modal-body">
          <Field.Root>
            <Field.Label>名称 (Label)</Field.Label>
            <Input
              ref={nameInputRef}
              autoComplete="off"
              onChange={(event) =>
                setModalForm((current) => ({ ...current, label: event.target.value }))
              }
              spellCheck={false}
              type="text"
              value={modalForm.label}
            />
          </Field.Root>
          <Field.Root>
            <Field.Label>值 (Value)</Field.Label>
            <Input
              autoComplete="off"
              onChange={(event) =>
                setModalForm((current) => ({ ...current, value: event.target.value }))
              }
              spellCheck={false}
              type="text"
              value={modalForm.value}
            />
          </Field.Root>
          <Field.Root>
            <Field.Label>排序 (Sort)</Field.Label>
            <Input
              autoComplete="off"
              onChange={(event) =>
                setModalForm((current) => ({ ...current, sort: Number(event.target.value) }))
              }
              spellCheck={false}
              type="number"
              value={modalForm.sort}
            />
          </Field.Root>
        </Modal.Body>
        <Modal.Footer>
          <FormActions>
            <Button disabled={submitting} onClick={() => setShowModal(false)} variant="secondary">
              取消
            </Button>
            <Button onClick={() => void handleModalSubmit()} pending={submitting}>
              {submitting ? '保存中...' : '保存'}
            </Button>
          </FormActions>
        </Modal.Footer>
      </Modal.Root>
    </div>
  )
}
