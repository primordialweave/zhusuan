# Components

## API 原则

- 简单组件保持单体；复杂交互使用 compound API。
- 全部使用 named exports，并转发 ref 与原生 DOM props。
- 受控/非受控状态统一为 `value/defaultValue/onValueChange` 或 `open/defaultOpen/onOpenChange`。
- variant 与 size 使用有限 union，不堆叠 `flat`、`hover`、`noPadding` 等布尔开关。
- DOM 根 class 使用 `.ods-*`，内部 anatomy 使用 `data-slot`，状态使用 `data-*`。
- `className`、`style` 和 `data-*` 是必要 escape hatch，但不允许调用方依赖内部 DOM 层级。
- icon-only 控件必须提供可访问名称；loading 保持控件宽度并设置 `aria-busy`。

复杂组件示例：

```tsx
<Dialog.Root open={open} onOpenChange={setOpen}>
  <Dialog.Trigger>打开</Dialog.Trigger>
  <Dialog.Backdrop />
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>标题</Dialog.Title>
      <Dialog.Close />
    </Dialog.Header>
    <Dialog.Body>内容</Dialog.Body>
    <Dialog.Footer>操作</Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
```

## Phase 1：当前项目核心组件

Phase 1 以真实生产用量为依据，而不是复制 HeroUI 的完整目录。

1. Actions：Button、IconButton、CloseButton。
2. Surfaces：Surface、Card compound。
3. Fields：Field、Label、Description、FieldError、Input、TextArea、NativeSelect、InputGroup、SearchField、原生 DateField。
4. Choices：Checkbox、RadioGroup。
5. Overlays：Dialog、AlertDialog。
6. Anchored overlays：Popover、Dropdown、ListBox。
7. Navigation：Tabs、SegmentedControl、Pagination。
8. Data display：Chip/StatusBadge、Table。
9. Feedback：Toast/Toaster、Alert。
10. States：EmptyState、Skeleton、Spinner。
11. Progress：ProgressBar。

## 迁移期共享组件与模式

页面迁移只从 `@/design-system` 导入公共能力，不在 view 或 feature 目录复制按钮、搜索框、空状态、页头、表单布局或分页样式。

```tsx
import {
  Button,
  FormActions,
  FormGrid,
  FormSection,
  PageHeader,
  RouterButton,
  SearchField,
} from '@/design-system'

<PageHeader
  actions={<RouterButton to="/projects/create">新建项目</RouterButton>}
  description="统一查看项目进度与回款状态。"
  title="项目"
/>

<SearchField
  onClear={() => setCurrentPage(1)}
  onValueChange={setKeyword}
  pending={loading}
  value={keyword}
/>

<FormSection title="基本信息">
  <FormGrid columns={2}>{/* Field + Input */}</FormGrid>
  <FormActions>
    <Button variant="ghost">取消</Button>
    <Button type="submit">保存</Button>
  </FormActions>
</FormSection>
```

可直接用于全站迁移的 primitives：

- `CloseButton` 组合 `IconButton`，默认提供“关闭”的可访问名称。
- `EmptyState` 统一 icon、title、description 与 action anatomy。
- `SearchField` 是受控组件，使用 `value/onValueChange`；清空时先发送空值，再调用可选 `onClear`；`pending` 会用 Spinner 替换清空按钮。
- `AlertDialog` 组合 `Modal` 与 `Button`，使用 `open/onClose/title/description/cancel/action/onAction/pending`；pending 时锁定 Escape、背景关闭与重复提交。

可直接用于全站迁移的 patterns：

