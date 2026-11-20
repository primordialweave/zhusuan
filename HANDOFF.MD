# HANDOFF

接手任何任务前先读这份文档。它只记两类东西：**当前在制品的状态**，和**已经踩过的坑**。踩到新坑就追加到第 2 节，状态变了就改第 1 节。

## 1. 当前任务：1.0.2 发布、依赖 PR 更新与分支清理

- 用户本轮明确授权发版、清PR更新依赖、最后清分支；覆盖上轮暂不发布限制。先发布1.0.2（当前Windows普通启动修复和透明胶囊标题栏），依赖升级单独在后续main合入，不改变已发布标签。
- 1.0.2北京时间2026-11-20 10:06:23已公开latest，应用tag9b01a8dd1fb626dc2f15fbfa415921b00ed8723f，Release44657027033全部job通过，十附件/匿名manifest/下载200和旧1.0.0/1.0.1不可变性验证完成。首轮44654031499发现窗口actionPending吞点击，PR31改串行queue+4稳定回归；仅未公开候选tag更新，旧候选本地archive保留。依赖升级未纳入该发行。
- 已切codex/dependency-refresh并实施前端、Go/Wails3.1、Actions最新兼容稳定依赖升级；依赖改动不影响1.0.2tag。分支只删已合并或可证明已取代的分支，未合并独有提交保留；本地design-qa.md删除及root node_modules保持，不纳入任务提交。

## 1.1 珠算 1.0.1 已正式发布

- 原会话用户选择发布1.0.1，本会话已接续完成。北京时间2026-11-20 02:34:19公开并设latest：https://github.com/primordialweave/zhusuan/releases/tag/v1.0.1 。应用标签固定于 `176c9780dbcfb0932370e9c98d5c5e7a9eb08d3a`；1.0.0十附件名称/大小/SHA256均保持原样。
- 已完成两架构DMG/ZIP、macOS中文名和无外板图标、Windows UTF-8中文/用户默认目录/显式路径与旧Orange保留、金额输入/必填校验、令牌/通知弹层；另修真实下载取消EOF竞态。项目详情medicine→医学及小天平青绿已实际回归。
- 最终mainCI44569458459四job通过；Windows/Linux产物来自Release44571413947各自全过job，Mac原job因hosted arm64容量不足未取得runner取消；Mac使用IntelCheck44583607176全过job，同应用tag、仅3份测试夹具来源93f59779（断言保留、慢机等待优化）。不要称原Release整run全绿。
- 前端115文件598例，Go全量race140顶层156子测试/16包、vet/增量lint0，Python31例、最新版actionlint通过。Windows原生完整安装升级smoke通过；Mac正式两DMG/ZIP本地挂载/签名/版本/架构/catalog/原生图标复验通过。十附件本地/远端大小与SHA256、匿名latest manifest与全部下载HEAD200验证完成。
- 最终证据与性能/签名/原生窗口限制见 `docs/release-readiness-1.0.1.md`，公开后机器验收见 `docs/release-verification-1.0.1.json`。自有3466/9331与ego space8已关闭，真实账本/已安装应用/用户dev服务未改；原design-qa.md删除及root node_modules未纳入提交。

## 1.1 珠算 1.0.0 已正式发布

- 2026-11-19 用户明确授权“正式发布 1.0 版本”，按已选语义版本 1.0.0 执行，取代之前暂不合并/发布要求。分支 codex/zhusuan-migration，PR #2 合并到 main 后创建 v1.0.0，跟进三个平台完整发布。
- 文档、版本、九张脱敏截图和全局审查修复已完成；最终检查/限制见 docs/release-readiness.md，坑见 2.7。金额保持源快照数值，真实账本未修改。
- 2026-11-19 12:39:34 UTC 已公开v1.0.0并设latest：https://github.com/primordialweave/zhusuan/releases/tag/v1.0.0 。七附件远端大小/服务端SHA256与本地一致，匿名latest update.json/SHA256SUMS和全部下载入口200验证。应用源码/标签保持c3af8fe；macOS仅ad-hoc、Windows未Authenticode。

## 1.1 历史任务：烟雨江南界面重构

- 分支 `feat/misty-jiangnan-ui`，从 `codex/dashboard-visual-primitives` 切出。切分支前工作区已有 84 个未提交改动，快照存在 `refs/backup/pre-jiangnan-ui`，用 `git diff refs/backup/pre-jiangnan-ui` 可以只看本次重构的改动。
- 规范 `docs/ORANGE_DESIGN_SYSTEM.md`，原型 `docs/prototypes/01…07`。**工作台按原型完全还原**，其余页面参考原型并按现有能力适配。
- 进度见下面的清单，每完成一项就更新。

### 进度

- [x] 新建分支，快照旧工作区
- [x] 规范文档改写到 React/ODS 架构（`docs/ORANGE_DESIGN_SYSTEM.md` v1.1）
- [x] 两套主题令牌 `jiangnan-mist`（烟雨）/`jiangnan-night`（夜雨），对比度测试 `tokens/contrast.test.ts`
- [x] 应用壳：`AppLayout`、常驻 `AppDock`、`NotificationEntry`、`WorkSurface`，旧顶栏和鼠标追光已删除
- [x] 首页：`JiangnanScene`（静帧 + WebGL2 水面/柳枝 + Canvas 2D 雨）、`PaymentSummary`
- [x] 外观偏好 `stores/appearance.ts`；「减少动态效果」已接入 `useReducedMotion`、主题切换和 `foundations/motion.css`
- [x] 壳层重构后过期的测试已重写，`tsc` 与全量 vitest 通过（104 个文件，452 个用例）
- [x] 原型规格提取完毕，已搬进仓库 `docs/prototypes/specs/`（01 工作台、02-03 项目与日历、04-05 分析与设置、06-07 登录与 404）。数值都以 1487×1058 的原型像素为基准
- [x] Dock 五个图标从原型像素拟合成 24 单位网格的 SVG 路径，数据在 `docs/prototypes/specs/dock-icons.json`（拟合脚本在 `/tmp/orange-resume/work/`，丢了不必重做）
- [x] 浅色令牌按原型重调：正文色 `#10321a`、玻璃 `rgba(244,250,245,.38)` + 模糊 24px + 饱和 115%、新增 `--ods-material-glass-sheen`、Dock 尺寸令牌封顶在原型实测值 689×102.5
- [x] 场景运行时改成按时间限帧（不再隔帧），卡顿后不补帧；`sceneRuntime.test.ts` 覆盖
- [x] ESLint 清零；`docs/design-system/*.md` 的旧主题名已同步过一轮
- [x] 首页按规格改完代码：Surface glass 变体改成 `::before` 2px 高光环（不再用 border）、局部属性 `--surface-radius`、`DockIcon.tsx` 自绘五个图标、`--ods-shell-dock-icon-size/label-size/item-gap`、`--ods-gradient-nav-selected` / `--ods-shadow-nav-selected`、收款摘要按原型比例缩放。tsc / vitest（106 文件 472 用例）/ ESLint 全过
- [x] 首页浏览器数值验收（第六次会话）：胶囊、饼图、Dock 外框和五个项的几何都在规格 ±1px 内；场景各区域亮度与原型差 ≤1.5。为贴合原型做了这些改动：
  - 玻璃分两档。`Surface` 新增 `density="dense"`（只对 glass 生效，Dock 在用）；令牌 `--ods-color-bg-surface-glass` 降到 `.31`、新增 `--ods-color-bg-surface-glass-dense`（`.45`）、`--ods-material-glass-shadow-outer` 减轻到 `0 8px 24px .08`、新增 `--ods-material-glass-shadow-dense`
  - `--ods-material-glass-specular` 重写：左上最亮、右上消失、右下角再亮一次。原型里 Dock 和胶囊的高光互相矛盾，取的是折中值，边缘个别点仍差 ±10 亮度，不必再调
  - Dock 墨色改用 `--ods-color-fg-relaxed`，选中项是 `color-mix(accent-fg 88%)`；新增 `--ods-shell-dock-label-weight: 450`；链接加了 `padding-block-end` 让图标和文字上移 1px
  - 比对脚本在 `/tmp/orange-resume/work/`：`compare_home.py`、`compare_pill.py`、`ink_mass.py`、`p3.py`
- [x] 首页雨丝：动画雨改成 13.5° 向左下落（原来 11° 向右下，和静帧里画好的雨交叉），长度 22–100px 偏短分布、线宽 1.5。两帧相减逐条拟合实测 −13.5°、中位长度 39px。密度没加：静帧自带的雨加上 96 条动画雨已接近原型的每 200×200 约 7 条
- [x] 项目、日历、分析、设置四页按原型适配。**已定的口径（第七次会话）：结构、层级和材质跟原型，字号和密度跟规范 §4.2 / §6 的上限**。依据：规范里 Dock 和首页摘要的尺寸就是原型按 1440 宽换算来的，而业务页的字号（标题 36–42、正文 14–16、表格行高 52–64）是规范有意写得比原型小，为的是台账密度。原型实测字号是规范的 1.4–1.5 倍，照搬的话 1280×800 的默认窗口里项目表只剩三四行。字号走令牌，以后想整体放大只改令牌
  - 浅色主题下的现状截图和数值在 `/tmp/orange-resume/shots/light-0{2,3,4,5}-*.png|-metrics.json`，脚本 `shoot-pages.mjs` + `js/page-metrics.js`
  - **不用再通读规格。** 每页要做的事已经摘在下面「业务页改造清单」，动手时只查对应规格里的那一节
- [x] 设置页：外观标签的三个开关和预览、个人信息里的账户退出、开发设置里的组件展厅入口（第十四次会话，细节见下面「系统设置」）
- [x] 登录页（`06-login.png`）和 404 页（第十四次会话，细节见下面「登录与 404」）
- [x] `docs/ORANGE_DESIGN_SYSTEM.md` 升到 v1.2：范围加上登录和未找到页、原型索引加 06/07、3.2 尺寸表和 4.1 颜色表换成实测值与当前令牌值、4.2 加标题字重和楷体 / 数字字体栈、6.5 按实现重写、新增 6.6 登录（含与原型有意的差别一张表）和 6.7 页面未找到、8.1 目录和 8.2 组件契约补 `CloudPanel` / `ScenePage`、验收命令改成 `tsconfig.app.json`
- [x] lint、构建、Go 测试，浏览器验收（第十四次会话结束时的状态）
  - `npx tsc --noEmit -p tsconfig.app.json`、`npx vitest run`（107 文件 497 用例）、`npx eslint src --max-warnings=0`、`npm run build` 全过
  - `go test ./...` 全过；`go build .` 和 `go build ./cmd/... ./internal/...` 通过。`go build ./...` 会在 `build/ios` 报 `function main is undeclared`，那是 Wails 的 iOS 脚手架，要带构建标签，和这次重构无关
  - `npx prettier --check src` 还报 12 个文件，都是重构之前就有、这次没碰的（`src/api/*.ts`、`config/api.ts` 等），没去动
  - **WebKit 截图已由子代理看过（2026-11-18）**：18 张里没有渲染损坏。三条低置信度备注：登录页「记住密码」很淡（浏览器预览里它本来就是禁用态）；会滚动的页面滚动条顶端贴近面板右上圆角；夜雨下项目详情的小字偏暗（已在遗留项里）。登录卡片的海棠角没有特写，只在缩略图里看过。记录在 `/tmp/orange-resume/s14/webkit/review.md`。以下是当时的原话： 对照图已经拼好放在 `/tmp/orange-resume/s14/webkit/sheet-webkit-{light,dark,closeups}.jpg`，会话末尾连续三次起子代理都被网关 429 拒掉（主会话已经连续跑了八个多小时）。数值上 WebKit 和 Chromium 一致，下次会话一开始先把这三张图交给子代理看
  - 浏览器：九个页面在 1280×800 下浅色、深色各过一遍（Chromium 和 WebKit），面板和 Dock 位置一致、没有横向溢出。WebKit 里用鼠标点 Dock 把五个入口走了一圈：没有控制台或页面错误，工作台摘要显示真实金额，场景的 WebGL2 和 Canvas 2D 两层都在跑（`/tmp/orange-resume/s14/webkit_idle.py`）。之前 `webkit_check.py` 报的三条 `due to access control checks` 是脚本自己在请求没回来时就 `goto` 刷新造成的，等网络空闲再跳就没有。**没在 Wails 打包后的真实窗口里看过**，这一步只能用户自己跑 `task dev`
