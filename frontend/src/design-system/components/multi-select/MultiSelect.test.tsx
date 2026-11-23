import { createRef, useState } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Field } from '../field'
import { MultiSelect } from './MultiSelect'

const options = [
  { label: '进行中', value: 'active' },
  { label: '已完成', value: 'completed' },
  { label: '未开始', value: 'notstarted' },
  { label: '已归档', value: 'archived', disabled: true },
]

function Controlled({ initialValue = [] }: { initialValue?: string[] }) {
  const [value, setValue] = useState(initialValue)
  return (
    <>
      <button type="button">前一个控件</button>
      <MultiSelect
        aria-label="项目状态"
        onValueChange={setValue}
        options={options}
        placeholder="全部状态"
        value={value}
      />
      <button type="button">后一个控件</button>
    </>
  )
}

describe('MultiSelect', () => {
  it('toggles several selections without closing, preserves them when reopened, and removes a selection', async () => {
    const user = userEvent.setup()
    render(<Controlled />)
    const trigger = screen.getByRole('button', { name: '项目状态' })
    await user.click(trigger)
    expect(screen.getByRole('listbox')).toHaveAttribute('aria-multiselectable', 'true')
    await user.click(screen.getByRole('option', { name: '进行中' }))
    await user.click(screen.getByRole('option', { name: '已完成' }))
    expect(screen.getByRole('option', { name: '进行中' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('option', { name: '已完成' })).toHaveAttribute('aria-selected', 'true')
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(trigger).toHaveTextContent('进行中+1')
    expect(trigger).toHaveAccessibleDescription('已选 2 项：进行中、已完成')

    await user.keyboard('{Escape}')
    expect(trigger).toHaveFocus()
    await user.click(trigger)
    expect(screen.getByRole('option', { name: '进行中' })).toHaveFocus()
    await user.click(screen.getByRole('option', { name: '进行中' }))
    expect(trigger).toHaveTextContent('已完成')
    expect(screen.getByRole('option', { name: '进行中' })).toHaveAttribute('aria-selected', 'false')
  })

  it('supports arrows, Home/End and Space/Enter toggles while skipping disabled options', async () => {
    const user = userEvent.setup()
    render(<Controlled />)
    const trigger = screen.getByRole('button', { name: '项目状态' })
    trigger.focus()
    await user.keyboard('{ArrowDown}')
    expect(screen.getByRole('option', { name: '进行中' })).toHaveFocus()
    await user.keyboard(' {ArrowDown}{Enter}')
    expect(screen.getByRole('option', { name: '已完成' })).toHaveAttribute('aria-selected', 'true')
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    await user.keyboard('{End}')
    expect(screen.getByRole('option', { name: '未开始' })).toHaveFocus()
    await user.keyboard('{ArrowDown}')
    expect(screen.getByRole('option', { name: '进行中' })).toHaveFocus()
    await user.keyboard('{ArrowUp}')
    expect(screen.getByRole('option', { name: '未开始' })).toHaveFocus()
    await user.keyboard('{Home} ')
    expect(screen.getByRole('option', { name: '进行中' })).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByRole('option', { name: '已归档' })).toHaveAttribute('aria-selected', 'false')
  })

  it('supports typeahead and repeated-character cycling without selecting on focus', async () => {
    const user = userEvent.setup()
    render(
      <MultiSelect
        aria-label="区域"
        onValueChange={vi.fn()}
        options={[
          { label: 'East', value: 'east' },
          { label: 'North', value: 'north' },
          { label: 'Northeast', value: 'northeast' },
          { label: 'South', value: 'south' },
        ]}
      />,
    )
    await user.click(screen.getByRole('button', { name: '区域' }))
    await user.keyboard('n')
    expect(screen.getByRole('option', { name: 'North' })).toHaveFocus()
    await user.keyboard('n')
    expect(screen.getByRole('option', { name: 'Northeast' })).toHaveFocus()
    expect(screen.getByRole('option', { name: 'Northeast' })).toHaveAttribute(
      'aria-selected',
      'false',
    )
    await user.keyboard('{Escape}')
    await user.click(screen.getByRole('button', { name: '区域' }))
    await user.keyboard('south')
    expect(screen.getByRole('option', { name: 'South' })).toHaveFocus()
  })

  it('closes on Tab and Shift+Tab and continues from the trigger in document order', async () => {
    const user = userEvent.setup()
    render(<Controlled initialValue={['active']} />)
    const trigger = screen.getByRole('button', { name: '项目状态' })
    await user.click(trigger)
    await user.tab()
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '后一个控件' })).toHaveFocus()
    await user.click(trigger)
    await user.tab({ shift: true })
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '前一个控件' })).toHaveFocus()
  })

  it('clears all values without opening the menu and returns focus to the forwarded trigger', async () => {
    const user = userEvent.setup()
    render(<Controlled initialValue={['active', 'completed']} />)
    const trigger = screen.getByRole('button', { name: '项目状态' })
    const clear = screen.getByRole('button', { name: '清除项目状态' })
    expect(clear.closest('.ods-select')).toBeNull()
    await user.click(clear)
    expect(trigger).toHaveTextContent('全部状态')
    expect(trigger).toHaveFocus()
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '清除项目状态' })).not.toBeInTheDocument()
  })

  it('skips controls inside hidden ancestors when leaving the menu', async () => {
    const user = userEvent.setup()
    render(
      <>
        <MultiSelect aria-label="项目状态" onValueChange={vi.fn()} options={options} />
        <div style={{ display: 'none' }}>
          <button type="button">隐藏按钮</button>
        </div>
        <fieldset disabled>
          <button type="button">禁用按钮</button>
        </fieldset>
        <button type="button">可见按钮</button>
      </>,
    )
    await user.click(screen.getByRole('button', { name: '项目状态' }))
    await user.tab()
    expect(screen.getByRole('button', { name: '可见按钮' })).toHaveFocus()
  })

  it('keeps explicit Tab destinations within the surrounding dialog', async () => {
    const user = userEvent.setup()
    render(
      <>
        <button type="button">对话框外</button>
        <div aria-modal="true" role="dialog">
          <button type="button">对话框前</button>
          <MultiSelect aria-label="项目状态" onValueChange={vi.fn()} options={options} />
          <button type="button">对话框后</button>
        </div>
      </>,
    )
    await user.click(screen.getByRole('button', { name: '项目状态' }))
    await user.tab()
    expect(screen.getByRole('button', { name: '对话框后' })).toHaveFocus()
  })

  it('provides keyboard clearing, optional content width, and the forwarded ref', async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    const ref = createRef<HTMLButtonElement>()
    render(
      <MultiSelect
        aria-label="项目状态"
        onValueChange={onValueChange}
        options={options}
        value={['active']}
        ref={ref}
        width="content"
      />,
    )
    await user.tab()
    expect(ref.current).toHaveFocus()
    expect(ref.current).toHaveAttribute('data-width', 'content')
    await user.tab()
    expect(screen.getByRole('button', { name: '清除项目状态' })).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(onValueChange).toHaveBeenCalledExactlyOnceWith([])
    expect(ref.current).toHaveFocus()
  })

  it('inherits Field label/required/error/disabled semantics and still permits clearing a required value', async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    const { rerender } = render(
      <Field.Root invalid required>
        <Field.Label>项目状态</Field.Label>
        <MultiSelect onValueChange={onValueChange} options={options} value={['active']} />
        <Field.Error>请选择至少一个状态</Field.Error>
      </Field.Root>,
    )
    const trigger = screen.getByRole('button', { name: '项目状态' })
    expect(trigger).toHaveAttribute('aria-required', 'true')
    expect(trigger).toHaveAttribute('aria-invalid', 'true')
    expect(trigger).toHaveAccessibleDescription('请选择至少一个状态 已选 1 项：进行中')
    await user.click(screen.getByRole('button', { name: '清除选中项' }))
    expect(onValueChange).toHaveBeenCalledExactlyOnceWith([])
    rerender(
      <Field.Root disabled>
        <Field.Label>项目状态</Field.Label>
        <MultiSelect onValueChange={onValueChange} options={options} value={['active']} />
      </Field.Root>,
    )
    expect(screen.getByRole('button', { name: '项目状态' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: '清除选中项' })).not.toBeInTheDocument()
  })

  it('does not change disabled options and closes an open menu when the control becomes disabled', async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    const props = { 'aria-label': '项目状态', onValueChange, options, value: ['active'] }
    const { rerender } = render(<MultiSelect {...props} />)
    await user.click(screen.getByRole('button', { name: '项目状态' }))
    await user.click(screen.getByRole('option', { name: '已归档' }))
    expect(onValueChange).not.toHaveBeenCalled()
    rerender(<MultiSelect {...props} disabled />)
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    rerender(<MultiSelect {...props} />)
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '项目状态' }))
    expect(screen.getByRole('listbox')).toBeInTheDocument()
  })

  it('closes on an outside click without taking focus from the clicked control', async () => {
    const user = userEvent.setup()
    render(<Controlled />)
    await user.click(screen.getByRole('button', { name: '项目状态' }))
    await user.click(screen.getByRole('button', { name: '后一个控件' }))
    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: '后一个控件' })).toHaveFocus()
  })
})
