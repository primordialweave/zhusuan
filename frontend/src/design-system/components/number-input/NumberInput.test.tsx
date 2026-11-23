import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { NumberInput } from './NumberInput'
import { Field } from '../field'

function Controlled() {
  const [value, setValue] = useState(3)
  return <NumberInput max={5} min={1} onValueChange={setValue} value={value} />
}

describe('NumberInput', () => {
  it('keeps the input and both step controls disabled when the surrounding Field is disabled', async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    render(
      <Field.Root disabled>
        <Field.Label>数量</Field.Label>
        <NumberInput onValueChange={onValueChange} value={3} />
      </Field.Root>,
    )
    expect(screen.getByRole('spinbutton', { name: '数量' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '增加' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '减少' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: '增加' }))
    await user.click(screen.getByRole('button', { name: '减少' }))
    expect(onValueChange).not.toHaveBeenCalled()
  })
  it('disables native completion without changing numeric input semantics', () => {
    render(<NumberInput aria-label="金额" value={3} />)

    const field = screen.getByRole('spinbutton', { name: '金额' })
    expect(field).toHaveAttribute('autocomplete', 'off')
    expect(field).toHaveAttribute('autocorrect', 'off')
    expect(field).toHaveAttribute('autocapitalize', 'off')
    expect(field).toHaveAttribute('spellcheck', 'false')
    expect(field).toHaveAttribute('writingsuggestions', 'false')
    expect(field).toHaveAttribute('inputmode', 'decimal')
    expect(field).toHaveValue(3)
  })

  it('steps within bounds via the increment and decrement buttons', async () => {
    render(<Controlled />)

    const field = screen.getByRole('spinbutton')
    await userEvent.click(screen.getByRole('button', { name: '增加' }))
    expect(field).toHaveValue(4)

    await userEvent.click(screen.getByRole('button', { name: '增加' }))
    expect(field).toHaveValue(5)
    expect(screen.getByRole('button', { name: '增加' })).toBeDisabled()
  })
})