- [x] 2026-11-18 提交前重新验证：`npm run build`（含 `tsc --build`）、`node node_modules/eslint/bin/eslint.js src --max-warnings=0`、`npm run test:run -- --reporter=dot`（107 文件、497 用例）通过；`go test -mod=readonly -count=1 -json ./...`（14 个有测试包、75 个顶层测试及 103 个子测试、0 失败/跳过）、主程序临时 `go build -mod=readonly` 通过。构建仍有主 JS chunk 超过 500 KB 的提示，测试仍有 React `act` 和 Wails 浏览器环境提示；本次未补做真实桌面 Keychain 或窗口验收。
- [ ] 还没做、留给下一次的（都不挡事）：
  - 设置页五个管理面板里的列表本身（用户卡片、令牌卡片、通知卡片、字典条目）还是卡片，只把外框减轻了
  - 项目详情页内部的排版没按新风格重做，只去了 eyebrow 和卡片底色；小号等宽数字在夜雨主题下偏暗
  - 数据同步的「对比 / 同步」步骤没在浏览器里验过（要连一个云端库）
  - 登录页背景比原型灰、桥占得更宽（06/07 是另一幅画，没有可用的素材）
  - 2026-11-18 用户授权提交全部当前代码，按三个主题整理：登录凭据存储（`d575353`）、统计时间范围修复（`6c63e2f`）、烟雨江南界面重构（提交号见 `git log`）。切分支前的混合改动已一并纳入对应主题，原始快照 `refs/backup/pre-jiangnan-ui` 保留。

### 第十七次会话（2026-11-18）：收紧密度、设置页重排、动画

用户要求：项目管理和设置页可视范围太小；Dock 下移；所有页面去副标题；主标题变小；整体收紧；增加动画（登录页小女孩挥手、水面涟漪、柳树摇曳等）；设置页可以不按原型。
- [x] 壳层：`--ods-shell-dock-offset` 改成 `clamp(10px,1.1vw,16px)`（原 20–43）；面板顶 = 标题栏留白 44；左右边距 `clamp(16px,2.5vw,40px)`；面板到 Dock 16；面板内边距 16–28 / 16–32；`--ods-radius-surface` 20–28。1280×800 下面板从 1158×583（占窗口 65.9%）变成 1216×638（75.7%）
- [x] `PageHeader`：标题 `clamp(1.375rem,2vw,1.75rem)`（1280 宽时 25.6px，原 37px），整行最小高度 40。所有页面不再传 `description`（项目详情的客户 / 合同号 / 状态、固定项目的收款页项目名是数据，保留）；登录页和 404 的说明句也删了
- [x] `Table` plain 变体：表头 40、行最小 44、上下内边距 8
- [x] 项目管理：搜索、状态筛选并进标题行的 `actions`，`.projects-toolbar` 删除。1280×800 下可见行 4 → 9
- [x] 设置页重排（不再跟原型）：左侧 10.5rem 竖向分类栏（ODS `Tabs` 的 `navigation` 变体改成圆角项 + 选中浅青底，带图标）+ 右侧内容，中间一条竖线；≤56rem 宽时退回横向 underline 标签（`hooks/useMediaQuery.ts`）。行高 52、外观行 60，开关行的说明句删了；表单和「关于」宽度封顶 44rem。字典管理里的「字典分类」小标删了
- [x] Dock：一个滑动的高亮 `.app-dock__indicator`（`--app-dock-index`），链接自己的选中底通过 `--router-nav-link-selected-background/shadow` 关掉；悬停图标上浮；Dock 和页面内容有进场动画（`animation-fill-mode: backwards`，不能留 transform，否则 sticky / fixed 子元素会错位）
- [x] 场景：柳枝摆幅加大并带阵风起伏、水波加强、涟漪 6 → 12 且每滴两圈、偶尔飞过一只燕子（`renderRain2D.ts` 里画的）。`useSceneRuntime` 钩子从 `JiangnanScene` 抽出来，`startSceneRuntime` 多了 `crop` 参数，`getScenePageCrop` 对应登录页的裁切
- [x] 小女孩挥手素材：用 `.env` 里的生图服务（OpenAI 兼容，`/v1/images/edits`，脚本 `/tmp/orange-resume/s17/img.py`）从 `scene.webp` 里裁出 384×384（源图 680,630 起）放大到 1024 做图生图。**生图会把整个人重画得比原画清晰**，所以不能和原画交替：另外生成了一张同样清晰的「放下手」的静止帧，三帧（`greeter-rest/wave-a/wave-b.webp`，402×316，各约 20 KB）都盖在原画的小女孩上；头部锁定用同一帧，栏杆以下不动。位置是静帧的比例 x 0.2434、y 0.32626、宽 0.09016、高 0.09942
- [x] 登录页 / 404：背景跑和工作台一样的水面、柳枝、雨丝（`ScenePage` 用 `useSceneRuntime(animate, getScenePageCrop)`），小女孩 `SceneGreeter` 每 9 秒挥一次手（工作台上也有）；登录表单逐项进场（`login.css`，只动卡片的子元素）。`scene-page.test.ts` 的「不许循环动画」改成只约束卡片所在的三个样式文件，另加了人物裁切和两张静帧一致的断言
- [x] 子代理看图后改的：项目页状态筛选被「新建项目」压住（`Select` 自带 `min-width: 12rem`，外层给 9rem 会溢出，改成 12rem）；字典管理的第二条竖栏改成横向 `accent` 标签、去掉「共 N 个条目」；设置表单和「关于」铺满内容区；挥手两帧的交叉淡化从 270ms 缩到 90ms（半透明叠在一起时像重影）；人物加 `blur(0.35px) saturate(0.9)` 压一点锐度
- [x] 验证：`tsc -p tsconfig.app.json`、vitest（107 文件 498 用例）、ESLint、`npm run build` 全过；WebKit 1280×800 和 1024×700 下各页无横向溢出，设置九个标签都不滚动，Dock 高亮和当前项重合。**没在 Wails 真窗口里看过**，挥手和燕子只看过静态截图，没看过连续播放
- 没改、留着的：夜雨主题下状态胶囊对比度低、进度说明小字偏暗；设置页内容少的标签下半个面板是空的（面板高度固定）；分析页三处左边缘不齐；人物仍比周围的画略清晰
- 生图素材的中间文件在 `/tmp/orange-resume/s17/art/`（`wave1.png`、`rest.png`、`wave2b.png` 是模型输出，合成脚本在本次会话记录里，没进仓库）。丢了要重做的话：先图生图出一张举手帧，再以它为底图生成放下手和另一个挥手角度，这样三帧的脸一致
- 验证环境：真实桌面应用（`task dev`）占着 3456 且连的是真实库，所以另起了 `API_SERVER_PORT=3466` 的后端（库副本 `/tmp/orange-resume/s17/db`）和 9331 的预览（`PREVIEW_API_TARGET` / `PREVIEW_CACHE_DIR`，`vite.preview.config.mts` 现在读这两个环境变量）。脚本 `/tmp/orange-resume/s17/wk.py <config.json>`（Playwright WebKit，只落盘）

### 第十八次会话（2026-11-18 晚）：用户看过第十七次的结果后提的七条

做完一条勾一条，做法和结论直接写在条目下面。
- [x] 1 小女孩挥手时脸清晰、静止时模糊。Playwright WebKit（DPR 2）里量不出差别（边缘方差都是 131）。推断是 `.scene-greeter__pose` 上的 `filter: blur(.35px)`：静止帧不合成、走软件滤镜，挥手帧因为 opacity 动画被提成合成层、走另一条路径。做法：去掉 CSS filter。**已去掉**
- [x] 2 首页饼图点击切换（用户原话「首页饼状图可以点击切换的」，没说切什么；按统计范围理解：全部 → 近一年 → 近90天 → 近30天 → 近7天）。做法：饼图包在 ODS `Button variant="bare"`（新变体）里，点一下在 全部 → 本年 → 本月 之间循环，范围直接写进两行标签（本年已收款 / 本年待收款），不另加说明；选择存在 localStorage `workbenchSummaryScope`。本年 / 本月走新的 `year` / `month` 接口参数（自然年、自然月）。已收扇区改成「描边圆」（r=8、线宽 16、`stroke-dasharray`），切换时扇区角度有过渡
- [x] 3 项目管理只滚表格数据，标题行、表头、分页固定。做法：`.projects-view` / `.projects-workspace` 都是 `flex: 1 1 0; min-height: 0`，表格外层 `.project-table-scroll` 自己 `overflow-y: auto`（最小 11rem，窗口太矮时整页再滚）；`Table` 用 `stickyHeader`，ODS 里把 plain + sticky 的表头线改成内阴影（collapse 的边框不跟着 sticky 走）、表头 z-index 3（高于行内 sticky 单元格）
- [x] 4 数据分析「年」后面加自选年 / 月，按所选年或所选月统计（后端 stats / income-trend 加 `year`、`month` 参数）。做法：第五个标签「自选」，选中后右边出现年、月两个下拉（月份第一项「全年」）；后端 `GetStatsForCalendar` / `GetIncomeTrendForCalendar` + `utils.GetCalendarRange`，自选范围不进缓存；前端 `DashboardScope = 周期 | {year, month}`。注意库里的日期存的是 UTC 零点，测试数据也要用 UTC
- [x] 5 导出：WKWebView 不认 `<a download>`，所以桌面端现在点导出没反应。加 Wails 服务弹保存对话框写文件；项目详情页的导出还是「开发中」的提示，要做成真的。做法：`internal/desktop/file_exporter.go`（`FileExporter.SaveText`，已在 `main.go` 注册并重新生成 bindings）；前端 `utils/csv.ts` 的 `exportCsv` 在桌面端走它、浏览器里走下载链接；项目导出统一成 `useProjectExport`（项目信息 + 全部收款节点），列表和详情页共用。**桌面端的保存对话框没法在浏览器预览里验证**
- [x] 6 分页左右箭头、设置页左侧菜单图标与文字没有垂直居中；全局检查图标对齐。根因两个：分页箭头是文字字符「‹ ›」（换成 `ri-arrow-left-s-line` / `right`）；Remix 图标的 `<i>` 继承了行高，盒子比字形高，在 flex 里居中后字形偏下（设置页左栏偏了 3.9px）。在 `foundations/typography.css` 加了全局规则：图标盒子 `inline-flex; line-height: 1; vertical-align: .03em`。像素审计脚本 `/tmp/orange-resume/s17/icon_audit.py [阈值]`（WebKit DPR 2，逐页量每个图标的墨迹中心相对控件中心和旁边文字的偏移）：198 个图标里超过 1px 的从 84 个降到 2 个（都是 1.06px，字形本身上重下轻）
- [x] 7 设置页：安全设置并进个人信息（放在下面），两个保存按钮右对齐；各页面重新设计。做法：`components/settings/SettingsGroup.tsx`（标题 + ODS `Card` + 可选的底部操作行）是所有设置页的基本单元，页面 = `.settings-page` 里一摞 group / 工具条 / 表格。个人信息页 = 账户卡（头像、姓名、角色、退出登录）+「个人信息」卡 +「安全设置」卡，两个保存按钮都在卡片底部操作行右端；`?tab=security` 会落到个人信息页。外观 = 三张主题缩略图单选卡（每层带 `data-theme`，所以无论当前什么主题都用各自主题的令牌画）+ 三个开关行。用户 / 字典 / 令牌改成 ODS `Table`（card 变体），通知改成卡片里的行，数据同步的配置是一张卡（主机地址占两列）。各面板顶部的统计数字除数据同步的对比步骤外都删了。`settings.css` 整个重写（845 行 → 约 560 行），旧的 `.user-card` / `.dev-token-*` / `.notification-card` / `.dict-*` 规则全删

  第十八次会话的验证与看图后的修改：
  - 子代理看图（两轮，`/tmp/orange-resume/s17/review-c.md`、`review-d.md`）后改的 ODS：`Avatar` accent 色调的字改用 `accent-text`（原来浅字压浅底）；`Switch` 关闭态轨道改 `border-control`；`IconButton` 图标 16 / 18 / 20px（原来跟着按钮文字是 12 / 14px）；分页选中项去掉外发光、方向按钮改成正圆；`Table` card 变体和粘性单元格底色改 `bg-surface`（夜雨下卡片才和面板分得开）；`Radio` card 选中态多一圈 accent；`Tabs` navigation 项左内边距 16（图标和页面标题对齐）
  - 分析页：第一项指标和趋势图标题都从 +16 起（和页面标题同一条左边线）；项目页分页条左右内边距 16
  - 验证：`go test ./internal/...`、`go vet`、`go build .` 通过；前端 tsc / vitest（110 文件 512 用例）/ ESLint / `npm run build` 通过；WebKit 1280×800 下设置八个分类都不滚动、无横向溢出，项目页外层不滚、表格内部滚（表头 y=127 不动，分页 y=624）
  - 第二轮看图后又改：数据同步的数据库类型落到表单的三列网格上（`RadioGroup` 新增可由宿主设置的 `--radio-group-gap`）；通知的「查看」改成眼睛图标；重置密码图标换成 `ri-lock-password-line`（原来的钥匙比旁边两个细）；分析页结构图例铺满右栏、逾期附注字号 12 → 14；项目表格外框加底线；项目导出里的类型 / 阶段 / 收款方式写字典标签而不是存储值（`useProjectExport` 里现取字典）
  - 导出在浏览器预览里走通过（`/tmp/orange-resume/s17/export_check.py`）：报表 `Orange-数据分析-2026年11月.csv`、项目 `Orange-项目-<项目名>.csv`
  - 还留着的小问题：项目表滚动时行直接切在表头下，没有渐隐；夜雨主题下卡片和面板只差一点亮度、主要靠描边；新建项目页日期选择器的日历图标偏上 1px（字形本身上重下轻）
  - **没验证的**：桌面端保存对话框（要在 Wails 里点）；挥手清晰度的修复（无头 WebKit 里修复前后都量不出差别，是按 WebKit 滤镜渲染路径推断的）
  - `animation-plans/` 目录在本次会话开始前就已经从工作区删掉了（`git status` 里 8 个 ` D`），不是这次会话删的，没去动

