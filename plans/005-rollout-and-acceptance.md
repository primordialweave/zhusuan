# 005 — 分批迁移、契约同步、验收并退出字体依赖

- Status: DONE (implemented; 746 tests/build/lint passed; 128 browser layouts and scoped interactions passed; v1.2.0 published and artifacts verified)
- Commit: 555c2fd
- Severity: MEDIUM
- Category: Coverage / performance / contract / release boundary
- Scope: 全站生产 glyph 调用方、展厅、ODS 契约与无障碍测试、许可证文档与构建清理；不动后端

## 当前范围

仓库普通 glyph 由 Remix Icon 字体提供，Dock 5 图为自绘 SVG，EmptyState 遍布项目、表单、图表、设置与弹层，另有 `SummaryMetric` 字符串图标 API、`Snippet` 文本复制符以及 `DataSyncPanel`/`SettingsView` 两处死 class `.spinning`。不能只换 Dock 或默认 EmptyState 就宣布全界面完成。

## 执行步骤：分批迁移顺序

1. **Milestone A（静态基建与样张）**：完成 `001` 状态语义与 `002` 共享玉材质基建；在 `DesignSystemView` 提交 11 图标静态样张 + 3 核心空景样张（`projects` / `paymentPlan` / `search`），覆盖 `16/20/32px`、浅/深主题与 Primary/Danger/Selected/Disabled 表面，确认圆润通透感与对比度后再推进动效。
2. **Milestone B（高使用度交互批次）**：接 `003`，先替换项目详情编辑/导出、`AnalyticsView` 导出（统一为同一 `download` 玉图标）、`Snippet` 复制按钮、`Select` 及 5 Dock。验证可中断性、WAAPI 双 reduce 与轴心对齐后再向其他页面扩散；动效参数集中在 ODS，不散落到页面 CSS。
3. **Milestone C（全站空态与错误态统一）**：接 `004`，逐页替换所有 `EmptyState` 场景，明确区分 `success-empty`、`no-results`、`error`、`notice`（含修正 `AnalyticsView` 两图表 `loadError` 图标）。首页 80–109px `PaymentSummary` 收款胶囊保留原环与简短文案，不塞大算盘。
4. **其余页面全量收口**：项目列表/表单 → 日历/分析 → 设置/通知/同步/Token（将 `DataSyncPanel.tsx:335` 与 `SettingsView.tsx:656` 的死 class `.spinning` 改用 ODS `<Spinner />`）→ 登录/404/ODS 内置图标（`Pagination`、`Calendar`、`Accordion`、`Toaster`、`DatePicker`、`CloseButton`、`SearchField`、`SummaryMetric`）。系统窗口控制与第三方品牌图形保留原识别几何（`ink` 模式）。
5. **以盘点清单驱动收口**：逐文件更新 [icon-inventory.json](icon-inventory.json) 状态；手工展开并核查 `SettingsView.tsx` 与 `DataSyncPanel.tsx` 的动态图标映射，禁止对未知 `IconName` 静默 fallback 掩盖缺口。
6. **退出 Remix Icon 前的必清清单（缺一不可）**：
   - **无障碍守门更新**：同步更新 `frontend/src/accessibility/iconOnlyButtons.test.ts:91-96`，使 AST 检查除 `<i>`/`<svg>` 外同样识别 `<JadeIcon />`，防止纯图标按钮缺 `aria-label` 的自动审计失效；
   - **`SummaryMetric` 公开 API 收口**：将 `frontend/src/design-system/patterns/summary-metric/SummaryMetric.tsx:20` 的 `icon?: ReactNode | string` 收口为 `ReactNode`（或显式 `IconName` 映射），并同步更新 `SummaryMetric.test.tsx`；
   - **基础样式与单测断言同步**：移除 `frontend/src/design-system/foundations/typography.css:83-91` 的 `[class^='ri-']` 规则，更新 `foundations.contract.test.ts:46-53`、`pagination.test.tsx:42`（`i[class^="ri-"]` 断言）以及 `Button` / `EmptyState` / `RouterControls` / `SectionHeader` / `DataList` 测试夹具中的 `ri-*`；
   - **许可证归档**：核对实际几何来源和许可。最终实现未复用 Remix 路径，保留 MiSans 许可；不得只按 npm 的 Apache-2.0 元数据替代旧包实际 Remix Icon License v1.0（来源核查见 README）；
   - **字体与构建脚本退出**：确认生产代码与测试均无 `ri-*` 引用后，再移除 `frontend/src/main.tsx:9` 的 Remix CSS 导入、`frontend/package.json` 的 `cleanup-remixicon-assets.mjs` 构建步骤与该脚本本身；实际自绘路径来源已核实后，再卸载 `remixicon` npm 依赖。

