# 002 — 建立统一圆润通透玉材质与 SVG 图标入口

- Status: DONE (branch `feat/jade-icons-motion`)
- Commit: 555c2fd
- Severity: MEDIUM
- Category: Cohesion / physicality / contrast / performance
- Scope: 新增 ODS `JadeIcon` 组件、有限 registry、共享 SVG defs、两主题色阶令牌、对比度测试、文档与组件展厅

## 问题与当前证据

`frontend/src/main.tsx:9` 引入 Remix Icon 字体，`frontend/src/components/layout/DockIcon.tsx:42` 自绘 24×24 SVG。当前按钮底面已具备温润玉质，但操作图标是扁平单色字体、Dock 图标是单色描边，两者尚未共享同一套圆润通透的玉材质：
```tsx
<svg fill="none" stroke="currentColor" strokeLinecap="round"
  strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
  {glyphs[name]}
</svg>
```

## 目标规格：圆润通透的玉质感

- **形体圆润**：自定义及拆层图标统一采用圆角端点/连接（`round` cap/join）与柔和内折角；小尺寸圆角描边保持清晰圆润的视觉重量，不堆砌锐利折角或细碎玉纹。
- **透光与体积按尺寸分层**：
  - **操作图标（16 / 18 / 20px，`detail="subtle"`）**：轮廓熟悉清晰，柔和渐变玉体 + 左上细微透光高光 + `0.5px` 静态下缘厚度，确保小字号不糊边。
  - **Dock 图标（保留现有 28–36px 尺寸，`detail="carved"`）**：更饱满的雕玉体量、`1px` 静态深度偏移、左上柔光与淡玉白透边；保留五入口语义与 `01-workbench.md` 比例，不额外套圆牌。
- **光照与通透原则**：主光源固定左上；通透感通过“微亮玉缘 → 清透玉心 → 沉稳底影”的渐变与局部镜面高光建立，**绝不降低图标整体 `opacity`，不使用 SVG filter / 实时 blur**。
- **图层上限**：普通 glyph 最多 3 个 paint layer（静态 depth / jade body / specular），Dock 最多 5 层（含可动 part）。

## 表面语境 × Tone 对比度契约（避免暗色主按钮与实心危险按钮失对比）

实查 `frontend/src/design-system/tokens/themes/jiangnan-night.css:31-68` 与 `frontend/src/design-system/components/button/button.css:64-211`：暗色下 Primary 按钮（`--ods-gradient-glow`）和 Dock 选中态（`--ods-gradient-nav-selected`）是**浅绿玉底 + 深墨前景色 `--ods-color-accent-fg`**，而实心 Danger 按钮是**红底 + `--ods-color-fg-inverse`**。若所有图标写死 `--ods-color-accent-text`，暗色主按钮/选中 Dock 会降到 ~1.4:1，实心 Danger 会 1:1 不可见。

因此组件 `tone` 定义为 `'inherit' | 'jade' | 'inverse' | 'muted' | 'success' | 'warning' | 'danger' | 'ink'`（默认 `'inherit'`），并建立如下表面映射（全部通过两主题语义令牌表达，组件内不写主题分支）：

| 所在表面 / 语境 | 推荐 tone / 驱动方式 | 主体色阶（body / depth） | 对比度底线 |
|---|---|---|---|
| 默认普通容器、Ghost/Secondary/Outline/Disabled 按钮、行链接、表格辅助图标 | `inherit`（默认） | 跟随父级 `currentColor`（可通过容器 CSS 变量覆盖），浅色配微深底影、暗色配低明度底影，自动响应 hover/disabled | ≥3:1（禁用态沿用父级 `0.58`） |
| 品牌强调区、Tertiary 按钮、Dock 未选中态、展厅主玉展示 | `jade` | 浅色：`--ods-color-accent-text` + `--ods-color-fg-default`；暗色：`--ods-color-accent-text` + `--ods-color-bg-canvas` | ≥4.5:1 |
| Primary 实心玉按钮、Dock 已选中态（`aria-current="page"`） | `inherit`（父级已设 `--ods-color-accent-fg`）或容器覆盖为深玉墨 | 浅/暗两主题均走深墨玉（`--ods-color-accent-fg` 族）配淡玉白微高光，严禁在暗色浅绿底上用 `--ods-color-accent-text` | ≥4.5:1 |
| 实心 `variant="danger"` 按钮、深色品牌卡片（`brand-surface`） | `inherit` / `inverse` | 浅色白玉高光（`--ods-color-fg-inverse`），暗色深墨底影，不把红色 body 叠在红底上 | ≥4.5:1 |
| 状态语义图标（Alert / Chip / Toast / Outline Danger / Ghost Danger） | `success` / `warning` / `danger` / `info` | 沿对应 `--ods-color-status-*` 语义色，depth 与当前主题 depth 混色，不强制全绿 | ≥3:1（文字旁 ≥4.5:1） |
| 系统窗口控制按钮与第三方品牌图形 | `ink` | 保留原系统几何与纯色识别，无雕玉厚度 | 沿用系统对比度 |

## 样张初始材质数值（Milestone A 评审后统一冻结）