### 项目类型名称与小天平配色（2026-11-19）

- [x] 项目详情改用 `project_type` 字典的 `label`；字典请求独立于项目/收款加载，失败时保留默认名称或历史原值，卸载后不更新状态。真实库副本的类型是 `mba` / `medicine` / `Chemistry` / `Education`，应显示 MBA / 医学 / 化学 / 教育。
- [x] 新增项目右侧金额核对图标的 ODS `Surface` 改为 `tone="accent"`，消费系统青绿色文字/背景令牌；金额核对文字、外框和 `data-state` 仍按实际金额更新。
- [x] 验证：全量 `src` ESLint、`npm run build`（含 `tsc --build`）、三份改动 TSX 的 Prettier、`git diff --check` 均通过。详情/新增页与相关 ODS 契约合计 6 文件、42 用例通过，0 失败/跳过；详情 17 用例包含新增的 9 个字典回归。构建仍有原有主 chunk 超过 500 KB 提示。
- [x] ego lite 与 WebKit 均核对 1280×800 的浅色/深色页面：详情显示名称，天平颜色分别为 `rgb(45, 101, 74)` / `rgb(160, 215, 175)`，均与 `--ods-color-accent-text` 一致。WebKit 另核对 MBA / 医学 / 化学 / 教育 / 其他五种类型及金额中立、未匹配、已匹配三种状态；匹配后切换为勾，强调配色保持一致，无页面错误或横向溢出。
- [x] 子代理查看两引擎截图中的四张 ego lite 截图：天平居中、青绿色协调，类型 MBA 完整可见，局部无明显渲染回归。截图和记录在 `/tmp/orange-project-fixes/shots/`、`visual-review.md`、`webkit-results.json`。此次未在 Wails 真窗口验收。
- 验证使用数据库副本 `/tmp/orange-project-fixes/db/orange.db`，后端 3466、前端 9331 与独立 Vite 缓存，未操作桌面应用所用的真实库。

### GitHub 打包发布与应用内更新（2026-11-19，代码与本地验收完成）

- 实际 GitHub 最新发布是 v0.7.2，包含 Windows installer、macOS zip 和 Linux AppImage/deb/rpm。原更新操作只打开下载页；原 Release 三平台并行各自公开附件，存在半成品发布窗口；旧 NSIS 未读取安装路径，默认版本还停在 0.0.1。
- Windows NSIS 已补 HKLM/HKCU、64/32 位历史安装目录识别与持久记录，支持 `/S /UPDATE /D=<目录>`；安装失败恢复旧 exe/uninstaller。安装器不重启应用，用户态 helper 等待安装退出码 0 后重启，避免继承管理员权限。
- Release 改为 prepare → 三平台 build/verify → 聚合 draft/核对附件 → publish；标签同步到 package/Info.plist/Windows/nfpm 元数据，生成 SHA256SUMS，缺包/哈希变化失败。macOS 实际构建 universal 并用 lipo 验证；旧重复 test.yml 合并到 CI，升级 retired Actions 和 Go 版本来源。
- 已写原生 AppUpdater 与独立更新 helper：流式下载与 SHA-256 校验、按 OS/架构选包、取消/重试、等待旧进程退出、安装后重启。macOS/AppImage 暂存到安装目录同一文件系统后替换并保留失败回滚副本；deb/rpm 使用包管理器与 pkexec。开发模式、只读磁盘映像或不支持安装方式仅提供下载页。
- 设置关于页已接原生服务和更新进度；仅更新期间每 500ms 串行读取内存状态，空闲无轮询/网络，退出/卸载清理。原生版本从 main 内嵌 frontend/package.json 读取，与发布元数据一致。更新 helper 在 Bootstrap 前分流，不打开数据库/窗口/HTTP。
- Release 追加静态 `update.json`（五个平台资产与 SHA256SUMS 的名称、URL、大小和 SHA-256）；更新器优先读取该文件，旧发布 404 时回退 API，避免共享匿名 GitHub API 额度影响新发布的更新检查。前端及原生均禁止降级。
- 验证完成：前端全量 111 文件、552 用例；Go 15 有测试包、100 顶层/132 子测试（更新器 22 顶层/29 子测试），0 失败/跳过，race/vet 通过。全量 src ESLint、Prettier、production build、Windows amd64 production 主程序/更新器测试二进制交叉编译通过；Wails Go1.26 绑定扫描 3 服务/8 方法无警告。macOS 本地编译仍有现有 SDK 27.2 对部署目标 11.0 的链接警告，不作为旧 macOS 兼容性验收。
- 发布工具 9 用例、两工作流 actionlint、golangci v2 config verify、NSIS 3.13 隔离编译通过；更新器全量 lint 和相对 HEAD 的全部代码增量 lint 都为 0。全库仍有静态检查旧债；CI 以 PR baseSHA / push beforeSHA / dispatch 父提交做新增问题门禁，保留完整 JSON/文本/SARIF。本次顺带整理新增统计代码的常量/import，并将导出文件默认权限收紧为 0600，清掉阻塞增量门禁的四项问题。
- 页面 QA：真实 REST HTTP200 返回最新 v0.7.2，实际显示“当前已是最新版本”；ego lite 浅/深 1280×800 下下载42%、取消、错误重试渲染通过。native 状态使用页内 runtime response fixture，未真实执行安装/重启。证据 `/tmp/orange-update-preview/qa.md`、截图、调用记录；space3 已关闭、隔离3466/9331服务已停止。旧用户服务3456/9245未停止。
- 原生更新助手的无效计划调用在 Bootstrap 前退出，未打开数据库/窗口/HTTP；文件替换/OS拒绝启动回滚已用临时目录验证，但新应用初始化/数据库迁移失败的自动回滚未覆盖。Windows运行/UAC、三平台Actions实际运行与发版未执行。未推送代码、打 tag、发布或替换用户实际安装的应用。说明见 `docs/release.md`。

### 珠算与 Primordial Weave 迁移（2026-11-19）

- 用户明确选择“全部换新标识，并迁移旧数据”。显示名珠算，英文名/可执行文件/资产前缀 zhusuan，模块 github.com/primordialweave/zhusuan，Apple ID org.primordialweave.zhusuan，Windows key PrimordialWeaveZhusuan。
- GitHub 已通过 transfer(new_owner=primordialweave,new_name=zhusuan) 转移同一仓库；id 1107498836 保持不变，30 refs 与24历史Releases记录比对保留，visibility public、default branch main、Actions enabled/all 保持；origin 已改新URL。源无显式team绑定，当前xuewill仍admin。原地址不要重新建repo，否则旧跳转会失效。
- 原工作区完整快照保存在 refs/backup/pre-zhusuan-migration-20261119；模块/绑定/打包已新命名，用户提供的 frontend/public/zhusuan.png保持不变，已生成新平台icon。原Handoff历史项目名与路径是历史证据，未盲目替换。
- 新默认数据路径 UserConfigDir/primordialweave/zhusuan/zhusuan.db；旧库只读VACUUM INTO+OS锁+独占发布，原库保留，已有新库不覆盖，显式DB_PATH尊重。实际新旧项目/收款/字典逐条一致；当前保存的登录已用cmd/migrate-credentials迁入新service/scope（不输出值），新旧keychain条目均保留。
- Mac旧WK偏好逻辑读取白名单（UTF16LE，含WAL），私有one-shot/no-store endpoint在store初始化前补缺失值，新值优先；Windows新profile路径DataDir/WebView2，旧进程/SID与LOCK校验后clone持久文件，缓存/会话不搬。登录会话原本在sessionStorage，不宣称保存会话；Wails native LogLevelWarn防止Info binding输出密码。
- 隔离初步验收：frontend112文件/556用例，updater28顶层/33子、data/credentials26顶层与scope/profile回归通过；更新器与全部增量lint0、NSIS3.13隔离编译、Windows updater/config/desktop交叉编译通过。完整最终检查仍在汇总。
- 浏览器QA在ego space4核对浅深1280×800登录/关于、新logo/组织链接、偏好旧→新及新优先，截图无裁剪/溢出；native响应明确fixture，REST登录真实隔离服务。QA space与3466/9331已清理，未停用户3456/9245。记录/tmp/zhusuan-migration/qa.md与docs/migration.md。
- 代码已在 codex/zhusuan-migration，迁移提交 efde538，PR https://github.com/primordialweave/zhusuan/pull/2。当前工作版本较main含未合并历史功能；迁移PR包括这些既有实现，先作为draft审查，未发布新桌面版本。
- main基线实际60项静态阻塞已清理：缓存失败记录但不改变业务成功、分页显式fallback、用户/收款共享同步保序/空ID保护、工具错误检查/必要注释格式。新增回归后全量Go127顶层/137子（16有测试包），race/vet0失败/跳过，针对origin/main的全部增量lint0；frontend112文件/556通过，release工具10/10、NSIS/Windows编译验证仍通过。
- Docker新用户无默认home目录，因此明确ZHUSUAN_CONFIG_ROOT=/app/data并准备可写data/log目录；自定义DB_PATH与旧挂载兼容。此机器Docker daemon未运行，没有启动Docker或声称容器运行验收。GitHub最终CI重跑结果待补。
- 最终CI run 44466899382 已success（head 87cc0dc）：frontend/backend/security成功，Build Docker Image按PR场景skipped。首次Linux门禁将utils包名警告归到timerange.go，trend.go行内nolint反而unused；改为仅针对既有utils包名的path+text规则后，本地Darwin/main基线与Linux包检查0，远端通过。不要对任意一个文件豁免包级警告。
- 用户明确选择“先保留PR，暂不发布”：PR #2保持draft，未合并main、未发桌面release/镜像。代码提交顺序efde538（迁移）、d1977fa（CI旧债修复）、87cc0dc（平台稳定规则），均已推送；本条是CI完成后的本地Handoff记录，未额外推送触发新CI。
- 2026-11-19 Dock旧图标复核：当前进程实际运行zhusuan.dev.app，bundle ICNS与build新图标一致，非旧程序/旧资源；main未显式设置Options.Icon。新增darwin专用embed ICNS并设置Icon，Wails通过NSApp.setApplicationIconImage更新运行图标，其他平台仍用本地资源。dev热重载后实际Dock区域截图显示新木质玉珠算盘及running圆点；未kill Dock/清系统缓存/改pin。CUA Dock直接绑定曾超时，改用只读screencapture区域核对，证据/tmp/zhusuan-dock-check/visual-review.md。
- Windows安装器继承安装路径/程序/卸载key；数据库与profile在安装后首次以原用户启动时迁，记住密码首次Load迁，不是NSIS直接复制库，也没有finish自动Exec应用。修复DB_PATH空/全空白导致LookupEnv误判跳过迁移、随后创建新空库的问题；非空自定义路径保持原样。config14顶层/3子与root/main/desktop共35通过事件，race/vet、增量lint及Windows交叉编译通过。新珠算包尚未发布，旧Orange包没有这段代码。
- 2026-11-19 新图标替换：以用户Zhusuan-Dock-Celadon.png为源（1254²RGBA），build/appicon.png逐字节相同；重生成macOS ICNS、Windows6尺寸ICO/MSIX6PNG、Linux128/256/512、Android10PNG、iOS15PNG+18catalogentries、不透明1024主图及Web/favicon/旧URL兼容图。原用户源图不编辑；Python生成器/scripts requirements已提供，正常构建只消费生成资源。
- iOS的build/ios/Assets.xcassets其实是JSON模板，actool真实目录由xcode:gen生成且默认从透明master重渲染。因此新增规范AppIcon.appiconset，并在Xcode生成后覆盖不透明版本；只换icon.png不够。Linuxnfpm/AppImage已改用正确尺寸的PNG。
- 六平台拼图已由子代理看过：Android round未切算盘、iOS青瓷底无黑角、MSIX无拉伸。当前PID7900的Dock真实区域截图也确认新的浅青瓷圆角底算盘与运行圆点，dev ICNS与build一致；未kill Dock/改pin/清缓存/关闭app。证据/tmp/zhusuan-icons/visual-review.md，未扩大到Windows/iOS/Android系统运行验收。

