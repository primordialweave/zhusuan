# 003 — 加入可中断且有语义的图标交互动画

- Status: DONE (branch `feat/jade-icons-motion`)
- Commit: 555c2fd
- Severity: MEDIUM
- Category: Interruptibility / accessibility / purpose
- Scope: icon motion 样式与轻量 reaction helper、Button / RouterControls / Dock / Snippet / NotificationEntry / 两个导出入口 / `foundations/motion.css`

## 问题与当前证据

- `button.css` 中 `primary`/`secondary`/`danger` 按钮 hover 已有 `translateY(-1px)`，全部按钮 active 已有 `scale(0.97)`（160ms press / 100ms release）。
- `router-controls.css` 中 Dock link 有 `:active { transform: scale(0.98) }`、440ms 滑动高亮指示器，且当前 glyph hover 为：
```css
.ods-router-nav-link[data-appearance='dock']:hover .ods-router-nav-link__icon {
  transform: translateY(-2px) scale(1.08);
}
```
该 hover 使用 `200ms spring` 且连已选中项 `[aria-current='page']` 也会触发放大；新 SVG 必须收束动效归属，绝不叠第三层 scale。
- `NotificationEntry.tsx:113` 在首载、30s 轮询、打开菜单均调用 refresh；`useProjectExport.ts:47` 与 `AnalyticsView.tsx:432` 只有 `result.status === 'saved'` 才代表成功保存；`Snippet.tsx:27` 已有 `COPY_RESET_MS = 1600` 与真实 clipboard promise。
- `DataSyncPanel.tsx:335` 与 `SettingsView.tsx:656` 残留了无 CSS 定义的死 class `.spinning`。

## 动效矩阵（精确目标）

| 触发 | 动态对象与幅度 | 时间 / 缓动 | 约束 |
|---|---|---|---|
| 普通 hover / focus | 仅 specular `opacity 0.12 → 0.18`，geometry 不动 | `140ms standard(.2,0,0,1)` | keyboard 焦点环立即；不追加 glyph lift |
| 按钮 press / release | 父 Button 保留 `scale(0.97)`；glyph 只压暗 specular | `160ms press / 100ms release`，standard | 子 glyph 禁止再次 scale；不与父级 `hover translateY(-1px)` 打架 |
| Dock 未选中项 hover | 既有 `.ods-router-nav-link__icon` 改为 `y -1px scale(1.04)` + specular `0.22 → 0.30` | `200ms standard` | 替换既有 `y-2 / 1.08 / spring`，不叠加第二层缩放 |
| Dock 已选中项 hover | `[aria-current='page']` 保持安静（不浮起、不缩放、不转部件，至多极轻 glint） | `140ms standard` | 当前页不重复提示“可切换” |
| Dock press | link 保留 `scale(0.98)`；icon wrapper 回 `y 0 / scale 1` | `140ms standard` | pressed 胜过 hover；保留 440ms 滑动指示器 |
| 编辑 hover (`edit`) | 拆分出的笔身绕笔尖（约 `(4, 17)`，以定稿 path 为准）旋转 `-4°`，底线静止 | `200ms standard` | 单次可逆，不循环画线 |
| 下载 hover (`download`) | 拆分出的箭头 `y +1.5px`，托盘静止（项目与分析导出统一使用同一 glyph） | `200ms standard` | 移出 `100ms` 回位；仅 hover 引导，不伪装成功态 |
| 返回 hover (`arrow-left`) | 箭头 `x -1px` | `140ms standard` | 仅 fine pointer，不延迟导航 |
| 添加 / 关闭 / 删除 | 局部玉光 glint；无旋转、无弹跳 | `140ms standard` | `+` 不旋转成 `×`，danger 保持原语义色 |
| Dock 5 项内部部件（仅未选中项 hover） | `dashboard` 门框微光；`projects` 独立折页绕 `(4, 10)` 旋 `-4°`；`calendar` 底部圆润日期珠 `y +1px`；`analytics` 最高玉柱/顶珠 `y -1px`；`settings` 齿轮绕真实圆心 `(12, 12)` 旋 `+6°` | `200ms standard` | 均基于 `002` 拆层圆润路径，每次 hover 可逆，outer SVG 不再额外 scale |
| 新未读通知 (`bell`) | 铃身绕顶枢 `(12, 4)` 轻摆 `-4° → +4° → 0°` 一次 | `200ms ease-in-out(.77,0,.175,1)` | 仅在 `001` 首次成功 baseline 建立后，且 `unreadCount` 真实增加时触发 |
| 导出成功保存 (`download → check`) | check layer `opacity 0 → 1`，静态玉勾保持 `800ms` 后回原 glyph | 入 `160ms standard`，回 `140ms` | 仅 `result.status === 'saved'` 触发；`cancelled`/`downloaded` 不称 saved |
| Snippet 复制成功 (`copy → check`) | 替换 `Snippet.tsx` Unicode `✓`/`⧉` 为 `JadeIcon`，check 淡入保持 `1600ms`（沿用 `COPY_RESET_MS`）后回 copy | 入 `160ms standard`，回 `140ms` | 仅 `navigator.clipboard.writeText` fulfilled 触发，保持 `Snippet.test.tsx` 语义一致 |
| 功能性加载（同步对比 / 检测更新） | 移除死 class `.spinning`，改用 ODS `<Spinner />`（或 `Button[pending]` + `<Spinner />`） | 沿用 ODS Spinner 规范 | 属于功能性 loading，不计入装饰 infinite，且遵守 reduced-motion |