## 验证与完成标准：硬验收

- **功能与无障碍**：图标语义、`aria-label`、热区、快捷键、导航与 focus 返还全部保持；`iconOnlyButtons.test.ts` 覆盖 `<JadeIcon />`；业务数据、金额、日期、权限、CSV 导出与文件保存不改。
- **视觉与对比度**：小尺寸圆润清晰、大尺寸通透饱满；浅/深两主题及 Primary/Danger/Selected/Disabled 全表面轮廓对比度 ≥3:1（`contrast.test.ts` 通过）；共享 `<defs>` 复用正常，列表页无 ID 串色与 DOM 膨胀；暗色无刺眼纯白边或糊黑底。
- **交互与 Reduce**：20 次快速 hover/leave、快速 press、keyboard 切 Tab、touch 均无延迟、无卡态、无双重 scale；Dock 选中项 hover 安静；系统与 app `data-motion="reduced"` 下 CSS 与 WAAPI 动态均清零，静态厚度保留；首载、轮询相同结果、失败、旧请求无假摇铃或假成功勾。
- **渲染复核**：Ego Lite 与 WebKit 逐页检查 `1280×800` / `760×620` / `1440×900`，先正常速度再 10% 慢放，等有限动画结束后截稳定图，结合事件回归验收可逆性。
- **性能与体积预算（待实测记录，不作为预设结论）**：
  - 新增 idle `rAF` / `setInterval` = 0，装饰 `infinite` = 0，默认 `will-change` = 0；新增动画仅触及 `transform` / `opacity`，不每帧触发布局、全局 CSS 变量或滤镜；
  - prototype（Milestone A/B）新增 gzip JS ≤ 8KiB，全 registry + empty scenes 新增 gzip ≤ 20KiB；移除 Remix 字体后总首屏资产体积不高于迁移前基线；
  - 注意 `frontend/src/router/routes.tsx:8` 当前静态导入 `DesignSystemView`，测量与优化主包增量时须确认展厅样张不撑爆预算（必要时对展厅路由按需懒加载）；
  - 浏览器 Performance timeline 新动效无 forced synchronous layout、主工作页无新增 long task，目标机真实交互无可见掉帧；性能预算与实机测量分开记录，不以 headless 或后台帧率作结论。

## 交付与回退

每批交付变更清单、同主题 before/after 截图、事件回归、性能/包体记录。全部通过新组件接入，可按批独立回退，保留既有 API 与数据逻辑。本轮仅限计划与后续分批实施，不部署、不发版、不改已公开 `v1.1.0` 标签；全量收口并完成每页视觉与性能记录后，再执行最后一步字体退出。

## 共享基线与验证

严格遵循 [plans/README.md](README.md) 中的「共享基线、项目约定与通用验证」。本任务对应 **Milestone D**。

## 本次执行状态

2026-11-22 用户已授权提交并公开 v1.2.0，覆盖原方案阶段的暂不发版限制。代码、契约、746 前端测试、lint 和生产构建通过；包体实测和来源核查已完成。浏览器 128 布局组合/交互已通过，未做 10% 慢放与硬件验收；CI、三平台附件与匿名更新验证见 `docs/release-readiness-1.2.0.md`。原性能/硬件/慢放目标保留为目标，不以未执行项目作完成声明。
