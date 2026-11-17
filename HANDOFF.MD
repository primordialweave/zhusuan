# HANDOFF

接手任何任务前先读这份文档。它只记两类东西：**当前在制品的状态**，和**已经踩过的坑**。踩到新坑就追加到第 2 节，状态变了就改第 1 节。

## 1. 当前任务：烟雨江南界面重构

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
  - **WebKit 截图还没有人眼看过。** 对照图已经拼好放在 `/tmp/orange-resume/s14/webkit/sheet-webkit-{light,dark,closeups}.jpg`，会话末尾连续三次起子代理都被网关 429 拒掉（主会话已经连续跑了八个多小时）。数值上 WebKit 和 Chromium 一致，下次会话一开始先把这三张图交给子代理看
  - 浏览器：九个页面在 1280×800 下浅色、深色各过一遍（Chromium 和 WebKit），面板和 Dock 位置一致、没有横向溢出。WebKit 里用鼠标点 Dock 把五个入口走了一圈：没有控制台或页面错误，工作台摘要显示真实金额，场景的 WebGL2 和 Canvas 2D 两层都在跑（`/tmp/orange-resume/s14/webkit_idle.py`）。之前 `webkit_check.py` 报的三条 `due to access control checks` 是脚本自己在请求没回来时就 `goto` 刷新造成的，等网络空闲再跳就没有。**没在 Wails 打包后的真实窗口里看过**，这一步只能用户自己跑 `task dev`
- [x] 2026-11-18 提交前重新验证：`npm run build`（含 `tsc --build`）、`node node_modules/eslint/bin/eslint.js src --max-warnings=0`、`npm run test:run -- --reporter=dot`（107 文件、497 用例）通过；`go test -mod=readonly -count=1 -json ./...`（14 个有测试包、75 个顶层测试及 103 个子测试、0 失败/跳过）、主程序临时 `go build -mod=readonly` 通过。构建仍有主 JS chunk 超过 500 KB 的提示，测试仍有 React `act` 和 Wails 浏览器环境提示；本次未补做真实桌面 Keychain 或窗口验收。
- [ ] 还没做、留给下一次的（都不挡事）：
  - 设置页五个管理面板里的列表本身（用户卡片、令牌卡片、通知卡片、字典条目）还是卡片，只把外框减轻了
  - 项目详情页内部的排版没按新风格重做，只去了 eyebrow 和卡片底色；小号等宽数字在夜雨主题下偏暗
  - 数据同步的「对比 / 同步」步骤没在浏览器里验过（要连一个云端库）
  - 登录页背景比原型灰、桥占得更宽（06/07 是另一幅画，没有可用的素材）
  - 2026-11-18 用户授权提交全部当前代码，按三个主题整理：登录凭据存储（`d575353`）、统计时间范围修复（`6c63e2f`）、烟雨江南界面重构（提交号见 `git log`）。切分支前的混合改动已一并纳入对应主题，原始快照 `refs/backup/pre-jiangnan-ui` 保留。

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