### 业务页改造清单（第十次会话整理，做完一条勾一条）

公共层
- [x] 面板外边距：1487 宽时左右 80（现在 74），面板底到 Dock 顶 28（现在 24）；阴影减到几乎没有，四边 1px 亮边
- [x] 四页都去掉 eyebrow，说明改成固定一句话：项目管理 / 查看合同与收款进度，收款日历 / 查看计划收款与到账安排，数据分析 / 了解收款进度与资金结构，系统设置 / 管理账户和界面偏好。项目详情、新建 / 编辑项目、添加收款三个子页面的页头还带 eyebrow，见下面「子页面」
- [x] ODS `Table` 加 `variant="plain"`：无外框无表头底色，只有横向细线，行高 60–64

项目管理（规格 `02-03` §2、§5.2）
- [x] 去掉三张指标卡、`PROJECT LEDGER` 文字块；状态标签页改成「全部状态」下拉，六个状态都保留
- [x] 工具栏：搜索在最左，其后状态下拉。**不做「全部客户」下拉**（列表接口没有客户参数，规范 §6.2 明确不许只筛当前页）
- [x] 列顺序：项目名称、客户、截止日期、合同金额、已收款、收款进度、状态、（省略号）。客户单独一列
- [x] 进度：加粗的条 + 下方一行「¥已收 / ¥合同　60%」
- [x] 状态胶囊去掉图标；行操作收进一个省略号菜单（编辑、添加收款、导出、归档、删除）
- [x] 分页靠右，条数信息和每页条数保留在同一行

  第十一次会话看过一次对照图后又改了这些（当时没来得及记）：
  - ODS 小面积填充一律用纯 `--ods-color-accent`、去掉外发光：`progress`、`switch`、`checkbox`、`radio-group`、`slider`。原因：`--ods-gradient-glow` 在烟雨主题里是很浅的选中底色，用在进度条上几乎看不见
  - 进度条不再按状态换色（已完成也用 accent）；说明行改成左对齐「金额　百分比」
  - 「新建项目」用 `size="lg"`；省略号用默认尺寸 `IconButton`；`ProjectStatusChip` 加了 `size`，列表里传 `lg`
  - 表头、项目名、金额都是 400 字重（原型整体偏细）；项目名最多两行（`-webkit-line-clamp: 2`，行高用 `--ods-line-height-heading`），行高实测 66.6
  - 数值：1487 宽时面板 `[79.8, 81.4, 1327.3, 803.1]`、到 Dock 28，无横向溢出

  项目页代码和测试已改完（`ProjectsView.tsx`、`project-domain.css` 列表段、`ProjectStatusChip.tsx`），浏览器里看过一轮对照图，结构与原型一致。顺手修了 ODS `Dropdown.Menu` 的 `label` 落在 `role="none"` 元素上、菜单没有可访问名称的问题。

收款日历（规格 `02-03` §3、§5.3）
  第十二次会话的做法（先记在这，逐条勾）：ODS `Calendar` 的 `layout="fluid"` 改名并重做成 `layout="board"`（只有收款日历在用）：标题靠左、上一月/今天/下一月成组靠右、只画当月需要的周数、跨月格是空的 gridcell、整格选中、今天细描边；新增 `weekStartsOn`（默认 1，日历页传 0）和 `renderDayContent`（有它就不画右下角小圆点）。导航箭头换成 Remix 图标。`Calendar.test.tsx` 已补 board 用例并通过。
  页面口径：格内按状态汇总（逾期、待收、已收各一行「状态 ¥合计」，最多两行，其余「+N 笔」）；右栏列出当天全部款项，不再有「查看全部」和 `?view=day|month` 整页清单；「近期收款」= 当月今天起的待收（规范 §6.3），不含选中日，最多 5 条，点一条就选中那天；切月保留原日号并截到月底。
- [x] 去掉三张指标卡和所有卡片外框；左月历右明细，中间一条竖线
- [x] 月标题靠左（`2026年11月`），上一月/本月/下一月三个按钮靠右成组
- [x] 周日开头；网格 1px 线 + 圆角外框；日期数字在格子上方居中；跨月格留空
- [x] 格内摘要：状态点 + 「已收/待收/逾期 ¥金额」，最多两条，多了显示「+N 笔」
- [x] 选中日整格浅青底；今天用细描边区分
- [x] 右栏标题就是日期（`11月13日 · 周五`），条目是项目名 + 阶段名 + 金额 + 状态胶囊；第二段「近期收款」只列日期和项目

  日历页代码和测试已改完（`CalendarView.tsx`、`calendar-domain.css`、ODS `Calendar`），tsc 和相关 vitest 通过。浏览器数值验收过（浅色 1487×1058、1280×800、1024×720，深色 1280×800）：
  - `.app-view-content` 改成 `display:flex; flex-direction:column; min-height:100%`，页面根节点写 `flex:1` 就能撑满面板高度（目前只有日历页用）。月历撑满，右栏内容放在绝对定位的 `.calendar-detail__scroll` 里自己滚，所以右栏再长也不会把月历推出视口
  - 1280×800 下五行的月份刚好不滚（行高 62.6）；六行的月份（如 2026 年 8 月）整页多滚 59px，这是算过的下限：行里要放日期 + 两行摘要，最小 62px
  - 1487×1058 下行高 105.8、格宽 117.6，月历占 68.8%
  - 格宽 101px（1280 宽）时带分币的大额（「待收 ¥5,000.50」）会被省略号截断，完整金额在按钮的无障碍名称和右栏里。整数金额到六位数都放得下
  - 验收用的 11 月款项是往 `/tmp/orange-resume/db/orange.db` 这个副本里插的 7 条（id 156–162），真实库没动
  - 脚本：`/tmp/orange-resume/s10/shoot-calendar.{mjs,json}`、`calendar-metrics.js`

数据分析（规格 `04-05` §04、§E.2）
  第十二次会话已把代码和测试写完（`AnalyticsView.tsx`、`analytics.css`、`AnalyticsView.test.tsx`、ODS `tabs.css`），随后被网关 502 掐断，**没来得及记也没在浏览器里看过**。第十三次会话确认 tsc / vitest（106 文件 483 用例）/ ESLint 全过。做法：
  - 指标是页面自己的 `<dl class="analytics-metrics">`，不再用 `SummaryMetric`；百分比最多一位小数、分母为零显示「—」（CSV 里同样）
  - 趋势图 Chart.js `line`：实际收款实线 3px + 向下淡出的渐变面积，计划收款虚线 `[8,5]`；图例是标题行右侧的 `<ul>`；y 轴用「万 / 亿」缩写不带 ¥；日期范围作为标题旁的一行小字（页头说明改成固定文案后，范围挪到这里）
  - 结构图是页面内的 SVG 两段环（`StructureDonut`），不用 Chart.js；逾期金额是待收行下面的红色附注
  - 周期切换仍是 `Tabs`（保留每个周期一个 tabpanel），ODS `accent` 变体的轨道改成透明、选中项阴影减轻。**这个变体 `ProjectDetailView` 也在用**，验收时顺带看一眼
  - 页面根节点 `flex:1`，图表区撑满面板剩余高度（依赖日历页时加的 `.app-view-content` flex 列）
- [x] 四项指标去卡片、去图标、去趋势徽标，改成一行四列，列间短竖线，下方一条横线
- [x] 两张图去卡片，中间一条竖线，左 68% 右 32%
- [x] 趋势图从柱状改成双线：实际实线带渐变面积，计划虚线；图例放标题行右侧；y 轴不带 ¥
- [x] 结构改成两段环形图 + 两行图例（已收款 / 待收款 + 金额），逾期作为待收行的附注
- [x] 周期分段和导出按钮改成描边样式；指标名和统计口径不改（规范 §6.4）
- [x] 浏览器数值验收（浅色 1487×1058、1280×800、1024×720，深色 1280×800）。第十三次会话量完后又改了这些：
  - x 轴标签本地化：接口给的是 `MM-DD` / `YYYY-MM`，页面里 `formatTrendLabel` 转成「11月8日」「2026年1月」（图表和隐藏的数据表都用）。标题旁的日期范围小字去掉了，轴上已经说明了范围；CSV 里仍然导出日期范围
  - 环形图改成 `viewBox 0 0 100 100`、中线半径 38.6、线宽 22.8（外径撑满、孔径 54%，与原型一致），用 `flex: 1 1 0` 吃掉图例剩下的高度，上限 14rem。1487 宽时直径 224（原型 224），1280×800 时 133
  - 图表区 `min-height` 从 15rem 降到 13rem，1280×800 下整页刚好不滚（`scrollHeight == clientHeight == 581`）
  - 指标列左内边距 `clamp(space-8, 22%, space-16)`，1487 宽时文字距列左 64（原型约 92，按比例缩小后的值）
  - `accent` 标签轨道的内边距减掉 1px 边框，轨道高度 = 40，和导出按钮齐平；周期标签 `min-width: 3rem`
  - x 轴下方加 6px 刻度线，y 轴标签离轴 12px
  - 数值：1487 宽 指标行 `[128.8, 226.4, 1229.3, 98]`，左图 832.8 宽（67.7%）、右图 396.6，竖线在 961.6；1024 宽时指标 2×2、两张图上下堆叠，无横向溢出
  - 脚本：`/tmp/orange-resume/s13/shoot.{mjs,json}`、`analytics-metrics.js`

系统设置（规格 `04-05` §05、§E.3）
  第十四次会话的做法（先记在这，逐条勾）：
  - ODS `Tabs` 的 `rail` 变体删了，换成 `underline`（已完成，测试已过）：一条细线上的文字标签，选中项底部 3px 下划条；放不下就横向滚动，`data-fade="start|end|both"` 让被遮住的一侧渐隐；选中项自动滚进可视范围（只动标签条自己的 `scrollLeft`，不滚页面）
  - 页面：`PageHeader`（系统设置 / 管理账户和界面偏好）+ underline 标签，九个都保留，顺序改成 个人信息、安全设置、外观设置、通知设置、数据同步、用户管理、字典管理、开发设置、关于（原型露出的几个靠前）
  - 内容区不用 `Card` 和 `SectionHeader`，选中的标签就是标题。行式布局 `.settings-list` / `.settings-row`（标题 + 说明在左，控件在右，行间细线）给外观、账户、组件展厅、关于共用；表单宽度封顶 50rem
  - 外观：`SegmentedControl`（浅色 / 深色 / 跟随系统，`THEME_OPTIONS` 里「亮色」改名「浅色」并调顺序）+ 三个 `Switch` 行（`aria-labelledby` / `aria-describedby` 指到行内文字）+ 右侧静帧预览（`scene.webp` 裁切，夜雨主题盖 `--ods-color-scene-veil`）
  - 个人信息底部一行「当前账户」+「退出登录」（旧顶栏删掉后应用里已经没有退出入口）；开发设置底部一行「组件展厅」→ `/design-system`
  - **五个管理子面板（用户、字典、数据同步、通知、令牌）内部先不动**，它们顶部的 `SectionHeader` 和标签名重复，壳层做完后再决定要不要去掉
