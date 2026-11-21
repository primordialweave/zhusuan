# 珠算玉质图标、空态与交互动画落地方案

原方案基线 `555c2fd`，2026-11-21。实现已完成，本轮 117 文件/741 前端测试、类型检查、lint 与生产构建通过；2026-11-22 用户授权提交并发布 v1.2.0，最终浏览器复核与发行结果见 `docs/release-readiness-1.2.0.md`。下文保留原设计目标，实测范围和限制以发行验收为准。

目标：统一全站图标的**圆润通透玉质感**并加入**克制、可中断、有语义的交互动画**。同一套 SVG 玉材质按尺寸控制厚度与透光深度：小尺寸操作图标轮廓圆润、辨识清晰；Dock 图标呈现更饱满的雕玉体积；账目空态采用温润算盘/算档/玉珠造型。hover、press、selected 与真实业务结果各有准确反馈，静态工作时保持安静。

| 编号 | 任务 | 优先级 | 状态 | 依赖 |
|---|---|---|---|---|
|001|真实 empty/error 结果语义|P0 / HIGH|DONE|无|
|002|统一圆润通透玉材质与有限 registry|P1 / MEDIUM|DONE|无，可与 001 并行|
|003|图标交互动画、reduce 守卫与业务结果事件|P1 / MEDIUM|DONE|002|
|004|珠算品牌空态图形与单次入场|P2 / MEDIUM|DONE|001、002、003|
|005|逐页迁移、契约更新、验收并退出字体依赖|P1 / MEDIUM|DONE（代码/构建/741 单测通过，发行浏览器复核进行中）|前四项|

[001](001-empty-result-state.md) · [002](002-jade-svg-material.md) · [003](003-interactive-icon-motion.md) · [004](004-brand-empty-scenes.md) · [005](005-rollout-and-acceptance.md) · [图标盘点](icon-inventory.json)

## 本轮已核实的决策

- **材质与对比度**：玉质感通过圆润边角、左上柔光高光、内外明暗透光与静态下缘厚度表现，不靠全局降 opacity 或实时滤镜。图标默认按父表面语义继承/映射色阶（暗色 Primary 按钮与暗色 Dock 选中态用深墨玉前景，实心 Danger 按钮用反色前景），确保所有表面轮廓对比度 ≥3:1。
- **性能优先的 SVG 结构**：主题共享的玉质渐变收拢到应用根部单一隐藏 `<svg>` defs 表按 `tone × detail` 复用，避免列表页 50–100 个图标重复生成 `<defs>`；仅依赖局部几何的 `<mask>` 使用 `useId()`。
- **几何分层与坐标**：Featured 图标（5 Dock + `edit` + `download` + `arrow-left` + `bell`）采用独立拆层/圆润化路径，静态层与动态 part 分离，CSS 变换统一使用 `transform-box: view-box` 对齐 24×24 坐标；其余图标采用当前 registry 内的圆角描边/基本形状，原计划复用 Remix 复合填充路径未实施。`AnalyticsView` 与项目导出统一使用同一 `download` 图标。
- **交互与动效归属**：保留 Button 整体 `0.97`（160ms/100ms）、Select 140ms 及 Touch 稳定 X 规则；新 glyph 只控 glint/内部 part，不与父级叠乘 scale。Dock 替换既有 hover 为 `y-1px / scale 1.04`（200ms standard），已选中项（`aria-current="page"`）hover 保持安静。两处历史死 class `.spinning`（`DataSyncPanel`/`SettingsView`）改用 ODS `<Spinner />` 处理功能性 loading。
- **结果门控与 Reduce 守卫**：仅 `saved` 导出与真实 `clipboard` 完成触发成功勾反馈（`Snippet` 保留 1600ms 重置，导出按钮保持 800ms）；通知首次成功建立 baseline 后且未读数真实增加才摇铃。所有 WAAPI 序列在 JS 触发前必须同时检查系统 `prefers-reduced-motion` 与应用 `data-motion="reduced"`。
- **空态与语义纠偏**：先修 Token/Dictionary/Sync/通知入口的失败→伪空态分支，再播品牌空态。更正 `calendar-check`、`notification-off`、`user-unfollow` 与 `AnalyticsView` 失败态图表图标；所有 error 与 Token 创建安全提示不算盘化。
- **范围边界**：保持页面布局、密度、主题与既有入口动作不变，不扩范围改 Toast stack、场景背景、业务数据或权限模型。

