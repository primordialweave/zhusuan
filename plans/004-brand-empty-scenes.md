# 004 — 让空态采用圆润玉质珠算造型和轻量动效

- Status: DONE (branch `feat/jade-icons-motion`)
- Commit: 555c2fd
- Severity: MEDIUM
- Category: State meaning / cohesion / missed opportunities
- Scope: 新增 `EmptyScene` 与少量场景图形、`EmptyState` presentation 扩展、全站空态与错误态调用方

## 问题与当前证据

- `EmptyState.tsx:15` 默认图标为 `ri-inbox-2-line`，当前 `sm/md/lg` 为 40/48/56px 圆角底牌。
- 语义误用：`CalendarView.tsx:329` 用 `ri-calendar-check-line` 表示“该日无收款计划”；`NotificationManagement.tsx:291` 用 `ri-notification-off-line` 表示“暂无通知”；`UserManagement.tsx:275` 用 `ri-user-unfollow-line` 表示“暂无用户”。它们都不是完成、静音或取消关注。
- 错误态混用图标：`AnalyticsView.tsx:549` 与 `:629` 的两个 `loadError` 分支仍沿用 `ri-line-chart-line` / `ri-donut-chart-line`（与空态同图标）；`ProjectPicker.tsx:142`、`PaymentCreateView.tsx:225`、`SettingsView.tsx:816` 的错误态漏传图标而回落到默认 `Inbox`。
- `TokenManagement.tsx:331` 的成功创建弹窗 `ShieldKeyhole` 是安全提示，不是空态，不能算盘化。

## 场景映射与尺寸

| 场景 / 调用方 | 图形（统一圆润通透玉材质） | 尺寸 / 处理 |
|---|---|---|
| `ProjectsView` 无项目 | 端正清零的圆润玉算盘（带清晰中梁与三档归位玉珠），不拼贴多余账册框 | hero 高 96、宽 ≤144 |
| `ProjectsView` / `ProjectPicker` 筛选无结果 | 居中饱满的圆润玉放大镜 + 两侧淡玉珠，不画“已有数据” | 主区 72×≤108，弹层 40×≤60 |
| `ProjectDetail` / `PaymentPlanEditor` 无计划 | 纯粹玉算档排期轴（圆润玉帽横档 + 左侧待拨玉珠 + 两颗轻透虚位玉珠），不拼贴小日历 | 主区 hero 96，表单 standard 72 |
| `CalendarView` 当日无计划 | 无勾玉日历 + 静止玉珠 | compact 40×≤60；不挤压明细滚动 |
| `AnalyticsView` 无趋势 / 无结构 | 小算档 / 玉环，保留两图表布局 | compact 40×≤60；适配 13rem 图表区 |
| `DictionaryManagement` 无条目 / `DataSyncPanel` 真实无 compare | 薄玉账册 / 成对玉账册与算珠 | standard 72×≤108 |
| `NotificationManagement` / `NotificationEntry` 真实无消息 | 静止玉铃，去掉 off 斜杠 | 主区 72，popover 40 |
| `UserManagement` 真实无用户 / 搜索无结果 | 玉人形 / 玉放大镜 | 72；保持用户语义 |
| `TokenManagement` 真实空列表 | 玉钥匙 | 72；创建成功安全弹窗保留 `shield` |
| **所有加载失败 / 错误 / 安全提示**（含 `AnalyticsView` 两图表 `loadError`、`ProjectPicker`、`PaymentCreateView`、`SettingsView` Profile 失败） | `warning` / `wifi-off` / `key` / `shield` 原语义玉图标 | compact 40 或原 icon 尺寸；**严禁算盘归位** |

## 首轮三个核心场景的构图约束（Milestone A 静态评审）

统一 `viewBox="0 0 160 112"`，共享 `002` 圆润玉珠与玉框材质（柔光边缘 + 清透玉心 + 轻底影），静态投影椭圆中心 `(80, 102)`、`rx=54 / ry=4 / opacity=0.10`。hero 按高 96 等比例缩放，standard 72，compact 40；不改外层容器间距与 CTA 布局。