- [x] 加页头「系统设置 / 管理账户和界面偏好」；左侧竖向导航卡改成横向下划线标签，九个标签都保留，放不下就横向滚动
- [x] 内容区去卡片；外观页 = 界面主题分段（浅色/深色/跟随系统）+ 三个开关行 + 右侧场景预览
- [x] 个人信息里放账户退出；开发设置里放组件展厅入口
- [x] 浏览器数值验收（浅色 1487×1058、1280×800、1024×720，深色 1280×800）。量完后的调整和数值：
  - 外观页 1487 宽：列表 `[128.8, 283.4, 788.9, 423.2]`（原型 x 127–916、四行共 424 高），预览 `[957.7, 299.4, 400.4, 383.2]`（原型 401×370），预览顶和分段控件齐平、底在最后一条线上方 24px，都和原型一致
  - 外观页的行高是 `clamp(4.5rem, 10vh, 6.75rem)`：1058 高时 105.8（原型 99–107），800 高时 80，整页不滚。预览不写死宽高比，`align-self: stretch` 跟着列表高度走，`background-size: cover; background-position: 12% 0`，在原型比例下正好裁出原型那一块（场景 x 3%–77%）
  - `SegmentedControl` 的项高改成「控件高 − 8px」，整个控件 40 高，和按钮、分析页的周期轨道齐平
  - 个人信息表单改成三列（姓名、职位、部门 / 邮箱、手机），1280×800 下整页不滚；「关于」把版本和检测更新并进 logo 那一行，行高 48，1280×800 下不滚
  - 标签条：九个标签共 1024 宽，1280 宽时刚好放下（可用 1061）；1024 宽时溢出，`data-fade="end"` 生效
  - 脚本：`/tmp/orange-resume/s14/shoot.{mjs,json}`、`settings-metrics.js`；截图在 `s14/shots/`
- [x] 五个管理子面板去掉和标签重复的 `SectionHeader`（图标块 + 标题 + 说明）和三张统计卡，换成顶部一行 `.settings-toolbar`：左边 `<dl class="settings-stats">` 行内统计，右边搜索和主操作按钮
  - 用户管理：统计 + 搜索框 + 新增用户；用户卡片改 `variant="tertiary"`
  - 开发设置：有令牌时才显示统计；空状态里重复的「生成令牌」按钮删了
  - 通知设置：统计 + 发送通知（管理员）
  - 字典管理：顶部整块删掉，「新增条目」挪进右侧内容区的小节标题（`SectionHeader` 的 `actions`，标题级别改成 h2）
  - 数据同步：配置步骤不显示工具条；对比 / 同步步骤显示统计 + 修改配置
  - `settings.test.ts`：SectionHeader 计数 11 → 3，新增「不再有 `size="lg"` 的 SectionHeader、不再有 stat 卡、四个 toolbar」的断言
  - 列表本身（用户卡片、令牌卡片、通知卡片、字典条目、同步表格）结构没动
- [x] 第一轮子代理看图后改的：
  - 页面一级标题字重 700 → 900（新令牌 `--ods-font-weight-title`，`--ods-ref-font-weight-black`）。量过：原型标题的墨迹覆盖率 0.381、竖笔宽占字高 0.133；Songti SC Bold 是 0.301 / 0.081，Black 是 0.389 / 0.135。**这个改动作用于所有业务页的页头**
  - underline 标签条左右各留 `space-4`，第一个标签的下划条和页面标题左对齐（原型如此）；选中项不再加粗，只变色加下划条
  - `Switch` 关闭态轨道改用 `--ods-color-border-strong`（原来 12% 的着色在浅色面板和夜雨里都几乎看不见）；`lg` 尺寸改成 48×28，外观页的三个开关用 `lg`（原型 70×38，按字号比例换算约 48×26）
  - 行标题字重 500 → 400；账户行的说明只留用户名；个人信息那一行下面多余的细线去掉
- [x] 第二轮子代理看图后改的（代码和测试已改，**还没重新截图量过**）：
  - 列表里的删除按钮从实心红改成 `variant="ghost" tone="danger"`（用户、通知）和 `variant="outline" tone="danger"`（令牌）；ODS `button.css` 补了 outline + danger 的配色（之前这个组合没有样式，「退出登录」其实是黑字）
  - 开发设置：「组件展厅」从底部一行挪进工具条（`TokenManagement` 新增 `actions` 属性），原来在 800 高的窗口里要滚动才看得到
  - 数据同步：配置步骤去掉提示横幅和外层卡片 + 图标标题，改成一句说明 + 表单；对比步骤的连接卡片改 `tertiary`、明细去掉外层卡片和行内图标块、表格用 `variant="plain"`。**对比步骤要连上云端库才看得到，浏览器里没验过，只有单元测试**
  - 个人信息、安全设置、关于、同步配置的宽度从 50rem 改成和外观页左列同宽（`calc((100% - space-10) * 1.97 / 2.97)`），切标签时内容右边界不跳
  - `settings.test.ts` 的 SectionHeader 计数现在是 2
  - 没改的：面板底色与原型差 2–4 个亮度级（`#ebf2ed` 对 `#e7f2ec`），可以接受
  - 业务页面板四周的场景比原型暗（左侧窄条差约 28 级）：会话末尾加了一层雾。四张业务原型彼此一致，都是上半部的树和屋顶更淡、水面不变，所以不是整体提亮，而是新令牌 `--ods-color-scene-mist`（烟雨 `rgba(231,239,232,.3)`，夜雨透明）从顶部铺到 64% 高、到 84% 淡出（`scene.css` 里只对 `data-variant='business'` 生效）。和四张原型的平均值比：左侧 27.9 → 6.9，右侧 9.0 → 1.5，顶部 4.4 → 1.2；底部水面、面板与 Dock 之间、面板底色、Dock 都没变。工作台不受影响

  代码和测试已改完（`SettingsView.tsx`、`settings.css` 的页框 / 行 / 表单 / 外观 / 关于各段、`SettingsView.test.tsx`、`settings.test.ts`、ODS `Tabs` 与 `segmented-control.css`、`stores/theme.ts`）。tsc（app 配置）/ vitest（106 文件 488 用例）/ ESLint 全过。补充：
  - 预览图的裁切是算出来的：把原型里的预览区和 `scene.webp` 做归一化互相关（`/tmp/orange-resume/s14/ncc_preview.py`），峰值 0.79，对应场景的 x 3%–77%、y 0%–95.5%，换成 CSS 就是 `background-size: 135% auto; background-position: 12% 0`
  - 「关于」也改成行式：logo + 名称一行，下面版本（带检测更新）、作者、公众号、开源地址、技术栈各一行；logo 的呼吸动画删了
  - `SegmentedControl` 的轨道改成透明（和分析页的 `accent` 标签一致）；它目前只有设置页在用

登录与 404（规格 `06-07`）
  第十四次会话定的做法（先记在这，逐条勾）。两页共用一个壳：全屏清晰静帧（`scene.webp`，`background-size: max(120%, calc(100vh * 1.4055)) auto; background-position: 56% 40%`，规格 §1.1 算出来的裁切）+ 右侧一张磨砂卡片，不挂 Dock、不跑场景动画。
  - **卡片不用实时模糊。** 卡片里画的是预模糊的 `scene-business.webp`，用 `background-attachment: fixed` 和页面背景同一套裁切对齐，上面盖一层 `--ods-material-frost-veil`。原因：海棠角（规格 §1.2 的云纹角）要用 `-webkit-mask-box-image` 九宫格遮罩来裁，而 WebKit 的 `backdrop-filter` 不吃遮罩，四个角会露出方形的模糊块；预模糊图是普通背景，遮罩一定生效，也省掉一层实时模糊。副作用：卡片和它的祖先都不能有 `transform` 动画（会让 fixed 背景错位），进场只做透明度
  - 卡片是 ODS 新模式 `CloudPanel`（`patterns/cloud-panel`），不是页面 CSS：`legacyCssContract.test.ts` 不许 `login.css` 出现 `.login-card`。页面通过局部属性 `--cloud-panel-backdrop` 把预模糊图交给它（和 `--surface-radius` 同一个路数）
  - 新令牌：`--ods-material-frost-veil`、`--ods-material-frost-rim`（两套主题），`--ods-font-family-brush`（Kaiti SC → STKaiti → KaiTi → 宋体栈，不打包字体）、`--ods-font-family-numeral`（Baskerville → Didot → Georgia，404 的斜体数字）
  - 登录页按现有能力适配，**这些原型元素故意不做**：`进入演示`（没有演示模式）、`忘记密码`（没有自助重置，只有管理员能重置）、`安全连接已启用`（应用并没有计算或保证这件事，写上去是假话）。**两个复选框保留**（记住用户名在左、记住密码在右，正好是原型那一行一左一右的结构）：合并成一个「记住我」会让只勾了记住用户名的老用户在下次登录时被悄悄存下密码
  - 账号框的占位文字保留「用户名 / 邮箱 / 手机号」（后端 `FindByCredential` 三种都收），不写原型里的「账号」；输入框没有外部标签，用 `aria-label`
  - 主按钮沿用 ODS 的浅青底墨绿字，不做原型的中青实心白字（规范 §4.1 明确不用深色实心按钮，白字对比度只有 3.2–4.4）
  - 主题切换按钮、logo 和 Orange 字标去掉（原型没有）；深色主题靠 `--ods-color-scene-veil` 压暗同一张图
  - 404：`*` 兜底路由放在根路由下、`AppLayout` 之外。大号斜体衬线「404」+ 橙色笔触 + 楷体「页面走丢了」+ 两行说明 + `返回首页` / `返回上一页` + 底部一行「雨雾未散，路径可重寻」
  - 卡片里的梅枝和远山从原型里抠成带透明通道的 WebP（脚本放 `frontend/scripts/`），笔触是内联 SVG
- [x] 令牌 + `CloudPanel`（`patterns/cloud-panel/`：`CloudPanel.tsx`、`cloud-panel.css`、九宫格遮罩 `cloud-panel-mask.svg` / `cloud-panel-rim.svg`、测试）。Chromium 里量过：遮罩生效（`-webkit-mask-box-image-slice: 54 fill`、宽 36px），`mask-border` 在 Chromium 里还不认，靠带前缀的写法
- [x] 磨砂用的静帧 `scene-frost.webp`（320×228、模糊 5px、1 KB）加进了 `scripts/build-jiangnan-scene.py`；重跑脚本后另外三个产物的 MD5 没变
- [x] 登录页：`components/scene/ScenePage.tsx`（壳 + `BrushStroke`）、`styles/scene-page.css`、`LoginView.tsx` 重写了渲染部分（逻辑没动）、`login.css` 只剩表单排版。旧的 `login.test.ts` / `login.motion.test.ts` 删了，换成 `styles/scene-page.test.ts`（裁切一致、不许 transform、不许循环动画和实时模糊）。登录页现在有了窗口拖动区（复用 `app-titlebar-drag-region`，以前没有）
- [x] 404 页和路由：`NotFoundView.tsx`、`styles/not-found.css`、`routes.tsx` 加了 `*`。「返回上一页」只在应用内有上一页时才出现（读 React Router 写在 `history.state.idx` 里的深度）
- [x] 梅枝、远山：`frontend/scripts/build-scene-page-art.py` 从 `06-login.png` / `07-404.png` 抠出带透明通道的 `card-plum.webp`（180×160，8 KB）和 `card-hills.webp`（432×78，15 KB）。做法是按像素到玻璃底色的距离算 alpha，再把玻璃色反解出去。远山用 `mix-blend-mode: multiply` + `opacity: .7` 叠进玻璃：浅色下比直接叠更接近原型的深浅（最深处约 `#b9d5c1`），深色下变成暗一点的山影而不是一条发亮的白带。梅枝后面那片很淡的山影水印故意去掉了
- [x] 第一轮子代理看图后改的：
  - 卡片宽度从固定 27rem 改成 `clamp(27rem, 38vw, 33rem)`（1280 宽时 486、1542 宽时 528、1028 宽时 432）。原型卡片占窗口 42%，按 ÷1.5 的读法在默认窗口里只占 34%，偏小
  - 磨砂底色调到 `rgba(226,238,229,.74)`（后来为对比度改成 .76），实测玻璃 `#d7e3d9`（原型 `#d7e4db`）
  - 卡片内的控件不再是实色底：`CloudPanel` 的内容区把 `--ods-color-bg-surface` 重映射成新令牌 `--ods-material-frost-control`、把 `--ods-color-border-default` 重映射成 `--ods-material-frost-rim`（和 `Surface` 的 brand 变体重映射前景色是同一个路数）。实测输入框底 `#e6eee7`，原型 `#e7efe8`
  - 笔触颜色用新令牌 `--ods-color-accent-warm`（`--ods-ref-color-apricot-400`，`#e2a264`，两张原型笔触色的中间值），SVG 里用 `currentColor` 的线性渐变向右淡出
  - 标题字距 0.04em → 0.02em，字重保持 700（量过：原型墨迹覆盖率 0.242，Kaiti SC Bold 0.231，Black 0.277）
  - 404 数字字重 600 → 400、字号 6.25rem（量过：原型覆盖率 0.254，Baskerville SemiBold Italic 0.385，Italic 0.224）；笔触上移，紧贴数字
  - 404 的说明在逗号后用 `<br />` 断行（`text-wrap: balance` 会断在「回到」后面）
  - 磨砂上的文字对比度补了测试（`tokens/contrast.test.ts`：取 `scene-frost.webp` 右半边最暗 `(127,147,124)` 和最亮 `(226,232,225)` 两个像素当背景，卡片上的四种文字色和输入框里的两种都要 ≥ 4.5:1）。按它调了两处：烟雨的底色不透明度 .74 → .76；夜雨原来不过（说明文字 4.4、框内占位文字 2.8），改成底色 `rgba(27,44,38,.9)`、控件 `rgba(13,25,22,.28)`（夜雨里卡片内的预模糊图没有被压暗，所以底色要更实，控件是往下沉而不是往上亮）
  - 没改的：背景比原型灰、桥占得更宽。06/07 是另一幅画（规格 §1.1），用首页那张图只能对上人物和桥拱的位置，对不上比例和饱和度