## 审核里程碑

- **A（静态样张）**：6 操作 + 5 Dock + 3 空景在 `DesignSystemView` 浅/深主题、16/20/32px 及 Primary/Danger/Selected/Disabled 表面下圆润透光与对比度通过。
- **B（交互与无障碍）**：代表组件全部 mouse/keyboard/touch/系统 reduce/应用 reduce/快速反转/WAAPI 取消通过。
- **C（状态与空态语义）**：逐页真实 empty、filtered-empty、error、notice 与真实业务结果通过。
- **D（全量收口与退字体）**：`icon-inventory.json` 全量完成、ODS 契约/无障碍审计/许可证/资源体积与性能实测记录齐备后，再移除 Remix 字体依赖。各里程碑可单独评审和回退，无须一次替换整个界面。

## 共享基线、项目约定与通用验证（001–005 单一事实源）

- **仓库与技术栈**：`/Users/willxue/will/primordialweave/zhusuan`，基线提交 `555c2fd`，当前发布 `1.1.0`。React 19、TypeScript、ODS、纯 CSS（与少量轻量 WAAPI），不引入第三方动画库。组件导出入口 `frontend/src/design-system/index.ts`，样式入口 `frontend/src/design-system/components.css`。
- **既有动效令牌**：`instant 140ms`、`press 160ms`、`release 100ms`、`fast 200ms`、`page 280ms`；`--ods-ease-standard: cubic-bezier(0.2,0,0,1)`、`--ods-ease-emphasized: cubic-bezier(0.2,0.8,0.2,1)`、`--ods-ease-in-out: cubic-bezier(0.77,0,0.175,1)`。新增令牌须在 `jiangnan-mist.css` 与 `jiangnan-night.css` 成对定义，并同步 `tokens.contract.test.ts` 与 `docs/design-system/tokens.md`。
- **ODS 归属约束**：页面层只组合 ODS 公开 props/variants，禁止在页面 CSS 中重绘 `.ods-*` 或写入十六进制色值；系统 `prefers-reduced-motion: reduce` 与应用 `data-motion="reduced"` 任一有效时，新图标动态 `translate`/`scale`/`rotate` 全部取消，静态玉质厚度与透光层保留。
- **自动化验证**：在 `frontend/` 运行 `node node_modules/typescript/bin/tsc --build`、`node node_modules/eslint/bin/eslint.js src --max-warnings=0`、针对性回归测试及 `npm run test:run`。生产构建验证使用独立临时 `outDir`，避免改动用户 `dev`/`dist`；字体清理脚本按 `cwd/dist/assets` 定位。
- **浏览器视觉验收**：默认使用 Ego Lite，再补 WebKit；覆盖 `1280×800`、`760×620`（及全量验收时的 `1440×900`），浅/深两主题，mouse/keyboard/touch/双 reduce 全测。用 10% 慢放检查运动可逆性、光学对齐与叠层，再以正常速度复看；仅凭 DOM/单测不能宣布视觉通过。不操作真实账本、Keychain 或已安装应用。
- **变更红线**：只修改各计划列出的源文件与必要测试/文档；不改业务金额、日期、权限、真实配置与已公开 `v1.1.0` 标签，不在实施期间自行发版。若基线漂移，先核对实际代码再执行，不强行套用旧片段。

## 实现来源与发布验证（2026-11-22）

当前 registry 为 67 个定义，66 个描边图标和 1 个圆点填充图标；127 个 path 属性（110 个唯一路径）与 Remix 4.9.1 全部 3153 个唯一路径做数字/命令 token 规范化比较，无相同路径。Dock 路径沿用项目原自绘/原型拟合来源。没有导入 Remix 复合 SVG 路径，原复用策略未实施，字体依赖及构建清理已退出。故不按 npm 元数据盲加 Apache-2.0 声明；旧包实际 LICENSE 为 Remix Icon License v1.0，若未来引入其资源须核实际许可。

生产主 JS gzip 287.93 kB；全部 JS gzip 较 1.1.0 增加 11.9 KiB，CSS gzip 减少 17.8 KiB、woff2 资源减少 184.8 KiB，完整 dist 减少 347.6 KiB。三平台发行和浏览器/硬件验收范围独立记录，不把实现预算当目标机测量。用户本轮的明确发布指令覆盖下文原实施阶段的暂不发版边界。