- SVG 统一 `viewBox="0 0 24 24"`；静态深度层 `subtle` 为 `y+0.5px / opacity 0.22`，`carved`（Dock）为 `y+1px / opacity 0.24`。静态厚度不是运动，reduced-motion 时保留。
- 主体线性渐变（左上到右下 `x1="12%" y1="8%" x2="88%" y2="94%"`），stop `0% / 32% / 76% / 100%` 依次为 `edge`（玉白微透亮边）→ `body` → `body` → `depth`（沉稳玉底）；specular 固定左上 `0% opacity 0.24 → 56% opacity 0`，默认不移动光源。
- 浅色（烟雨）：`jade` edge 为 body 与玉白 60/40 混色，specular `rgba(255, 255, 239, 0.48)`；暗色（夜雨）：`jade` edge 为 body 与玉白 80/20 混色，specular `rgba(230, 245, 220, 0.20)`，提亮玉缘但不造刺眼纯白反光。
- `subtle` 静态 specular `opacity 0.12`，`carved` 为 `0.22`；hover 按 `003` 分别抬至 `0.18` / `0.30`。小 glyph 评审若对比度不足，优先压低 edge 提亮占比或加深 body，不得靠叠双层 stroke 补救。
- **WebKit 兼容性红线**：SVG `<stop>` 必须通过 CSS `stop-color: var(--ods-icon-...)` 赋值，**禁止**写进 XML presentation attribute `stopColor="var(...)"`。若 `inherit` 模式下 WebKit 对 `<stop>` 内的 `color-mix(in srgb, currentColor ...)` 存在兼容瑕疵，则改为在父控件（Button/Dock/Chip）通过 CSS 变量传入预计算语义 token。

## 几何分层与性能设计

1. **共享 `<defs>` 降 DOM 开销**：在应用壳层（ODS 根部 Provider 或 `App` 内）挂载一个隐藏的 `<svg aria-hidden="true" width="0" height="0" className="ods-jade-icon-defs">`，集中声明按 `tone × detail` 划分的固定静态材质渐变 ID，供整页几十上百个列表/表格图标复用，避免每个实例都重复输出 `<defs>` 造成 DOM 膨胀。仅在某个图标需要依赖局部几何的 `<mask>` 时，才用 React `useId()` 生成唯一 ID。
2. **明确两类路径策略（与 `003` 对齐）**：
   - **Featured 图标（自定义/拆层圆润路径）**：5 个 Dock 图标（`dashboard`、`projects`、`calendar`、`analytics`、`settings`）+ `edit` + `download`（同时统一项目导出的 `ri-download-2-line` 与分析导出的 `ri-download-line`）+ `arrow-left` + `bell`。从设计之初就把静态底座与可动 part 分离到独立 `<g>`，统一圆润导角与精准旋转支点。
   - **Standard 图标（精选静态路径）**：按 `icon-inventory.json` 收录当前生产实际使用的有限 `IconName`；实际实现使用 registry 内的圆角描边与基本形状，没有导入 Remix Icon 复合填充路径；三圆点图形使用 `fill`，其余按 `stroke` 渲染，通过共享玉质渐变与左上柔光获得一致的圆润通透感。不用全量 sprite 或 runtime `innerHTML`。

## 执行步骤

1. 新增 `frontend/src/design-system/components/icon/{JadeIcon.tsx,JadeIconDefs.tsx,icon.css,index.ts,registry.tsx}`；从 `design-system/index.ts` 导出，在 `components.css` 引入样式，并在应用根部挂载 `<JadeIconDefs />`。
2. 在 `jiangnan-mist.css` 与 `jiangnan-night.css` 成对定义新增图标玉材质语义令牌，同步更新 `tokens.contract.test.ts`、`contrast.test.ts`（新增各表面图标色阶对比度断言）和 `docs/design-system/tokens.md`。
3. 收敛组件 API 为：`name`、`size`（支持 `1em` 默认与标准尺寸档）、`tone`（默认 `'inherit'`）、`detail`（`'subtle' | 'carved'`）、`motionPreset`、`reaction`（`003` 接入）。组件默认纯展示，不请求数据。
4. 在 `DesignSystemView` 新增图标样张区，覆盖 **6 操作（`edit`/`download`/`add`/`arrow-left`/`close`/`search`）+ 5 Dock**，并排展示 `16/20/32px`、浅/深两主题，以及 **Primary / Secondary / Danger / Ghost / Disabled / Dock Selected** 六种真实表面。**Milestone A 静态样张评审通过后再进入 `003` 与批量迁移。**

## 边界与完成标准

不改应用 PNG 图标/字标、页面布局、文案与点击热区；保留窗口控制与第三方品牌识别几何。Remix 字体保留至 `005` 收口。完成标准：6 操作 + 5 Dock 在浅/深两主题及所有按钮/Dock 表面下圆润通透、对齐精准、对比度达标（`contrast.test.ts` 通过），列表重复渲染无 ID 串色与 `<defs>` 膨胀。

## 共享基线与验证

严格遵循 [plans/README.md](README.md) 中的「共享基线、项目约定与通用验证」。本任务重点验证 WebKit 与 Ego Lite 下的 `<stop>` 渐变渲染、暗色主按钮/选中 Dock/实心 Danger 对比度以及 16px 边缘清晰度。
