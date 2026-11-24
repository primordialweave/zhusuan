import {
  Button,
  DatePicker,
  EmptyScene,
  EmptyState,
  Field,
  FormGrid,
  FormSection,
  JadeIcon,
  Select,
  Surface,
  TextArea,
  type SelectOption,
} from '@/design-system'
import type { ReactNode } from 'react'
import dayjs from 'dayjs'
import { createPaymentPlanItem, isReceivedPayment, type PaymentPlanItem } from './paymentPlan'
import { MoneyInput } from './MoneyInput'
import type { PaymentPlanErrors } from './formValidation'
import { PaymentStatusChip } from './ProjectStatusChip'

export interface PaymentPlanEditorProps {
  className?: string
  description?: ReactNode
  installment?: boolean
  errors?: PaymentPlanErrors
  items: PaymentPlanItem[]
  onItemsChange: (items: PaymentPlanItem[]) => void
  stageOptions?: SelectOption[]
  title?: ReactNode
}

const defaultStageOptions: SelectOption[] = [
  { label: '收款', value: 'receipt' },
  { label: '全款', value: 'all' },
  { label: '预付款', value: 'deposit' },
  { label: '进度款', value: 'progress' },
  { label: '阶段款', value: 'milestone' },
  { label: '尾款', value: 'final' },
]
const methodOptions: SelectOption[] = [
  { label: '银行转账', value: 'bank_transfer' },
  { label: '支付宝', value: 'alipay' },
  { label: '微信', value: 'wechat' },
  { label: '现金', value: 'cash' },
]
const withSavedOption = (options: SelectOption[], value: string) =>
  value && !options.some((option) => option.value === value)
    ? [...options, { label: value, value }]
    : options

export function PaymentPlanEditor({
  className,
  description,
  errors = {},
  items,
  onItemsChange,
  stageOptions = defaultStageOptions,
  title = '收款记录',
}: PaymentPlanEditorProps) {
  const updateItem = (index: number, patch: Partial<PaymentPlanItem>) =>
    onItemsChange(
      items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    )
  const addItem = () => onItemsChange([...items, createPaymentPlanItem()])
  const addButton = (
    <Button onClick={addItem} size="sm" type="button">
      <JadeIcon name="add" size="1em" />
      添加收款
    </Button>
  )
  return (
    <FormSection
      actions={items.length ? addButton : undefined}
      className={['payment-plan-editor', className].filter(Boolean).join(' ')}
      description={description}
      title={title}
    >
      {items.length === 0 ? (
        <EmptyState
          action={addButton}
          scene={<EmptyScene name="plans-empty" size="standard" />}
          size="md"
          title="暂无收款记录"
        />
      ) : (
        <div className="payment-plan-editor__list">
          {items.map((item, index) => {
            const received = isReceivedPayment(item.status)
            return (
              <Surface
                aria-label={`第 ${index + 1} 笔收款`}
                className="payment-plan-editor__item"
                focusWithin
                key={item.clientKey}
                padding="md"
                role="group"
                variant="inset"
              >
                <div className="payment-plan-editor__item-header">
                  <span className="payment-plan-editor__sequence">第 {index + 1} 笔</span>
                  {!received ? <PaymentStatusChip status={item.status} /> : null}
                  {!received ? (
                    <Button
                      onClick={() =>
                        updateItem(index, {
                          status: 'confirmed',
                          actualDate: dayjs().format('YYYY-MM-DD'),
                        })
                      }
                      size="sm"
                      type="button"
                      variant="secondary"
                    >
                      登记到账
                    </Button>
                  ) : null}
                  <Button
                    aria-label={`删除第 ${index + 1} 笔收款`}
                    onClick={() =>
                      onItemsChange(items.filter((_, itemIndex) => itemIndex !== index))
                    }
                    size="sm"
                    tone="danger"
                    type="button"
                    variant="tertiary"
                  >
                    <JadeIcon name="trash" size="1em" />
                    删除
                  </Button>
                </div>
                <FormGrid columns={2}>
                  <Field.Root required invalid={Boolean(errors[item.clientKey]?.amount)}>
                    <Field.Label>收款金额 (¥)</Field.Label>
                    <MoneyInput
                      autoCapitalize="off"
                      autoComplete="off"
                      autoCorrect="off"
                      onValueChange={(amount) => updateItem(index, { amount })}
                      placeholder="0.00"
                      spellCheck={false}
                      value={item.amount}
                    />
                    {errors[item.clientKey]?.amount ? (
                      <Field.Error>{errors[item.clientKey]?.amount}</Field.Error>
                    ) : null}
                  </Field.Root>
                  {received ? (
                    <Field.Root required invalid={Boolean(errors[item.clientKey]?.actualDate)}>
                      <Field.Label>实际到账日期</Field.Label>
                      <DatePicker
                        aria-label="实际到账日期"
                        onValueChange={(actualDate) => updateItem(index, { actualDate })}
                        placeholder={item.id ? '日期未记录' : '请选择实际到账日期'}
                        value={item.actualDate}
                      />
                      {errors[item.clientKey]?.actualDate ? (
                        <Field.Error>{errors[item.clientKey]?.actualDate}</Field.Error>
                      ) : null}
                    </Field.Root>
                  ) : (
                    <Field.Root required invalid={Boolean(errors[item.clientKey]?.planDate)}>
                      <Field.Label>历史计划日期</Field.Label>
                      <DatePicker
                        aria-label="历史计划日期"
                        onValueChange={(planDate) => updateItem(index, { planDate })}
                        placeholder="日期未记录"
                        value={item.planDate}
                      />
                      {errors[item.clientKey]?.planDate ? (
                        <Field.Error>{errors[item.clientKey]?.planDate}</Field.Error>
                      ) : null}
                    </Field.Root>
                  )}
                  <Field.Root required invalid={Boolean(errors[item.clientKey]?.method)}>
                    <Field.Label>收款方式</Field.Label>
                    <Select
                      aria-label="收款方式"
                      clearable={false}
                      onValueChange={(method) => updateItem(index, { method })}
                      options={withSavedOption(methodOptions, item.method)}
                      value={item.method}
                    />
                    {errors[item.clientKey]?.method ? (
                      <Field.Error>{errors[item.clientKey]?.method}</Field.Error>
                    ) : null}
                  </Field.Root>
                  <Field.Root>
                    <Field.Label>收款分类</Field.Label>
                    <Select
                      aria-label="收款分类"
                      onValueChange={(stage) => updateItem(index, { stage })}
                      options={withSavedOption(stageOptions, item.stage)}
                      placeholder="选择分类"
                      value={item.stage}
                    />
                  </Field.Root>
                  <Field.Root className="payment-plan-editor__remark">
                    <Field.Label>备注</Field.Label>
                    <TextArea
                      autoCapitalize="off"
                      autoComplete="off"
                      autoCorrect="off"
                      onChange={(event) => updateItem(index, { remark: event.currentTarget.value })}
                      placeholder="请输入备注信息（选填）"
                      rows={2}
                      spellCheck={false}
                      value={item.remark}
                    />
                  </Field.Root>
                </FormGrid>
              </Surface>
            )
          })}
        </div>
      )}
    </FormSection>
  )
}