- [x] 浏览器数值验收 + 子代理看图（两轮）。像素检查脚本 `/tmp/orange-resume/s14/check_card.py`：卡片角上 (3,3) 处的像素和隐藏卡片后的同一点一致（遮罩生效）；顶边亮度剖面是 2px 的亮边；卡片内空白条的行亮度和「隐藏卡片后的背景再高斯模糊 22px」的相关系数 0.997、斜率 0.24（= 1 − 0.74 的底色不透明度），说明磨砂图和背景对齐。**WebKit 里结果相同**（见验证环境）。1280×800 下卡片 `[799.4, 172.5, 432, 455]`、右边距 48.6；1028×630 下 `[556.9, 87.5, 432, 455]`（规格 ÷1.5 是左 560、宽 429）。脚本 `/tmp/orange-resume/s14/shoot-auth.{mjs,json}`、`auth-metrics.js`（**打印时别把 pane / rim 整个对象打出来，遮罩的 data URI 很长**）

子页面（项目详情、新建 / 编辑项目、添加收款、组件展厅；没有原型，第十四次会话加的）
  子代理看图的结论：这几页还是旧设计的样子，大写英文小标（`NEW PROJECT`、`STEP 01`、`PROJECT DRAFT`、`EMBER ORBIT · DESIGN SYSTEM`）、面板里再套带边框的卡片、图标色块。口径和四个主页面一样：去 eyebrow 和图标块，卡片换成细线和间距，功能和字段一个不动。
- [x] 添加收款页头里「所属项目」下拉被长项目名撑出面板（横向溢出 161px）。根因在 ODS：`.ods-field` 是没有列定义的 grid，隐式列按内容撑开。已加 `grid-template-columns: minmax(0, 1fr)`
- [x] 新建 / 编辑项目：去 eyebrow、`STEP 0N` 和图标块、`PROJECT DRAFT`、四个小节的说明句；表单卡和摘要卡改 `transparent`，小节之间细线，摘要栏左边一条竖线；底部吸附的操作条去掉 `backdrop-filter`，换成不透明的 `--ods-color-bg-canvas-subtle`
- [x] 项目详情：去 eyebrow，合同编号并进标题下那一行（客户 | 合同号 | 状态）；结算盘面卡片改 `transparent` 并去掉「● 项目结算盘面」小标；档案、下次收款、备注三张卡改 `tertiary`
- [x] 添加收款：外层卡片去掉；说明只在固定项目时显示项目名（有下拉时下拉自己就说明了）
- [x] 组件展厅：去 eyebrow，文案里的 Ember Orbit / 昼夜换成烟雨江南 / 烟雨与夜雨
- [x] 浏览器里量过、子代理看过（1280×800，两套主题）：没有 eyebrow、没有横向溢出。看图后又改了两处：
  - 新建项目页底部吸附的操作条原来停在滚动区内容框的底边，下面还露出一条 40px 的内边距，滚过去的内容从那里透出来。`WorkSurface` 现在把滚动区内边距公开成 `--ods-work-surface-padding-block` / `-inline`，操作条用 `bottom: calc(var(--ods-work-surface-padding-block) * -1)` 贴到面板底边
  - `Switch` 的滑块改用 `--ods-color-fg-brand-surface`（两套主题下都是浅色）。原来用 `--ods-color-bg-surface`，夜雨主题里关闭态的滑块和轨道、面板几乎一个颜色
  - 没改的：项目详情页里的小号等宽数字和时间线说明在夜雨主题下偏暗；项目列表最后一行被面板底边直接截断（正常滚动，没有做渐隐）

### 验证环境
- **WebKit 也要验。** 应用实际跑在 WKWebView 上，第十四次会话之前所有验收都只在 Chromium（ego lite）里做。现在有 Playwright 的 WebKit 26.0（`playwright install webkit`，装在 `~/Library/Caches/ms-playwright/webkit-2248`，Python 版 Playwright 1.58）。`python3 /tmp/orange-resume/s14/webkit_check.py light|dark` 会登录预览、逐页截图并存同一套 DOM 指标到 `/tmp/orange-resume/s14/webkit/`。脚本丢了重写也就四十行：`p.webkit.launch()` → `new_context(viewport=1280×800, color_scheme=…)` → `add_init_script("localStorage.setItem('theme', …)")` → 登录 → `goto` + `evaluate(指标脚本)` + `screenshot`。WebKit 和 Chromium 的几何值只差亚像素

- 预览前端：`cd frontend && npx vite --config vite.preview.config.mts --port 9321 --strictPort`
- 后端不要连用户的真实库。把库复制出来再起独立服务：
  `sqlite3 "$HOME/Library/Application Support/FruitsAI/Orange/orange.db" ".backup '/tmp/orange-resume/db/orange.db'"`，
  然后 `DB_PATH=/tmp/orange-resume/db/orange.db LOG_PATH=/tmp/orange-resume/db/orange.log API_SERVER_HOST=127.0.0.1 go run ./cmd/server`。
- 截图脚本 `/tmp/orange-resume/shoot.mjs` 读取同目录的 `shoot.json`，只落盘不回传图片：`ego-browser nodejs < /tmp/orange-resume/shoot.mjs`。

## 2. 踩过的坑

### 2.1 会话与工具

- **图片上限会直接杀死会话。** 推理网关单次请求最多带 8 张图片，请求体上限 32MB。读过的图片会一直留在上下文里，累计超限后每次请求都返回 400，会话只能放弃。这个重构任务已经因此中断四次。做法：
  - 能用数字验证就不看图：DOM 的 `getBoundingClientRect`、`getComputedStyle`，或者用 PIL 对截图做像素统计。
  - 必须看图时，把多张截图拼成一张对照图再看，单张长边压到 1600px 以内。
  - 成批的视觉比对交给子代理，让它只回传文字结论。子代理自己也受 8 张的限制。
- **单次请求超过约 5 分钟会被网关掐断**，表现为 `Request timed out` 或 `502 … peer closed connection`，客户端重试十次后放弃。第四次会话就是带着两张对照图做一次性大比对，连续十次都在 4–6 分钟处被断开。做法：把工作拆成小步，一次只写一个中等大小的文件或只做一件判断；大段视觉比对交给子代理。
- **不要先把所有资料读完再动手。** 第九次会话花了 1 小时 45 分钟通读四份规格、设计规范和现有页面，一行代码没改，然后在一次要规划全部工作的长思考里被网关掐断，重试十次都没过。做法：读一页的规格就改一页；每一轮只决定一件事；想清楚的结论马上写进本文件的清单，不要留在脑子里。
- **改完代码先记 HANDOFF，再去看图。** 第六次会话调了一轮玻璃材质，没记录就去读对照图，紧接着的请求被 502 掐断，下一次会话只能从会话记录里把改动考古出来。读图是最容易断的一步，读之前把已完成的改动和结论写进本文件。
- **主会话一张图都不要读。** 第十三次会话把数值验收全部做完并记好之后，只读了一张 199KB 的对照图（`s13/shots/sheet-analytics.jpg`），随后的请求连续十次在 5 分钟处被掐断，会话报废。带着图的请求思考时间最容易超时。做法：要看图就起一个子代理，给它图片路径和几条具体的是非题，让它只回文字；子代理断了主会话还活着。
- **同时跑四个子代理会触发网关 429**，子代理和主会话一起被限流。一次最多跑一到两个，并且要求子代理**先把交付文件写到磁盘再继续细化**，这样被掐断也不丢结果。
- **429 不只和并发有关。** 第十四次会话前七个子代理（一次一个）都成功，到第八、九、十个连续三次被 `429 rate_limit` 拒掉，中间隔了十几分钟也没用，像是按时间窗口算的用量上限。连着被拒两次就别再试了，把要看的图和问题留在本文件里交给下一次会话。
- 会话记录在 `~/.claude/projects/-Users-willxue-will-FruitsAI-Orange/*.jsonl`。应用里的会话事件列表只给工具名，要还原上次做到哪，用 `/tmp/orange-resume/dump.py <jsonl> <out.txt>` 导成文本再读。
- `python3 -I` 看不到用户目录里装的 scipy / numpy。自己工作目录里的分析脚本用普通 `python3` 跑。
- `rtk` 会把命令输出截到约 200 行。长文件用 Read 工具读，不要 `cat`。
- zsh 里 `echo ======` 会被当成 `=` 展开而报错，分隔符要加引号。grep 的 `--include='*.css'` 也要加引号。
- **`npx tsc --noEmit -p .` 什么都不检查。** 根 `tsconfig.json` 是 `files: []` 加 references，这条命令永远秒过。真正的类型检查是 `npx tsc --noEmit -p tsconfig.app.json`（或 `npm run build` 里的 `tsc --build`）。第十四次会话才发现，之前各次会话记的「tsc 通过」都是用错命令得来的；好在补跑后没有欠账。
- **用「从 A 标记切到 B 标记」的方式删代码前，先把这段打印出来看。** 第十四次会话删 `ProjectFormSectionTitle` 时，切片的终点选的是 `export default`，中间还夹着一个 `toPaymentPlanItem`，一起删掉了。这个仓库的工作区里有大量没提交的改动，删错的东西 `git checkout` 救不回来；这次是靠 `git show HEAD:` 和 `refs/backup/pre-jiangnan-ui` 两个版本里那段一模一样才敢原样补回。
- `AGENTS.md` 写的是 Vue 3，**实际前端是 React 19 + TypeScript + React Router 7 + Zustand + Tailwind 4**，视觉公共层是 ODS（`frontend/src/design-system`）。

### 2.2 浏览器预览

- **项目类型名称必须以系统字典为准。** 创建/编辑保存 `project_type` 的 `value`，详情若只维护固定四项映射，会对自定义类型（如 `medicine`）显示编码。详情要读取同一字典，优先显示 `label`，并兼容请求失败、已删除条目、旧值与路由切换；当前后端种子的 `web/mobile/design/saas` 也与旧前端默认选项不同。
- **改了 Go 代码要重启自己起的预览后端。** `go run ./cmd/server` 不会热重载；第十八次会话加了 `year` / `month` 参数后前端一直拿到全量数据，查了一圈才发现 3466 上还是旧进程。
- **别对整个 `src` 跑 `prettier --write`。** 仓库里有十来个历史文件本来就不符合 prettier（`src/api/*.ts`、`config/api.ts` 等），一跑就多出一堆无关改动；只格式化自己动过的文件。
- **WebKit 里 CSS `filter` 只在元素被提成合成层时才按设备像素渲染。** 静止的元素加了 `filter` 会按 1x 软件路径画，Retina 上发糊；同一个元素一旦在跑 opacity 动画就变清晰。无头 WebKit 截图复现不了。要么不用 filter，要么让元素始终在合成层上（`will-change`）。
- Remix 图标的 `<i>` 默认继承行高，盒子比字形高；放进 `inline-grid` / 固定宽高的容器里字形会往下溢出，看起来就是「图标比文字低」。全局规则在 `foundations/typography.css`，新写图标不要再单独设行高。

- **图生图会把整块区域重画**，不只是你要改的那只手：脸更清晰、色调偏一点、甚至自己加速度线。和原画逐帧交替一定会闪。做逐帧动画时所有帧都要出自同一张模型输出，头部等不动的部位用同一帧的像素锁住，背景按差值遮罩贴回原画，并先减掉未改动区域上量到的整体色偏。
- ODS `Select` 自带 `min-width: 12rem`，外层容器比它窄不会让它变窄，只会让它溢出去压住旁边的控件。
- 页面进场动画如果用 `animation-fill-mode: both` 且关键帧里有 `transform`，动画结束后元素仍然带着 transform，里面的 `position: sticky / fixed` 子元素会跟着错位。用 `backwards`。