- `Button` 的 `tone="danger"` 可与 `variant="ghost"` 正交组合，页面不再自行覆盖危险操作颜色。
- `Surface` 通过 `tone` 表达 accent/success/warning/danger/info 语义，业务图标块不再复制底色与边框。
- `Surface variant="glass"` 有两档密度：默认档承载内容（首页收款摘要），`density="dense"` 用于导航（Dock），更不透明、阴影更重。其他 variant 忽略 `density`。
- `RouterButton`、`RouterLink` 保留 React Router 客户端导航，并复用 ODS Button/Link variants；列表入口使用 `RouterLink appearance="row"`，由 ODS 统一 hover、pressed、focus 与 reduced-motion 行为。
- `Table.Row interactive` 统一可点击行的视觉反馈，仍由行内真实链接/按钮承担键盘语义；`Table.Column/Cell sticky="end"` 统一固定操作列的层级、背景和分隔线。
- `Table.Root variant="plain"` 用于直接画在工作面板上的台账：去掉外框和表头底色，只留横向细线（表头线用 `--ods-color-border-strong`，行线用 `--ods-color-border-default`），表头高 48、行高 64。默认 `card` 保持带框外观。
- `PageHeader` 只用于页面级 `h1`；`SectionHeader` 支持 `headingLevel={2 | 3 | 4}`。
- `FormSection`、`FormGrid`、`FormActions` 统一表单分区、响应式列和操作行。
- `PaginationBar` 组合结果信息、共享 `Pagination` 与可选 trailing control。
- `WorkSurface` 是浮在江南场景上的唯一业务面板，自己滚动内容；路由滚动恢复挂在它的 `scrollRef` 上。
- `SegmentedControl` 用于少量并列选项的单选（界面主题），语义是 `radiogroup`，支持方向键、Home、End。
- `Tabs` 的列表有四个变体：默认的 `pill`、分析页周期用的 `accent`（描边透明轨道）、字典侧栏用的 `navigation`，以及设置页用的 `underline`（一条细线上的文字标签，选中项底部一道下划条；放不下时自己横向滚动，`data-fade` 标出被遮住的一侧，选中项自动滚进可视范围）。
- `CloudPanel` 是浮在场景上的海棠角磨砂卡片（登录页、未找到页）。它不做实时模糊：页面通过局部属性 `--cloud-panel-backdrop` 交给它一张预模糊的静帧（通常 `fixed`，和页面背景同一套裁切），它在上面盖 `--ods-material-frost-veil`。`backdrop` 属性里的内容画在卡片上、内容之下，并被卡片轮廓裁切。卡片内的输入框等控件自动换成更亮的一层玻璃（`--ods-material-frost-control`）。卡片及其祖先不能有 `transform`。
- `Switch` 的 `lg` 是 48 × 28，用于设置行；关闭态轨道用 `--ods-color-border-strong`。`Button` 的 `outline` 变体支持 `tone="danger"`。
- `RouterNavLink appearance="dock"` 是底部 Dock 的导航项；`active` 用于归属路径不在自身前缀下的入口。

这些名称可以在代码中表现为较少的组件包。例如 Field 子组件共享 context 和样式，Dialog 与 AlertDialog 共享 overlay primitives。

## Phase 2 backlog

已交付（消费 ODS tokens，纯 CSS + 轻量 React 状态）：Tooltip、Avatar/AvatarGroup、User、Breadcrumbs、Divider（Separator）、ButtonGroup、Switch、Accordion、NumberInput（NumberField）、Kbd、Code、Snippet、Link、Badge、CircularProgress、ScrollShadow、Spacer、Modal、Drawer、Popover、Listbox、Select、Dropdown（Menu）、Slider、CheckboxGroup、InputOtp、Table、Image、Calendar、DatePicker。

Select 默认允许清除选中值：悬停或键盘聚焦时，右侧箭头以140ms过渡为清除按钮；触摸指针直接显示清除入口，展开列表、禁用或无选中项时不显示。清除调用 `onValueChange('')`，关闭列表并将焦点保留在主触发器。必填表单仍允许清空，由表单验证缺失值；年份、分页、权限和安全模式等必须保持有效值的控件传入 `clearable={false}`。清除按钮与主触发器为兄弟节点，避免嵌套交互。

数据首次加载及查询范围切换用 Skeleton 对应最终布局占位，支持 `text`、`rect`、`circle`、`ring` 四种形状；图表环形、表格列和表单字段保留各自结构。骨架元素本身为装饰，由加载区域提供 `aria-busy` 和命名的 `status`。同查询刷新保留已有内容，未完成的新查询不复用旧范围数字；成功或失败后结束骨架。系统或应用的减少动态偏好均停止 Skeleton 动画。

浮层组件（Modal/Drawer/Popover/Select/Dropdown/DatePicker）复用 `useDialogFocus` 焦点栈与 `createPortal`；Calendar/DatePicker 复用已有依赖 `dayjs`；Slider 用 Pointer Events 实现 1:1 跟手。

仍在 backlog（需产品用例或更重依赖，暂不硬写）：

- ToggleButton、ToggleButtonGroup、Autocomplete、ComboBox。
- DateRangePicker、TimeField、Meter、Toolbar、TagGroup。
- ColorArea、ColorField、ColorPicker、ColorSlider、ColorSwatch。
- 虚拟化 collection/table、拖拽排序和高级数据网格。

Phase 2 的复杂 collection 与颜色组件不得只为了“组件齐全”而手写。先确认产品用例，再评估 React Aria primitives、虚拟化方案和可维护成本。

## 产品模式

以下内容不应伪装成通用 primitive：

- Summary Metric、工作台收款摘要等数据叙事组件。
- TitlebarDragRegion、AppDock、NotificationEntry、JiangnanScene 等桌面壳层模式。
- PanelHeader、PageHeader、EmptyState 的品牌化组合。
- Settings 的统计头部、业务卡片和数据同步流程。

这些模式可以消费 ODS components 与 tokens，但保留在 `patterns` 或业务目录。
