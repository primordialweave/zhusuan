import { createRef, useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Select } from './Select'
import { Field } from '../field'

const options = [
  { label: '按月', value: 'monthly' },
  { label: '按季', value: 'quarterly' },
  { label: '按年', value: 'yearly' },
]

function Controlled({ initialValue }: { initialValue?: string }) {
  const [value, setValue] = useState(initialValue)
  return <Select aria-label="结算周期" onValueChange={setValue} options={options} value={value} />
}

describe('Select', () => {
  it('clears a selected option without opening the list and keeps focus on the trigger', async () => {
    const user = userEvent.setup()
    render(<Controlled initialValue="quarterly" />)
    const trigger = screen.getByRole('button', { name: '结算周期' })

    await user.hover(trigger)
    const clear = screen.getByRole('button', { name: '清除结算周期' })
    expect(clear.closest('.ods-select')).toBeNull()
    await user.click(clear)

    expect(trigger).toHaveTextContent('请选择')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(trigger).toHaveFocus()
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '清除结算周期' })).not.toBeInTheDocument()

    await user.click(trigger)
    await user.click(screen.getByRole('option', { name: '按月' }))
    expect(trigger).toHaveTextContent('按月')
  })

  it('offers keyboard clearing and preserves the forwarded trigger ref', async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    const ref = createRef<HTMLButtonElement>()
    render(
      <Select
        aria-label="结算周期"
        onValueChange={onValueChange}
        options={options}
        ref={ref}
        value="monthly"
      />,
    )

    await user.tab()
    expect(ref.current).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: '清除结算周期' })).toHaveFocus()
    await user.keyboard('{Enter}')

    expect(onValueChange).toHaveBeenCalledExactlyOnceWith('')
    expect(ref.current).toHaveFocus()
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('keeps clearing unavailable while choosing, when disabled, or when explicitly fixed', async () => {
    const user = userEvent.setup()
    const props = { 'aria-label': '结算周期', onValueChange: vi.fn(), options, value: 'monthly' }
    const { rerender } = render(<Select {...props} />)

    await user.click(screen.getByRole('button', { name: '结算周期' }))
    expect(screen.queryByRole('button', { name: '清除结算周期' })).not.toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.getByRole('button', { name: '清除结算周期' })).toBeInTheDocument()

    rerender(<Select {...props} disabled />)
    expect(screen.queryByRole('button', { name: '清除结算周期' })).not.toBeInTheDocument()
    rerender(<Select {...props} clearable={false} />)
    expect(screen.queryByRole('button', { name: '清除结算周期' })).not.toBeInTheDocument()
  })

  it('allows a required form value to be cleared while retaining required semantics', async () => {
    const onValueChange = vi.fn()
    render(
      <Field.Root required>
        <Field.Label>结算周期</Field.Label>
        <Select
          aria-label="结算周期"
          onValueChange={onValueChange}
          options={options}
          value="monthly"
        />
      </Field.Root>,
    )

    await userEvent.click(screen.getByRole('button', { name: '清除结算周期' }))
    expect(onValueChange).toHaveBeenCalledExactlyOnceWith('')
    expect(screen.getByRole('button', { name: '结算周期' })).toHaveAttribute(
      'aria-required',
      'true',
    )
  })

  it('opens the listbox and selects an option', async () => {
    render(<Controlled />)
    const trigger = screen.getByRole('button', { name: '结算周期' })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(trigger).toHaveAttribute('aria-haspopup', 'listbox')

    await userEvent.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getAllByRole('listbox')).toHaveLength(1)

    await userEvent.click(screen.getByRole('option', { name: '按季' }))
    expect(trigger).toHaveTextContent('按季')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(trigger).toHaveFocus()
  })

  it('inherits label, required, and invalid semantics from Field', async () => {
    render(
      <Field.Root invalid required>
        <Field.Label>结算方式</Field.Label>
        <Select onValueChange={() => undefined} options={options} />
        <Field.Error>请选择结算方式</Field.Error>
      </Field.Root>,
    )

    const trigger = screen.getByRole('button', { name: '结算方式' })
    expect(trigger).toHaveAttribute('aria-required', 'true')
    expect(trigger).toHaveAttribute('aria-invalid', 'true')
    expect(trigger).toHaveAccessibleDescription('请选择结算方式')
    await userEvent.click(screen.getByText('结算方式'))
    expect(screen.getByRole('option', { name: '按月' })).toHaveFocus()
  })

  it('focuses the selected option, or the first enabled option when empty', async () => {
    const { rerender } = render(
      <Select
        aria-label="结算周期"
        onValueChange={() => undefined}
        options={options}
        value="quarterly"
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: '结算周期' }))
    expect(screen.getByRole('option', { name: '按季' })).toHaveFocus()

    await userEvent.keyboard('{Escape}')
    rerender(<Select aria-label="结算周期" onValueChange={() => undefined} options={options} />)
    await userEvent.click(screen.getByRole('button', { name: '结算周期' }))
    expect(screen.getByRole('option', { name: '按月' })).toHaveFocus()
  })

  it('supports content-width triggers and option popovers', async () => {
    render(
      <Select
        aria-label="每页条数"
        onValueChange={() => undefined}
        options={options}
        value="monthly"
        width="content"
      />,
    )

    const trigger = screen.getByRole('button', { name: '每页条数' })
    expect(trigger).toHaveAttribute('data-width', 'content')

    await userEvent.click(trigger)
    expect(screen.getByRole('listbox').closest('.ods-select__popover')).toHaveAttribute(
      'data-width',
      'content',
    )
  })
})