- Wails 开发模式的 Vite（9245 端口）没有配置 API 基址，接口走 Wails 自己的资源服务器，所以在普通浏览器里打开 9245 登录不了。后端 3456 端口有 CORS 白名单，自己另起的端口不在名单里。
- 解决办法是 `frontend/vite.preview.config.mts`，它把 `/api` 代理到 `localhost:3456`：`cd frontend && npx vite --config vite.preview.config.mts --port 9321 --strictPort`。前提是 3456 上有后端在跑（`task dev` 或 `go run ./cmd/server`）。
- 本地开发账号 `admin` / `admin123`。
- ego lite 的 `Emulation.setDeviceMetricsOverride` 不会跨脚本保留，每段脚本都要重新设置视口。
- 主题默认是「跟随系统」，而系统外观是自动切换的，夜里截的基线图全是深色主题，颜色没法和浅色原型比。截图前在脚本里强制主题。
- 自动化浏览器的窗口不在前台时，`requestAnimationFrame` 会被节流到约 30fps。**不能用帧间隔判断渲染性能**，否则场景会被误降档。
- **截图的像素值是 Display P3 编码，不是 sRGB。** 直接拿截图和原型 PNG 比色，绿色会系统性偏灰（`#689b69` 读出来是 `#739a6e`），容易误以为令牌调错了。比色前先用 `/tmp/orange-resume/work/p3.py` 的 `p3_to_srgb` 还原：解 sRGB 伽马 → 乘矩阵 `[[1.2249401,-0.2249404,0],[-0.0420569,1.0420571,0],[-0.0196376,-0.0786361,1.0982735]]` → 再编码。还原后已知令牌色能精确对上。
- 用「低于某个亮度的像素数」比较字重和图标粗细会被背景亮度差带偏。要按局部背景亮度和墨色亮度归一成覆盖率再比（`ink_mass.py`）。

- **WebKit 里 `scrollbar-gutter: stable both-edges` 对 `overflow: auto` 不起「稳定」的作用**：只有出现滚动条的页面才留出两侧各 6px 的槽（`reset.css` 的 `::-webkit-scrollbar` 把滚动条固定成 6px 的经典样式）。结果是会滚动的页面（项目列表）标题比不滚动的页面（日历、分析）靠右 6px。Chromium 是叠加式滚动条，看不出来。已把 `.ods-work-surface__scroll` 改成 `overflow-y: scroll`，WebKit 里两类页面的标题都在 x = 131.5。
- **`position: sticky; bottom: 0` 在有内边距的滚动容器里停在内容框的底边**，不是容器的底边，下面会露出一条内边距那么高的缝。要贴到底就用负的 `bottom` 抵掉内边距（`--ods-work-surface-padding-block`）。
- `backdrop-filter` 不会被 `mask` / `-webkit-mask-box-image` 裁切，异形的玻璃面不能靠实时模糊做，见登录页的做法。

### 2.3 江南场景

- 原型 PNG 里烘进了 Dock、收款摘要和窗口按钮，不能整张当背景。无 UI 静帧由 `frontend/scripts/build-jiangnan-scene.py` 从 `docs/prototypes/01-workbench.png` 修出来，输出在 `frontend/src/assets/jiangnan/`。改原型后要重跑脚本。
- React StrictMode 下 effect 会执行两遍。场景运行时是异步启动的，已取消的那一轮如果仍然在同一个 WebGL 上下文上创建再销毁对象，画布会变黑。现在用 `AbortSignal` 阻止已取消的一轮创建 GPU 资源，并且 `render()` 每帧自己绑定 program、VAO 和纹理。
- 画质档位靠启动时实测单帧 GPU 耗时决定（`readPixels` 强制同步），不看帧间隔，原因见 2.2 最后一条。

### 2.4 ODS 契约测试

- 迁移契约禁止生产 TSX 出现原生 `button`、`a`、`input`、`table`、`dialog`、`img`，以及带 `onClick` 的容器。交互一律用 ODS 组件，缺的就在 ODS 里新增。
- 样式归属契约禁止页面 CSS 重绘 `.ods-*`。要换外观就改令牌或给 ODS 组件加变体。
- 新增令牌必须在两套主题里都定义，并登记到 `tokens.contract.test.ts` 和 `docs/design-system/tokens.md`。
- 页面 CSS 不出现十六进制色值，只消费 `--ods-*` 语义令牌。

### 2.5 Wails 开发启动与预览进程（2026-11-18）

- **独立预览后端与桌面应用默认都监听 `127.0.0.1:3456`，不能同时开启对外 API 服务。** 本次 `wails3 dev` 在 07:30:08 启动桌面应用时，旧的 `go run ./cmd/server`（使用 `/tmp/orange-resume/db/orange.db` 副本）仍占用 3456。真实应用日志明确记录 `External API server failed to start` / `bind: address already in use`，随后 `main.go` 的 `log.Fatalf` 让桌面应用退出。先用 `lsof -nP -iTCP:3456 -sTCP:LISTEN` 确认占用者；停止对应预览服务，或仅本次用 `ENABLE_API_SERVER=false task dev` 禁用桌面的对外 HTTP 监听（桌面内嵌 API 仍由 `createAssetHandler` 提供）。不要直接批量杀掉所有 Go/Node 进程。
- **Vite 的 `write EPIPE` 可能只是主应用退出后的连带错误。** 当前 Wails alpha.55 的 refresh v0.8.6 在子任务失败后取消共享 context 并关闭 stdout 读端，所以 npm / Vite 后续写日志会报管道错误。终端只有 `Could not refresh processes due to execution errors` 时，先查真实应用日志（默认 `~/Library/Application Support/FruitsAI/Orange/log/orange.log`），不要只看最后的前端堆栈。
- **npm 12 的安装脚本警告与安装退出码要分开判断。** 12.2.1 默认拦截未被 `allowScripts` 覆盖的依赖脚本；本次 esbuild / fsevents 的警告伴随 npm install 实际退出码 0，两者当前均可加载。隔离实验确认关闭 npm stdout 后也能出现 `exit 0 / info ok` 加 `npm error A complete log...`。若要审核并补跑依赖脚本，使用 `npm install-scripts approve esbuild fsevents` 再 `npm rebuild esbuild fsevents`；仅 approve 不会补跑，消除警告也不会解决 3456 冲突。
- 同一前端目录同时运行多个 Vite 实例会共享默认 `node_modules/.vite` 缓存。本次已有 9321 预览时另起 9245，依赖重新优化出现 `browserHash` 错误；验证另一个实例时应使用独立 `cacheDir`，不能据根页面 HTTP 200 宣称整个前端验证通过。
- 如果 `npx eslint src --max-warnings=0` 报 `could not determine executable to run`，先查 npm 日志中的实际 argv。本次实际被转成了 `npm exec ... src --max-warnings=0`（缺少 eslint），改用 `node node_modules/eslint/bin/eslint.js src --max-warnings=0` 后通过；不要把命令包装导致的参数丢失当成源码 lint 失败。

### 2.6 安装与自动更新

- NSIS `/D=` 必须是命令行最后一项，目录不包引号（NSIS 将余下整段作为路径）；调用用 ShellExecuteEx/进程参数，不经过 shell。静默更新在旧应用退出后进行，安装失败不能重启新程序。
- 更新成功前不退出当前应用；已校验安装包、暂存应用准备完毕且 helper 写就绪标记后，才交接正常退出。取消下载在解压/暂存后还要在锁内复查，防止取消与安装交接竞争。
- 回滚失败时暂存目录的 previous 可能是旧应用的唯一副本，清理不能删除它。测试用独立临时安装目录、TLS fixture 与注入的安装/重启函数，不替换用户真实应用或触碰真实数据库。
- 旧 Wails CLI 即使扫描成功也会报“application built with go1.25”与项目 go1.26 的版本警告。验证绑定时使用 Go1.26 重编译的固定 CLI（可用 `GOTOOLCHAIN=go1.26.0 go run github.com/wailsapp/wails/v3/cmd/wails3@v3.0.0-alpha.55 ...`），不要用 `go get` 将 CLI 的全部依赖写入应用 go.mod。
- Wails 开发 watch 会在 Go 源码修改后触发前端依赖重装，另一个 Vite 预览仍握着旧 chunk 路径时会报 `Cannot find ... vite/dist/node/chunks/dist.js`。不要停止用户的桌面 watch；页面 QA 可用冻结 production dist + 独立 Node 静态/API 代理预览，不再依赖被重装的 Vite。


### 2.7 珠算 1.0.0 发布准备（2026-11-19）

- 当前分支 codex/zhusuan-migration，PR #2 保持 draft。用户选择 1.0.0，但明确暂不合并或发布；不要创建 tag、运行 Release workflow 或触发 main 的 GHCR 发布。
- README/英文 README/CHANGELOG 与发布/迁移说明更新，九张截图在 docs/screenshots。先将隔离数据库副本的名称/客户/合同/人员/联系/备注脱敏，再截图；金额/比例与 77 项源账本核对不变。About 的个人介绍/作者/联系须 DOM 遮挡，品牌/repo/version 保留。六张旧 frontend/public 快照移除。根代理不读图，子代理 contact + 七原图验收无可见泄漏；工作台/登录只缩略图、详情/创建下方未验。
- 财务正数校验、显式逾期、结束日半开范围、SQLite 时区分组、合同金额/比例事务、父项目锁与鉴权查询 fail-closed 已修。所有款项写入及项目删除都先锁父项目，避免孩子先锁造成逆序；SQLite max1 池与 MySQL dry-run SQL 不是 MySQL/Pg 实机并发证明。
- 异步鉴权要按发起 Token 比对；永不复位的全局过期标志会让后续会话无法过期。CSV quoted 字符串仍可执行公式，转义前须区分字符串/真实负金额。
- 分期保存必须 allSettled 并保留已成功 ID/删除结果及 stable clientKey，重试不重复已确认成功项；服务端提交后响应丢失仍需要原子/幂等 API，不能把客户端账本说成原子保存。
- 使用统一 release.py 更新所有平台与 Go AppVersion，旧 bump_version.go 仅保留 wrapper。Android 版本编码必须在任何写入前校验；MSIX Version 正则须有词边界，不能替换 MinVersion。
- WebView2 bootstrap ExecWait 必须取退出码并重新检查 runtime，不能只下载/运行即报成功；项目自有 NSIS 函数在程序备份之前执行。macOS 本地 NSIS 使用 NSISDIR 指向临时解包 share/nsis，fixture 仅编译不执行。
- 前端生产 build 会重建/清空 frontend/dist，Go embed 的 test/build/lint 与它有依赖，必须顺序执行；一次并行 lint 因旧 dist 消失 typecheck 失败，待 build 完成后重跑。不停止用户3456/9245的 dev watch。此次自有3466/9331与 ego space6 在完成后关闭。
- 最终证据与真实平台未验边界见 docs/release-readiness.md：前端115文件591用例；Go136顶层140子测试/16包；race/vet、元数据11、actionlint、生产依赖audit0；真实安装/UAC/签名/完整更新/目标设备性能仍需平台验收。

- 最终相对 main 的增量 lint 发现 UpdateForUser 的事务闭包推高 gocyclo；将合同/比例保存事务提取为独立辅助函数后，service race 和增量 lint（0新增）通过。没有关闭规则或增加忽略。

- 完整 golangci 扫描仍有51历史告警（25 revive、9 errcheck、7 gofmt、4 goimports、3 goconst、2 gocyclo、1 staticcheck简化建议）；增量0不是全量0。主要关闭/cache错误返回值与样式命名基线已记入 release-readiness，未扩大无关重构。

- 最终CI在慢runner上新增重分期行为测试超过默认5秒，下一测试拿到前一个mockRejectedValueOnce队列：clearAllMocks只清调用计数，不清实现/once队列。应完整reset相关API mock、缩短非关键逐字录入并保留等待/断言，不能把这类污染当成产品保存回归。安全runner的APT准备曾停留十余分钟；CI/Release Linux依赖设置30秒连接超时、2次重试和10分钟步骤上限，避免无界等待。

- 取消的CI日志确认区域HTTP镜像 us-east-2.ec2.archive.ubuntu.com 下载69.9MB依赖在9分钟内仍未完成，并多次Ign重试。不能把“步骤仍运行”假设为代码编译失败。CI/Release共用 install-linux-deps.sh，临时runner镜像列表使用Canonical HTTPS、保留APT签名，--no-install-recommends减掉非构建必需推荐包；30秒超时/2次重试/10分钟步骤上限保留。