## 可动分组、坐标系与触发协议

- **统一使用 `transform-box: view-box`**：仅 featured glyph 声明内部可动 `<g data-jade-part="...">`。凡使用 `24×24` viewBox 绝对坐标作 `transform-origin`（如 `edit` 笔尖、`projects` 折页 `(4, 10)`、`settings` 齿轮 `(12, 12)`、`bell` 顶枢 `(12, 4)`），CSS 必须显式设 **`transform-box: view-box`**（**禁止**混用 `transform-box: fill-box` 导致原点按子包围盒漂移）；并在 WebKit 中 10% 慢放实测验证无偏轴。
- **业务 reaction 接口**：`JadeIcon` 接受显式 `reaction?: { kind: 'none' | 'saved' | 'copied' | 'newUnread'; eventKey: number }`。同 `eventKey` 不重播，首次 mount 无有效 key 不播；视觉组件不请求数据、不判定业务成功。
- **WAAPI 的 JS 侧 Reduced-Motion 强守卫**：CSS `@media (prefers-reduced-motion: reduce)` 与 `:root[data-motion='reduced']` 无法自动拦截 JS `element.animate(...)`。所有单次 WAAPI 序列（摇铃、成功勾微缩放）执行前必须经过统一 helper 检查：
  `window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'reduced'`。
  命中任一条件时**直接跳过 WAAPI 位移/旋转**，仅切换静态状态（如静态勾），避免 reduced-motion 漏网。
- **释放态互斥**：160ms 成功勾入场以 `opacity` 为主（仅在 pointer 触发且父 Button 已释放时允许极轻 `0.94 → 1` group scale，绝不与父 `:active scale(0.97)` 同时乘算）。保持定时器在状态变为 error、页面隐藏或 unmount 时立即 cleanup。

## 执行步骤

1. 依赖 `002`。为 featured glyph 标记内部 `data-jade-part`，其余图标仅启用 specular glint。hover / press / selected 一律用 CSS transition 实现自然可中断；单次摇铃与成功勾序列通过轻量 helper（CSS/WAAPI）实现，重播前先 `cancel()` 旧动画，结束归回静态姿态。
2. **`button.css` 与 `router-controls.css`**：
   - `button.css` 只补父子动效归属规则，不改正常 `0.97 / 160ms / 100ms` 与既有 hover 上浮；
   - `router-controls.css` 替换 Dock 未选中项 glyph hover 为 `y -1px / scale(1.04) / 200ms standard`，press 清除 glyph hover，**选中项 `[aria-current='page']` hover 禁止外层浮起与内部件旋转**；保留 link `0.98` 与 440ms 滑动指示器。
3. **输入设备与既有交互保护**：pointer hover 全部包裹在 `@media (hover: hover) and (pointer: fine)`；Touch 保持稳定目标，不改 `Select` 现有 `@media (hover: none)` 清除按钮与 140ms 交叉淡化，不叠第二个 caret/X 姿态。
4. **双 Reduce 完整对齐**：在 `icon.css`、`button.css`、`router-controls.css`、`select.css`、`accordion.css` 补齐 `:root[data-motion='reduced']` 与 `@media (prefers-reduced-motion: reduce)` 同等的 `transform: none` / `animation: none` 规则（不靠只压时长），同时保留静态玉质厚度与透光层。
5. **键盘与交互零延迟**：键盘操作、菜单 toggle、路由切换与 focus 返还立即执行；内部语义位移动画不响应 keyboard origin（在 await 前记录触发来源，不在 await 后读 `event.currentTarget`），静态选中/成功勾标识照常显示。
6. **业务接入**：
   - `NotificationEntry`：仅在 `001` 的 `baselineUserId === userId` 已建立且新 `unreadCount > prevUnreadCount` 时递增 `eventKey` 触发 `newUnread`；首载、相同 poll、读 mutation、失败、旧 generation 均不播；
   - `useProjectExport` 与 `AnalyticsView`：仅在 `result.status === 'saved'` 时触发 `saved` `eventKey`，保留既有 toast、`exporting` 状态及 error/cancel 语义，不改 CSV 生成与文件保存逻辑；
   - `Snippet`：把 `✓`/`⧉` 替换为 `JadeIcon`，仅在 clipboard fulfilled 后切换为静态玉勾并保持既有 `COPY_RESET_MS = 1600ms`。
7. **主题切换冲突隔离**：在 `frontend/src/design-system/foundations/motion.css:48-55` 同 `base` 层内，对 `:root.theme-transitioning` 排除图标动态 part（避免 `!important` 的 200ms `opacity` 过渡干扰图标高光/成功勾切换），并确保通过 `foundations.contract.test.ts:25` 的正则校验。

## 边界与完成标准

不改按钮/链接文案、点击热区、表单提交、数据更新时机、导航/focus 协议与 Toast 堆叠。完成标准：20 次快速 hover/leave 无卡姿态；press 无双重 scale；Dock 选中项 hover 安静；keyboard/touch 无额外延迟；系统 reduce 与应用 `data-motion="reduced"`（含 WAAPI）均无位移/旋转；轮询相同未读数不重播摇铃；非 `saved` 导出与失败复制不播成功勾。

## 共享基线与验证

严格遵循 [plans/README.md](README.md) 中的「共享基线、项目约定与通用验证」。本任务对应 **Milestone B**，须在 Ego Lite 与 WebKit 下做 10% 慢放可逆性与支点轴心复核。
