import { act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { dictionaryApi, type Dictionary, type DictionaryItem } from '@/api/dictionary'
import { fireEvent, render, screen, waitFor } from '@/test/render'
import DictionaryManagement from './DictionaryManagement'

vi.mock('@/api/dictionary', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/api/dictionary')>()
  return {
    ...original,
    dictionaryApi: {
      ...original.dictionaryApi,
      createItem: vi.fn(),
      deleteItem: vi.fn(),
      getItems: vi.fn(),
      list: vi.fn(),
      updateItem: vi.fn(),
    },
  }
})

const dictionaries = [
  { code: 'project_type', id: 1, name: '项目类型', remark: '', status: 1 },
  { code: 'payment_stage', id: 2, name: '收款阶段', remark: '', status: 1 },
] satisfies Dictionary[]

const dictionaryItem = (id: number, dictionaryId: number, label: string) =>
  ({
    dictionary_id: dictionaryId,
    id,
    label,
    sort: id,
    status: 1,
    value: label,
  }) satisfies DictionaryItem

const response = <T,>(data: T) => ({ data: { data } })

const deferred = <T,>() => {
  let resolve: (value: T) => void = () => undefined
  const promise = new Promise<T>((next) => {
    resolve = next
  })
  return { promise, resolve }
}

describe('DictionaryManagement request integrity', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(dictionaryApi.list).mockResolvedValue(response(dictionaries) as never)
    vi.mocked(dictionaryApi.getItems).mockResolvedValue(response([]) as never)
  })

  it('does not reload the old dictionary when a deletion finishes after switching categories', async () => {
    const user = userEvent.setup()
    const deletion = deferred<unknown>()
    vi.mocked(dictionaryApi.getItems).mockImplementation(
      (code) =>
        Promise.resolve(
          response([
            dictionaryItem(
              code === 'project_type' ? 11 : 21,
              code === 'project_type' ? 1 : 2,
              code === 'project_type' ? '旧分类条目' : '当前分类条目',
            ),
          ]),
        ) as never,
    )
    vi.mocked(dictionaryApi.deleteItem).mockReturnValueOnce(deletion.promise as never)
    render(<DictionaryManagement />)
    const row = await screen.findByRole('row', { name: /旧分类条目/ })
    await user.click(row.querySelector('button[aria-label="删除字典条目"]') as HTMLButtonElement)
    await user.click(screen.getByRole('button', { name: '删除选项' }))
    await waitFor(() => expect(dictionaryApi.deleteItem).toHaveBeenCalledOnce())
    await user.click(screen.getByRole('tab', { name: '收款阶段' }))
    await screen.findByRole('row', { name: /当前分类条目/ })
    await act(async () => {
      deletion.resolve(response(null))
    })
    expect(screen.getByRole('row', { name: /当前分类条目/ })).toBeInTheDocument()
    expect(vi.mocked(dictionaryApi.getItems).mock.calls.map(([code]) => code)).toEqual([
      'project_type',
      'payment_stage',
    ])
  })

  it('shows dictionary and item skeletons until their independent requests resolve', async () => {
    const listRequest = deferred<ReturnType<typeof response<Dictionary[]>>>()
    const itemsRequest = deferred<ReturnType<typeof response<DictionaryItem[]>>>()
    vi.mocked(dictionaryApi.list).mockReturnValueOnce(listRequest.promise as never)
    vi.mocked(dictionaryApi.getItems).mockReturnValueOnce(itemsRequest.promise as never)
    render(<DictionaryManagement />)

    expect(screen.getByRole('status', { name: '正在加载字典' })).toBeInTheDocument()
    expect(screen.queryByText('字典还没有条目')).not.toBeInTheDocument()
    await waitFor(() => expect(dictionaryApi.list).toHaveBeenCalledOnce())
    await act(async () => listRequest.resolve(response(dictionaries)))
    await waitFor(() => expect(dictionaryApi.getItems).toHaveBeenCalledOnce())
    expect(screen.getByRole('status', { name: '正在加载项目类型条目' })).toBeInTheDocument()
    await act(async () => itemsRequest.resolve(response([dictionaryItem(9, 1, '加载完成的类型')])))

    expect(await screen.findByRole('row', { name: /加载完成的类型/ })).toBeInTheDocument()
    expect(screen.queryByRole('status', { name: '正在加载项目类型条目' })).not.toBeInTheDocument()
  })

  it('restores the actual trigger when pointer activation did not focus it', async () => {
    const user = userEvent.setup()
    render(<DictionaryManagement />)
    const trigger = await screen.findByRole('button', { name: '新增条目' })
    await waitFor(() => expect(trigger).toBeEnabled())
    expect(trigger).not.toHaveFocus()
    fireEvent.click(trigger)
    expect(screen.getByLabelText('名称 (Label)')).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(trigger).toHaveFocus()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('keeps the latest dictionary items when an older request resolves last', async () => {
    const firstRequest = deferred<ReturnType<typeof response<DictionaryItem[]>>>()
    const secondRequest = deferred<ReturnType<typeof response<DictionaryItem[]>>>()
    vi.mocked(dictionaryApi.getItems)
      .mockReset()
      .mockReturnValueOnce(firstRequest.promise as never)
      .mockReturnValueOnce(secondRequest.promise as never)
    const user = userEvent.setup()
    render(<DictionaryManagement />)

    await waitFor(() => expect(dictionaryApi.getItems).toHaveBeenCalledWith('project_type'))
    await user.click(screen.getByRole('tab', { name: /收款阶段/ }))
    await waitFor(() => expect(dictionaryApi.getItems).toHaveBeenCalledWith('payment_stage'))

    await act(async () => {
      secondRequest.resolve(response([dictionaryItem(2, 2, '尾款')]))
      await secondRequest.promise
    })
    expect(await screen.findAllByText('尾款')).toHaveLength(2)

    await act(async () => {
      firstRequest.resolve(response([dictionaryItem(1, 1, '软件项目')]))
      await firstRequest.promise
    })
    expect(screen.getAllByText('尾款')).toHaveLength(2)
    expect(screen.queryByText('软件项目')).not.toBeInTheDocument()
  })

  it('prevents duplicate dictionary items while a save is pending', async () => {
    const createRequest = deferred<unknown>()
    vi.mocked(dictionaryApi.createItem).mockReturnValue(createRequest.promise as never)
    const user = userEvent.setup()
    render(<DictionaryManagement />)

    await user.click(await screen.findByRole('button', { name: /新增条目/ }))
    await user.type(screen.getByLabelText('名称 (Label)'), '新条目')
    await user.type(screen.getByLabelText('值 (Value)'), 'new-item')
    const save = screen.getByRole('button', { name: '保存' })

    save.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    save.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))

    expect(dictionaryApi.createItem).toHaveBeenCalledTimes(1)
    await act(async () => {
      createRequest.resolve(undefined)
      await createRequest.promise
    })
  })

  it('shows a category load error instead of a fake empty state when dictionary list fails and recovers on retry', async () => {
    const user = userEvent.setup()
    vi.mocked(dictionaryApi.list)
      .mockRejectedValueOnce(new Error('categories unavailable'))
      .mockResolvedValueOnce(response(dictionaries) as never)
    vi.mocked(dictionaryApi.getItems).mockResolvedValueOnce(
      response([dictionaryItem(3, 1, '咨询服务')]) as never,
    )

    render(<DictionaryManagement />)

    expect(await screen.findByRole('alert')).toHaveTextContent('字典分类加载失败')
    expect(screen.queryByText('字典还没有条目')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '新增条目' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: '重新加载' }))
    expect(await screen.findByRole('row', { name: /咨询服务/ })).toBeInTheDocument()
  })

  it('shows a scope-specific error without leaking old rows when switching to a failing dictionary', async () => {
    const user = userEvent.setup()
    vi.mocked(dictionaryApi.getItems)
      .mockReset()
      .mockResolvedValueOnce(response([dictionaryItem(1, 1, '软件项目')]) as never)
      .mockRejectedValueOnce(new Error('stage items failed'))
      .mockResolvedValueOnce(response([dictionaryItem(2, 2, '首付款')]) as never)

    render(<DictionaryManagement />)

    expect(await screen.findByRole('row', { name: /软件项目/ })).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: /收款阶段/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent('收款阶段条目加载失败')
    expect(screen.queryByText('软件项目')).not.toBeInTheDocument()
    expect(screen.queryByText('收款阶段还没有条目')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '重试' }))
    expect(await screen.findByRole('row', { name: /首付款/ })).toBeInTheDocument()
  })

  it('preserves loaded rows when a same-scope refresh fails after saving', async () => {
    const user = userEvent.setup()
    vi.mocked(dictionaryApi.getItems)
      .mockReset()
      .mockResolvedValueOnce(response([dictionaryItem(1, 1, '软件项目')]) as never)
      .mockRejectedValueOnce(new Error('refresh failed'))
    vi.mocked(dictionaryApi.createItem).mockResolvedValueOnce(undefined as never)

    render(<DictionaryManagement />)

    expect(await screen.findByRole('row', { name: /软件项目/ })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /新增条目/ }))
    await user.type(screen.getByLabelText('名称 (Label)'), '新分类')
    await user.type(screen.getByLabelText('值 (Value)'), 'new-cat')
    await user.click(screen.getByRole('button', { name: '保存' }))

    await waitFor(() => expect(dictionaryApi.getItems).toHaveBeenCalledTimes(2))
    expect(screen.getByRole('row', { name: /软件项目/ })).toBeInTheDocument()
    expect(screen.queryByText('项目类型条目加载失败')).not.toBeInTheDocument()
  })

  it('uses distinct row button hierarchy for edit and delete dictionary actions', async () => {
    vi.mocked(dictionaryApi.getItems).mockResolvedValueOnce(
      response([dictionaryItem(1, 1, '软件项目')]) as never,
    )
    render(<DictionaryManagement />)
    expect(await screen.findByRole('row', { name: /软件项目/ })).toBeInTheDocument()

    const editButton = screen.getByRole('button', { name: '编辑字典条目' })
    const deleteButton = screen.getByRole('button', { name: '删除字典条目' })

    expect(editButton).toHaveAttribute('data-variant', 'tertiary')
    expect(deleteButton).toHaveAttribute('data-variant', 'tertiary')
    expect(deleteButton).toHaveAttribute('data-tone', 'danger')
  })
})