- 绿色安全job并不代表无漏洞：Trivy原exit-code0报告了24条可修复HIGH。已升级go-git5.19.2/go-billy5.9.0/x-net0.62.0及其MVS要求的crypto0.58/mod0.41/text0.43等，Go保持1.26.0；不要逐个硬钉扫描表的最小修复版本，x-net要求更高crypto/mod时会冲突。GOTOOLCHAIN=local会回到已安装1.25.5，检查兼容性应显式GOTOOLCHAIN=go1.26.0。Trivy HIGH/CRITICAL改为exit-code1门禁；Gosec SARIF16条规则提示与golangci配置扫描不同，已在release-readiness核查输入边界并保留报告，不能称全量扫描清零。

### 2.8 正式发布1.0.0（2026-11-19）

- 用户新授权覆盖2.7的暂不发布限制。仅发布v1.0.0；保留工作区已有design-qa.md删除，不纳入发布提交。不移动已公开的标签或覆盖公开Release；三平台失败时先定位CI，再按状态修复。
- 发布前更新CHANGELOG日期与README下载入口，安装包公开状态以Release页面为准。记录无Developer ID/公证与无Windows Authenticode的分发事实，不以ad-hoc构建声称已公证。

- 正式发布预检发现desktop Name=珠算会让AppImage输出中文文件名，Wails alpha.55却移动zhusuan-x86_64.AppImage，导致Linux包失败。create:appimage设置LINUXDEPLOY_OUTPUT_APP_NAME=zhusuan；保留菜单中文名。实际产物由Release runner验证。

- Windows smoke的Get-Item RegistryKey为只读，调用DeleteValue会UnauthorizedAccess并使Release失败；用Registry.LocalMachine.OpenSubKey(path,true)显式可写句柄并Dispose。只在干净CI runner的安装键操作，未在用户系统执行。

- Release44506289477的Linux失败确认npm ci与go mod tidy并行，重建node_modules时Go扫描到消失的JS目录并误查Go模块。构建改为只download/verify固定依赖；npm完成后才生成bindings；macOS两架构顺序构建避免共享输出竞争。应用源码及v1.0.0标签c3af8fe保持不变，通过Release手动输入已合入main的固定build_recipe_ref，仅覆盖四份Taskfile并在发行说明/manifest正文记录来源，避免移动公开标签。初次失败Release已取消，未公开任何半成品。

- Recovery44510099043 Windows CSS契约测试失败（590/591通过）来自Git core.autocrlf把原LF源码变CRLF，正则含\n}与\n\n未匹配。build checkout通过GIT_CONFIG_COUNT/KEY/VALUE仅此步骤禁用autocrlf，不改用户global git配置，也不改CSS或断言；隔离Git夹具复现旧CRLF并验证新检出逐字节保持LF。

- macOS Recovery已成功生成并ad-hoc签名universal二进制，却在lipo校验失败：-verify_arch会把后面的全部参数视作架构名，输入文件必须放前面。改为lipo bin/zhusuan.app/Contents/MacOS/zhusuan -verify_arch arm64 x86_64；不能以打包成功日志代替架构校验通过。

- Final平台构建44517508677的Windows安装smoke通过，但完整Go测试暴露POSIX权限、macOS WebKit/app archive场景误用于Windows，及日志夹具锁住TempDir清理。test_recipe_ref仅覆盖四份固定*_test.go；必须已合入main，发行Go/前端代码不替换，来源写入发行说明与manifest正文。保留WAL快照/旧库不覆盖/用户归属/回滚与native Windows profile断言；不将Unix模式位当Windows ACL验收，也不把Mac-only测试强跑Windows。

- 最终发布复用成功产物：Linux来自Release44517508677完整通过job；macOS/Windows来自44520956468完整通过job（Windows完整Go测试/安装smoke通过，仅Darwin WebKit专属fixture在Windowsskip）。均同应用tag c3af8fe、同构建配方8d49977；test夹具cc1ab8e，未替换发行应用代码。后续Linux两次依赖镜像10分钟超时，未反复重做已过平台。五文件SHA256与三份平台清单重新聚合，生成manifest、上传draft核对七附件名字大小后公开，再核对公开API所有SHA256及匿名下载。来源写入Release说明和update.json正文。
- 本地lipo对多架构verify参数与Xcode16.4工具解析不同，最终本地分别verify arm64/x86_64，archs确认两者，codesign --verify --deep --strict及plist1.0.0/新标识通过；不能把CLI参数不兼容误判成已生成fat binary缺架构。

### 2.9 macOS DMG打包（2026-11-19）

- DMG是手动安装主入口，包内Applications链接；必须拖出/Volumes到可写Applications后运行。1.0更新器只能解ZIP，新发布同时附两架构ZIP，resolver原有archZIP→universal→legacy顺序保留，并增加混合DMG/ZIP回归。
- build_macos_packages.py只改私有复制bundle，fat主exe按所选arch薄化后ad-hoc重签；校验bundle标识/版本/唯一架构/签名，创建UDZO HFS+ DMG，read-only mount检查应用与Applications链接并detach。实际两包通过，ARM39.5MB/Intel40.9MB；未挂载用户盘或替换真实应用。
- darwin:package改为DMG+ZIP，原bundle-only为package:app；CI显式调用后者再builder，避免重复生成/输出已存在失败。当前公开1.0仅append新DMG与独立清单，不覆盖旧公共产物/manifest。

### 2.10 珠算 1.0.1 接续验证（2026-11-19）

- 不能按聊天标题推断中断任务。原会话标题是项目类型/小天平，后续已追加 1.0.1 发布、DMG、图标/Windows路径、弹层和金额校验；`read_thread` 单个长turn输出巨大，应在工具编排内筛选用户消息、进度与尾部命令后再输出。
- 直接从仓库根运行 frontend 的 vitest 会找不到正确配置；始终在 `frontend` 目录运行。前端 build 清空 dist，Go embed 与其串行；先编译隔离预览server，再build前端，再执行Go测试。
- Icon Composer 仅透明fill仍可能给带留白的旧图套白/灰外层。必须用 NSWorkspace 实际渲染确认；本次采用无fill并调整图层scale，原始PNG保持不变。旧Xcode使用预编译Assets.car时，校验必须同时包含源PNG和icon.json，单独PNG哈希不能检测布局变化。

- Linux旧CI连续卡在Canonical逐包超时；改为命令级临时deb822 sources（Azure→Canonical），不写/etc，继续Signed-By。APT update默认可能部分失败仍exit0，必须Error-Mode=any。先download-only再no-download安装，把网络timeout限制在dpkg之前；两次50s索引+130s下载、180s安装及kill grace总预算565s，低于job10分钟。stub6项通过不是runner实机验证。

- 金额输入失焦不能直接Number(value).toFixed(2)：>=1e21会变科学记数且大整数丢精度；本次用字符串补零保持草稿数值文本。通知详情padding随内容滚动不能保证底部视觉留白，给滚动viewport外固定24px底margin。截图须等入场动画/Toast结束，不能拿过渡态当验收图。

- 1.0.1首轮Release44562497173 Windows安装编译、默认路径/HKCU/中文名/快捷方式存在检查通过，但WScript.TargetPath直接字符串比较失败，原日志未打印实际值，不能归咎产品。smoke路径必须展开环境变量、规范化长短路径后严格比较目标目录并核对文件摘要，同时输出raw/expected诊断；test_recipe_ref只增加此固定smoke fixture，应用tag0959eb1不移动。

- 恢复run44564873938确认WScript读取Desktop/珠算.lnk的TargetPath为空，排除长短路径表示差异；切换原生IShellLinkW+IPersistFile Unicode读取并保留raw/二进制/flags/Shell.Application诊断，严格目标路径/摘要断言不放松。macOS该run全通过，正式artifact两DMG/ZIP已本地再挂载签名、目录、版本/架构和原生图标检查。Linux该run在取消测试manager_test.go232竞态失败，首轮Linux产物全通过已保留。

- 取消下载EOF竞态已用可控Body.Read稳定复现：Cancel/Close后返回EOF，旧产品报下载不完整。manager.runUpdate失败分支同时检查ctx.Err取消，未取消的完整性错误保留；普通/race定向各count100=1300通过，完整updater race81通过。此为产品修复，不能当fixture覆盖原应用源码；v1.0.1尚未公开，最终更新候选标签后统一重建，公开1.0.0不动。

- WindowsCheck44568004757原生IShellLinkW验证桌面/开始菜单中文快捷方式完整路径和hash正确，WScript空值是假阴性。后续smoke真实发现显式/D被覆盖：NSIS Main.c已截去$CMDLINE中的/D（官方var.but明确），用GetOptions $CMDLINE检测永远失败，会继承已注册默认路径。需改为基于NSIS预置INSTDIR或读取未截断OS命令行后再决定是否注册发现，不能删该断言。

- /D真实修复：InstallDir头保持空，.onInit只在INSTDIR为空时设置LOCALAPPDATA默认/查询新注册；NSIS预置的显式/D非空保留。源码确认EXEDIR回填仅卸载器分支，故installer可可靠区分。新增普通/UPDATE两种显式Orange目录拒绝、原注册不变、实际exe落指定目录断言；NSIS隔离编译通过。

- 最终Release44571413947 Windows与Linux全job通过，macOS排队15分钟后GitHub自动cancel；annotation明确The job was not acquired by Runner of type hosted... / macOS arm64 capacity constraints，runner_id0无步骤。这不是构建失败。保留同176c9780的两平台artifact，改Intel macOS runner专用workflow验同tag后聚合，不重复已过平台。

- IntelMacCheck44576400310源身份/工具检查成功，前端597/598通过，必填新增用例5069ms触发默认5s（无断言错误）。专用4核Intel runner限制Vitest maxWorkers=2，保留全部用例/断言/5s门限，避免jsdom并发争用；不据此改产品或候选tag。

- Intel44579095153两worker仍593/598，4个交互超时和CalendarView加载aria-busy=true时findByRole默认1s耗尽；其余日期格式通过，不是日期偏移。针对固定3个测试优化夹具输入/语义查询并给多交互流程预算，专用Macworkflow仅覆盖这3个已审test文件、记录fixtureSHA，应用源码tag176c不变；绝不把所有失败泛称产品通过。

- macOS旧Xcode Assets.car重编可能因内部时间戳变成相同尺寸不同hash，dev watch会重新生成；发行复验必须比git show <应用tag>:...，不能拿工作区未提交生成物当正式来源。公开前验证十附件server digest后再draft=false/latest，匿名latest和旧版本不可变性均需发布后再读。

### 2.11 Windows普通安装与自定义标题栏（2026-11-20）

- 管理员GitHub runner上的安装成功不证明普通用户能双击。应读取实际PE manifest，并在同SID、MediumIL、管理员组deny-only且HKLM写被拒绝的真实token里先无参数显示welcome，再静默安装/卸载。SmartScreen/MOTW和用户接受UAC与此分开验。
- Wails alpha.55 frameless仍有WS_CAPTION/WS_OVERLAPPEDWINDOW，通过WM_NCCALCSIZE移除系统标题栏；不能用stylebit无caption断言。应核client/window上沿几何和真实边缘拖动。该版本自动5px边/15px角resize，不读最新版--wails-resize。Snaphover布局未实现，不声称支持。
- 自定义系统窗口操作控件也须走ODS ownership，新增ODS WindowControlButton；页面CSS不能覆盖IconButton外观，也不能绕过Image契约原生img。已有契约抓到后已改为正式组件，未加例外。

- Windows新检查首次Chocolatey feed504（未构建），第二次restricted worker0xC0000142（未运行安装器）。STARTUPINFO显式winsta0/default后真实同SID Medium token成功；TokenElevation元数据true不能说false，实际isAdminfalse和HKLM写拒绝才证明无管理员能力。最终44640534380普通欢迎窗/安装卸载和原生全屏等全通过。

- 升级SDK/工具不能盲上与项目平台不兼容大版本：TS7超出最新typescripteslint peer<6.1，选TS6.0.3；Node24选types24.19.2；Go1.27最低macOS13，维护Go1.26.11保实际支持Monterey，原10.15虚标校正为12。应用/测试可达依赖均latest，不把上游CLI不可达工具图硬钉成业务依赖。

- Wails3.1 Linux默认GTK4/WebKitGTK6而旧alpha使用GTK3/WebKit4.1，升级CI44659618563类型检查准确失败缺gtk4/webkitgtk6pkgconfig。必须同步CIdev包与nfpm运行依赖，不能只在Mac/Win编译过称全平台。新Actions上传/下载/SARIF已实测通过。
