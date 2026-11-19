import { Input, type InputProps } from '@/design-system'
import { formatMoneyDraft, isMoneyDraft } from './money'

export interface MoneyInputProps extends Omit<InputProps, 'value' | 'onChange' | 'type'> {
  value: string
  onValueChange: (value: string) => void
}

export function MoneyInput({ value, onValueChange, onBlur, ...props }: MoneyInputProps) {
  return (
    <Input
      {...props}
      autoComplete="off"
      inputMode="decimal"
      type="text"
      value={value}
      onChange={(event) => {
        const next = event.currentTarget.value
        if (isMoneyDraft(next)) onValueChange(next)
      }}
      onBlur={(event) => {
        onValueChange(formatMoneyDraft(value))
        onBlur?.(event)
      }}
    />
  )
}