- **无项目（`projects-empty`）**：纯粹、端正的圆角玉算盘，不拼贴背景账册。外框 `x=22 y=14 w=116 h=82 rx=13`（框厚 5），**清晰带厚度与高光的中间横梁 `y=40.5 h=5.2`**，三根算档 `x=50 / 80 / 110`。饱满玉珠 `rx=8.2 ry=5.5`，上珠 `y=27.5`、下珠 `y=70.5 / 83`（中梁上下留出清零呼吸间距），不画数字或金额；下排顶行 3 颗可动。
- **无计划（`plans-empty`）**：不拼贴小日历贴纸，改用同族纯粹**玉算档排期轴**：横向温润算档 `y=53 h=4.4` 配左右圆润玉帽，三处等距节点 `x=50 / 80 / 110`，左侧 1 颗待拨实心玉珠 + 右侧 2 颗虚线轻透虚位玉珠，下方三点静默刻度，一眼传达“尚无分期节点”且与完整算盘形成清爽轮廓区分。
- **无搜索结果（`search-empty`）**：居中饱满的圆润玉环镜中心 `(74, 49) r=26`，手柄 `(92, 67) → (116, 91)` 圆角宽 `10.5`，镜面带左上月牙柔光；两侧点缀两颗淡玉珠 `(36, 34)` 与 `(126, 40)`，保证 `compact 40px` 也平衡清晰。

局部小空态按需裁减背景与珠数，不另起第二套材质或整页插画背景。

## 执行步骤

1. 依赖 `001`、`002`、`003`。新增 `frontend/src/design-system/components/empty-state/EmptyScene.tsx` 与场景样式，复用 `002` 的共享玉材质与 `JadeBead`/`Rod` 静态件。
2. **安全扩展 `EmptyState` 样式与 API**：新增显式 `scene` prop（或 `data-presentation="scene"`）用于去圆角底牌、border 与背景；既有的 `icon` prop 保留默认底牌样式，确保错误态与普通图标调用不受影响，原有 `title`/`description`/`action` 结构不变。
3. **显式语义传参**：各调用方明确传入 `scene` 或错误 `icon`，不靠解析 `title` 字符串猜测状态。为 `AnalyticsView` 两图表 `loadError`、`ProjectPicker`、`PaymentCreateView`、`SettingsView` Profile 失败补齐语义错误图标，不再落入默认 `Inbox` 或图表图标。未发现独立权限空态，不凭空制造权限逻辑。
4. **轻量单次入场与归位动效**：
   - 仅在 `001` 确认真实 empty 且可见时触发一次：整体场景 `opacity 0 → 1`（`200ms standard`）；最多 3 颗下排玉珠相对位移 `2px` 归位（`200ms emphasized(.2,.8,.2,1)`，珠间错开 `40ms`）；
   - 在 `reference.css` / `semantic.css` / `tokens.md` 新增共享 `40ms` 延迟令牌，不引入第二套缓动曲线；
   - 只动内部 scene/beads，不动整个 `EmptyState` 外框，避免与父页面 / `SettingsGroup` 既有 `280ms` 入场叠加双重位移；标题与 CTA 立即可点，不等待动画结束。
5. **重播与 Tab 切换边界**：
   - 同 empty 态后台 refresh 不 remount、不重播；仅从非 empty 转入真实 empty，或首次挂载时即为已确认 empty 播一次；
   - Tab/路由切出卸载时立即清理动画；空态切回真实数据时以 `opacity 100ms` 退出，不阻塞数据呈现；
   - hero 场景 hover 仅给 `140ms` 玉光 glint（可选单颗珠轻动 `y 1px / 200ms`），compact 无装饰位移；`cursor` 保持 `default`，不增加点击或焦点。
6. **克制与边界**：零永久漂浮/呼吸/扫光循环，不使用既有 `.ods-motion-ambient`；error 与安全 notice 仅静态或 `opacity 140ms`，不弹跳不摇晃；不把应用主 Logo 贴到每页，不把红木框扩散至小图标（仅主空态算盘允许轻木色细档，其余以青玉、淡玉白与留白呼应烟雨江南）。

## 验证与完成标准

逐页核查真实 empty、filtered-empty、error（含 `AnalyticsView` 两图表错误态）、有数据态、partial save warning 与 token created notice。Skeleton 与品牌空态不同时误出现，失败不播玉珠归位。主空态、13rem 图表区、日历侧栏、21.25rem 通知 popover、22rem 项目 picker 均无 CTA 挤压或横向溢出。浅/深两主题及双 reduce 下语义与可见性正确，单次入场与 hover 均可逆。

## 共享基线与验证

严格遵循 [plans/README.md](README.md) 中的「共享基线、项目约定与通用验证」。本任务对应 **Milestone C**。
