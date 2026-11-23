# Changelog

## [Unreleased]

## [1.4.0] - 2026-11-23

### Added

- **桌面常驻与快捷操作**：菜单栏 / 系统托盘、可选开机与静默启动、关闭行为选择、窗口记忆、全局快捷键、Windows JumpList 与 Linux 桌面快捷操作。
- **macOS 速览浮窗**：菜单栏提供周期收款趋势、合同已收/待收、逾期与临期事项以及快捷入口，跟随当前风物和明暗外观。
- **本地提醒与备份**：可选每日收款提醒、SQLite 一致性快照与自动轮转，支持立即备份和打开目录。
- **六套风物主题**：四季、春节和中秋场景；支持浅色、深色、跟随系统与离线季节/节庆自动切换。
- **状态多选**：项目列表可按多个状态合并筛选，新增可复用 MultiSelect 和设计系统展示示例。

### Fixed

- 用户资料和通知对象保存后即时回显；输入控件关闭非必要的系统补全，保留明确的登录/验证码功能。
- 旧登录、周期、分类、分页和原生状态响应不会覆盖新状态；卸载后的确认不会继续发起写入。
- 修复非法项目地址、日期边界、分页溢出、禁用数值控件，以及合同超收抵消待收的问题。
- 原生摘要校验 JWT 和当前账号，修复跨用户导入关联、缓存竞态、DSN 转义与初始凭据并发发布。
- 备份不覆盖同时间快照或误删手工文件，系统设置失败时恢复原设置，窗口恢复检查可见拖动区域。
- 隐藏窗口在场景图片异步初始化期间也停止装饰动画，冷静默启动使用原生可见性状态。
- Linux 包保留桌面快捷操作，监控错误率/P99使用正确聚合；完善构建敏感文件排除和工具错误处理。

### Changed

- 合并重复同步与原子文件写入流程，清理无引用构建任务，统一类型、命名和项目指南。
- 新风物按需加载；相同依赖下启动 JS/CSS 压缩体积相对1.3.1约增加23.7KB，字体资源不变。

### Compatibility

- 保留历史账本、凭据、数据目录和旧 Orange 路径迁移。提醒、备份、全局快捷键默认关闭；托盘不可用时不隐藏主窗口。
- 原生会话调用与本版本前后端同步更新；实际系统集成能力按 macOS、Windows、Linux 区分。

## [1.3.1] - 2026-11-22

### Fixed

- **首页合同范围**：每次进入工作台默认展示全部合同，旧本年、本月选择不再覆盖默认范围；已收、未收文案随全部、本年、本月同步变化。
- **首页范围提示**：饼图悬浮提示改用统一的自定义 Tooltip，保留鼠标、空格和回车切换及键盘焦点。
- **分析页指标分隔线**：移除“合同未收”左侧多余竖线，仅在两列指标之间保留分隔。

### Changed

- **玉手镯环图**：修复纯色描边覆盖 SVG 渐变，柔化圆管内外边缘，移除硬亮带并增加局部抛光高光与透光回照；已收、未收比例和统计口径保持一致。
- **仓库维护**：移除已停用的本地 Claude 技能文件，不影响应用运行和发行包。

## [1.3.0] - 2026-11-22

### Added

- **逐笔实际收款**：项目可先创建，到账后再录入每笔金额、实际日期、方式及可选分类；历史未确认记录保留原状态。
- **签约周期合同统计**：首页点击切换全部、本年、本月签约合同；分析页合同总额、合同已收、合同未收、收款率与导出按签约日期归属，统计这批合同截至现在的余额。实际到账金额、笔数和趋势使用独立的自然周期口径。
- **macOS 图标偏好**：浅色、深色与跟随系统可独立于页面主题实时切换 Dock 图标；网页 favicon 同步外观。原生调用串行追赶最新选择，失败可重试，无轮询。

### Changed

- **首页摘要**：仅显示合同已收与合同未收，移除重复的底部累计收款行；饼图、鼠标及键盘切换使用同一周期响应。
- **品牌资源**：统一 Web 图标引用，清理旧 Orange 图像副本，字标改用英文文件名；README 使用深浅双态 banner。
- **Windows 图标**：专用派生图的主体占比调整至约93%，补齐13个常用 DPI 图标帧，并在构建时校验来源与生成规则。

### Fixed

- **合同编号**：空编号保存时自动生成，连续创建不再撞空字符串唯一索引；保存回显保留编号，避免部分失败重试时更换合同号。
- **编辑日期与重试**：统一年月日提交格式，不重新选择日期也能保存；保留成功记录，只重试失败项，并显示具体失败原因。
- **收款顺序**：详情、编辑及导出按实际到账日期升序、同日 ID 升序；部分保存补齐 ID 后重新排序，最近收款仍显示最新一笔。
- **合同余额**：未收与超收逐合同计算，超收不抵消其他合同未收；本期没有签约合同但收到旧合同款时，实际现金仍显示。
- **Windows 升级资源**：刷新桌面、开始菜单和任务栏图标，补齐 FileVersion 字符串与数字产品版本，保留正确中文名称及原安装目录。

### Compatibility

- 历史计划和缺少实际日期的已确认收款保留；缺签约日期的合同只计入全部范围，不虚构年月。不变更旧数据目录或凭据迁移规则。
- Windows/Linux 原生图标继续使用打包资源；本版本的实时原生图标选择支持 macOS。新源码与安装包重新验收，已公开的 v1.2.0 标签和附件保持不变。

## [1.2.0] - 2026-11-22

### Added

- **玉质图标与品牌空态**：移除 Remix Icon 字体依赖，引入全套自研 SVG 玉质图标（`JadeIcon`）与 10 组算盘玉珠空态插画（`EmptyScene`），并新增按钮涟漪、玉光扫过及 13 类语义部件悬停微动效（完整适配 `prefers-reduced-motion` 与应用内减少动效）。
- **macOS 深浅双态图标**：新增与浅色 A2 像素级 1:1 对齐的深色夜雨翡翠图标，通过 Apple Icon Composer `image-name-specializations` 编译进 `Assets.car`，并纳入校验摘要与自动化测试。

### Changed

- **品牌视觉焕新**：应用图标升级为青玉槽、五颗透光翠玉珠与暖琥珀金珠构图（A2），同步全平台桌面与移动图标；关于页「珠算」字标重塑为温润翠玉浮雕质感，容器背景改用语义令牌适配烟雨/夜雨双主题。
- **全组件与图表玉质打磨**：收口设计系统内部剩余原生按钮与文本符号（弹层、抽屉、提示、数字输入、列表框、日历、代码片段、分页），统一系统设置行操作按钮语义层次；优化首页收款饼图、数据分析折线图发光轨迹、玉手镯立体空心环图及项目回款完成度进度环。

### Fixed

- **减少动态效果**：应用或系统开启减少动态时，立即停止正在播放的按钮与图标动效；动画结束、取消及组件卸载后释放监听。
- **环图与图标状态修复**：修复数据分析环图单弧近零偏移导致的圆心错位弧环、项目详情「下一笔计划」完成态图标被拉伸及遗留 `> i` 样式失效，并修复 `JadeIcon` 导出完成动效在中途切换路由后残留隐藏状态的问题。

## [1.1.0] - 2026-11-21

### Added

- **加载体验**：数据页面、项目表单、设置和通知使用对应结构的 Skeleton；减少动态效果时显示静态占位，已有数据的同范围刷新保持可见。
- **选择器**：选中后悬停将箭头切换为清除按钮，支持键盘与触摸；必填校验和固定值设置保持原规则。
- **关于配置**：通过 `APP_SLOGAN` 和 `APP_WECHAT_PUBLIC_ACCOUNT` 配置简介与公众号名称，鉴权接口仅返回版本及公开品牌信息。

### Changed

- **品牌与图标**：使用玉雕珠算字标和帝王绿翡翠算盘图标，统一桌面与移动脚手架资源。
- **玉质界面**：圆点、面板、按钮、输入框、开关和浮层增加柔和高光与圆润层次，保持烟雨/夜雨布局；项目详情操作按钮增加浅玉背景。
- **依赖与配置**：纳入主分支的 Go 1.26.11、Wails 3.1、React 19.3 和 Vite 8 等依赖更新，部署与监控模板同步珠算标识。

### Fixed

- **收款统计**：收款率、结构与导出按本期计划批次已收计算，包含跨期到账；实际收入趋势继续使用实际到账日期，不把口径差额计为欠款。
- **加载范围**：切换查询或页码不再回显旧范围数据，失败结束骨架并可重试；未知个人资料不显示保存操作，分期草稿与手动登录输入保持不被迟到请求覆盖。
- **接口文档**：运行时 Swagger 模板与 JSON/YAML 同步公开配置接口、Bearer 鉴权及计划已收字段。

## [1.0.2] - 2026-11-20

### Fixed

- **Windows 安装启动**：已有系统级珠算安装时自动按需请求管理员授权，保留安装目录和参数，避免普通双击在欢迎页前静默退出；全新用户目录安装继续使用普通权限。
- **Windows 窗口**：系统标题栏替换为透明自定义拖动区域，仅右上角保留四个小胶囊按钮，提供最小化、最大化/还原、全屏和关闭；F11切换全屏，Esc退出并恢复原窗口。

### Verification

- Windows 真实同用户 Medium token 验证普通无参数启动显示欢迎窗、安装与卸载；原生鼠标键盘验证拖动缩放、最大化/还原/最小化、全屏、F11/Esc和关闭。安装器无 Authenticode；下载保护提示与真人UAC交互仍需设备验收。

## [1.0.1] - 2026-11-20

### Fixed

- **更新取消**：下载读取与取消同时结束时，优先保留“已取消”状态，避免误报安装包不完整；取消不会启动安装助手。

- **macOS 图标与名称**：应用显示名和应用包名称统一为“珠算”，Finder 和 Dock 共用透明青瓷算盘图标。
- **Windows 安装**：修正安装器与快捷方式中文乱码；首次安装使用当前用户的 `%LOCALAPPDATA%\PrimordialWeave\zhusuan`，保留旧 Orange 程序，仅复用已有珠算安装目录；用户安装和机器安装分别按原范围更新；显式 `/D=` 自定义路径保持优先。
- **弹层**：令牌生成与首页通知限制在窗口范围内；长令牌可换行，通知详情增加内边距、固定高度与正文滚动。
- **项目表单**：合同总额和收款金额使用普通输入框，仅允许数字与最多两位小数；必填项显示中文错误、红框并聚焦首个错误字段；提示组件移除左侧粗竖线。

### Changed

- **macOS 打包**：分别生成 Apple Silicon（arm64）与 Intel（amd64）DMG 安装器，含 Applications 安装快捷方式；同架构 ZIP 保留为自动更新载荷，继续兼容 1.0 更新器。
- **发布校验**：新版本必须包含两个 DMG 与两个架构 ZIP；按架构验证应用标识、版本、签名并只读挂载检查 DMG，缺包即停止发布。
- **Linux CI**：官方镜像有界切换，保留签名校验；完整下载后才进行本地安装，避免镜像超时中断打包。

## [1.0.0] - 2026-11-19

### Added

- **更新**：桌面应用内检测新版本、下载进度、取消、SHA-256 校验、安装与重启；发布流程新增静态 `update.json` 与完整资产摘要。
- **迁移**：首次以新身份启动时迁移旧 Orange 默认数据库、保存的登录信息及必要外观偏好；新数据优先，原记录保留。
- **统计**：工作台支持全部、本年、本月摘要；数据分析支持自然年、自然月与自选年/月。
- **导出**：项目列表和详情共用完整项目/收款 CSV 导出；桌面端通过原生保存对话框写入文件。
- **图标**：提供青瓷算盘图标及统一生成脚本，覆盖 macOS、Windows、Linux、Web、iOS 和 Android 资源。

### Changed

- **品牌**：项目改名为珠算 / zhusuan，仓库迁入 `primordialweave/zhusuan`，更新应用、凭据、安装与数据目录标识。
- **界面**：以 React 19 与 ODS 重构工作台、项目、收款日历、分析、设置、登录及未找到页，使用烟雨/夜雨主题与青绿色语义令牌。
- **布局**：收紧页面密度，项目列表固定标题、表头与分页，设置使用分类导航；新建/编辑项目提供草稿摘要及分期金额核对。
- **动态**：江南场景增加水面、柳枝、雨丝与人物反馈，支持减少动态效果、关闭场景动画及玻璃材质。
- **打包**：三个桌面平台先构建与校验，再统一上传草稿并核对完整资产后公开；macOS 使用 universal 包，Windows 支持继承旧安装位置及静默覆盖更新。
- **版本**：统一前端、后端、Wails、Apple plist、Windows 文件资源/MSIX、Linux 与 Android 的 1.0.0 元数据。

### Fixed

- **Linux 打包**：固定 AppImage 输出名称，中文应用菜单名不再导致构建工具找不到产物。
- **依赖安全**：升级 go-git/go-billy 与 Go 扩展库至兼容 Go 1.26 的修复版本；CI 将有修复版本的 HIGH/CRITICAL 依赖漏洞设为阻断门禁。
- **项目类型**：详情从系统字典读取名称，兼容自定义类型、历史值与字典请求失败；新增页金额核对图标使用系统青绿色。
- **金额**：拒绝零、负数及非有限金额，合同总额变更时同步重算分期比例；收款写入先锁定父项目再更新汇总，统一事务锁顺序。
- **日期与统计**：显式逾期款项计入待收/逾期；日期范围包含结束日全天；SQLite 按业务日期分组，避免带时区时间戳跨日错位。
- **登录**：过期处理按会话去重，旧请求不会覆盖或退出新会话；短暂网络失败保留当前登录；账号状态查询故障返回临时服务错误，不回退旧权限。
- **保存**：详情和编辑加载失败可重试，数据未就绪时禁止保存；多笔计划保存保留已确认成功的项目/款项 ID 及删除结果，重试跳过未修改的成功项并保留继续编辑的输入。
- **收款选择**：固定项目按 ID 直接加载，通用选择器按需搜索与分页，不再漏掉前 100 项以外的项目。
- **CSV**：对可能被电子表格解释为公式的字符串做转义，金额保持数值。

### Removed

- 旧顶部导航、鼠标追光及冗余页面副标题，重复摘要实现和旧页面样式。

### 升级与分发说明

- 从 Orange 升级：先退出旧应用。Windows 安装器继承旧安装位置；安装后以原用户启动珠算，迁移旧默认数据并保留原库。尚不支持自动更新的旧版需先手动安装一次珠算。
- macOS 同时支持 Intel / Apple Silicon，包采用 ad-hoc 签名，未做 Developer ID 签名与公证；Windows 安装器未配置 Authenticode 签名。首次打开可能需要在系统安全设置中允许运行。
- 本次分发 macOS、Windows amd64 与 Linux amd64 桌面包；iOS/Android 仅保留脚手架和资源。
- 多请求保存只跳过已收到成功响应的记录；响应丢失仍需核对账目。系统接受应用重启后，新进程初始化失败不在当前自动回滚范围。完整说明见 [发布说明](https://github.com/primordialweave/zhusuan/blob/v1.0.0/docs/release.md) 和 [发布检查](https://github.com/primordialweave/zhusuan/blob/v1.0.0/docs/release-readiness.md)。

## [0.7.2] - 2026-02-05

### Changed

- **UI**: 统一了项目管理、用户管理、通知中心的分页组件样式，实现了智能页码折叠逻辑。
- **Refactor**: 优化了分页计算逻辑，支持大量页码时的可视区域动态调整。

## [0.7.1] - 2026-02-02

### Changed

- **UI**: Improved "Developer Settings" UI with better layout, icons, and responsive design.
- **UI**: Enhanced token list display with "Active" and "Revoked" sections.
- **Sys**: Added `personal_access_tokens` table to Data Sync service for cloud synchronization.

### Fixed

- **API**: Fixed token list caching issue by adding timestamp parameter to requests.
- **UI**: Fixed missing icon in "Revoked Tokens" section.

## [0.7.0] - 2026-02-02

### Added

- **Feature**: Implemented Personal Access Token (PAT) system for external API access.
  - Added "Developer Settings" tab in System Settings.
  - Added Backend support for Token generation, hashing, and management.
  - Added new API endpoints: `/api/v1/tokens` (Create, List, Revoke, Delete).
- **Network**: Added support for external API access via a dedicated HTTP server (Default port: 3456).
  - Port is configurable via `API_SERVER_PORT`.

### Fixed

- **Internal**: Fixed user association issue when creating tokens.

## [0.6.2] - 2026-02-01

### Fixed

- **UI**: Fixed login and registration page input icons visibility in dark mode (forced white color and z-index).
- **UI**: Fixed alignment of icons in registration form (restored absolute positioning).

## [0.6.1] - 2026-02-01

### Changed

- **UI**: Added global scrollbar styling with theme-aware colors (light/dark mode support).
- **UI**: Enhanced form input focus states for dark mode with proper background color.

### Removed

- **Login**: Removed WeChat and Apple social login buttons from the login page.
- **Login**: Cleaned up commented-out "back to home" button code.

## [0.6.0] - 2026-01-27

### Added

- **UI**: Implemented "Living Light" interactive cursor effects, adding dynamic ambient lighting and specular reflections to the background and glass cards.

### Changed

- **UI**: "Ultra-Deep Liquid Glass" aesthetic overhaul.
  - **Sidebar**: Enhanced active states with "Neon Prism" glow and "Liquid Metal" logo shimmer.
  - **Header**: Redesigned dropdowns with deeper glass material and "Shift" hover effects.
  - **Global**: Refined glass materials, button physics, and input focus states ("Breathing Neon").

### Fixed

- **UI**: Fixed toast notification disappearance animation glitch by enforcing container constraints and optimizing transition properties.

## [0.5.0] - 2026-01-25

### Added

- **Data Sync**: Implement database synchronization feature (SQLite to PostgreSQL/MySQL).
- **Settings**: Add Data Sync management panel with connection test and data comparison.
- **Backend**: Add `SyncService` for handling data synchronization logic.

### Changed

- **UI**: Refine settings panel layout and table styles for better consistency.
- **UX**: Improve loading indicators with animated Remix Icons.

### Fixed

- **Sync**: Fix "append-only" sync issue by implementing "Mirror" mode (automatically delete orphaned cloud records).

## [0.4.1] - 2026-01-25

### Fixed

- **Dashboard**: Fixed percentage precision issue - trend percentages now display with 2 decimal places instead of excessive precision (e.g., `328.57%` instead of `328.57142857142856%`).
- **Analytics**: Unified percentage precision to 2 decimal places for all trend indicators in the Analytics view.

### Changed

- **Projects**: Payment records in project detail view are now sorted by plan date in descending order (newest first).

---

## [0.4.0] - 2026-01-13

### Added

- **Multi-Database Support**: Added support for MySQL and PostgreSQL in addition to SQLite (default).
- **Auto-Create Database**: MySQL/PostgreSQL databases are automatically created on first connection (configurable).
- **SSL Configuration**: Added `DB_SSL_MODE` option for cloud database connections (Nile, Supabase, AWS RDS, etc.).
- **New Config Options**: `DB_AUTO_CREATE` to toggle automatic database creation for local vs cloud environments.

### Changed

- **Documentation**: Updated README (CN/EN) with comprehensive multi-database configuration guide.
- **Configuration**: Expanded `.env.example` with new database options and detailed comments.

---

## [0.3.1] - 2026-01-12

### Added

- **Validation**: Implemented comprehensive format validation (Email, Phone) across Registration, Profile, and User Management modules.
- **Validation**: Added strict username validation rules (lowercase start, alphanumeric, max 10 chars) for User Management.

### Changed

- **Dashboard**: Optimized "Upcoming Payments" display to show only the top 3 most recent items.

## [0.3.0] - 2026-01-12

### Added

- **User Management**: New admin-only module for creating, editing, and managing system users.
- **UI**: Added visual separators to modal headers in Settings.

### Changed

- **UI**: Refined modal styles for Notifications and Dictionary Management to align with the global design system.
- **UI**: Unified form styling across "New Project", "User Management", and "Notification" modals (input styles, dark mode adaptation).

### Fixed

- **UI**: Fixed disappearing select arrows in dark mode for all settings modals.
- **Performance**: Fixed user list not refreshing immediately after creating a new user.

## [0.2.2] - 2026-01-11

### Added

- **Components**: Enhanced `DatePicker.vue` with Year and Month selection views for quick navigation (similar to Element UI).

### Changed

- **Projects**: Added comprehensive date validation when creating/editing projects (Start <= End, Contract <= Start, Contract <= Payment).

## [0.2.1] - 2026-01-11

### Changed

- **Documentation**: Enhanced `README.md` and `README_EN.md` with visual interface previews (Dashboard, Projects, Analytics, etc.).
- **Chore**: Removed `.env` file from version control (added to `.gitignore`) to prevent sensitive configuration leakage.

### Added

- **Dashboard**: Added trend calculation for Overdue Amount (month-over-month).
- **Analytics**: Implemented dynamic trend prefixes (e.g., "Compared to last week/month/quarter/year") based on the selected time period in the Analytics view.

### Changed

- **Dashboard**: Optimized the trend calculation logic for the main statistics cards to display month-over-month comparison trends instead of all-time trends.
- **UI**: Updated the dashboard statistics cards to interpret the trend values as "Compared to last month" and explicitly display this text.

### Fixed

- **CI**: Fixed Windows installer path in GitHub Actions workflow to ensure artifacts are correctly uploaded to Releases.
- **Documentation**: Added detailed Chinese comments to `.github/workflows/release.yml` for better CI/CD process understanding.

## [0.1.9] - 2026-01-11

### Changed

- **Documentation**: Comprehensive addition of Chinese comments across the entire frontend codebase (Views, Components, Stores, APIs) to improve maintainability and code readability.
- **Documentation**: Added detailed comments to `main.go` and `scripts/bump_version.go` to explain application initialization and release processes.

## [0.1.8] - 2026-01-11

### Fixed

- **UI**: Fixed sticky "Action" column in Project lists for better horizontal scrolling.
- **UI**: Fixed "Project Name" width (200px) and added text truncation in Project Management and Dashboard tables.
- **UI**: Resolved visual glitch in "Action" column by enforcing correct background color in Dark Mode.

## [0.1.7] - 2026-01-10

### Added

- **Robust Logger**: Implemented a production-grade file logging system using `Uber Zap` (high performance) and `Lumberjack` (log rotation).
  - Logs are stored in `log/orange.log` alongside the database.
  - Supports automatic rotation (10MB limit, keep 5 files, 30 days retention).
  - Captures `slog` output (Gin, GORM, system logs) automatically.
  - Configuration added to `config.json` / env vars (`LOG_PATH`, `LOG_MAX_SIZE`, etc.).

## [0.1.6] - 2026-01-10

### Fixed

- **Critical**: Replaced CGO-based SQLite driver with pure-Go driver (`glebarez/sqlite`). This resolves the "Binary was compiled with 'CGO_ENABLED=0', go-sqlite3 requires cgo" panic on Windows.

## [0.1.5] - 2026-01-10

### Added

- Added debug logging: `orange_debug.log` will be created in the user's home directory to diagnose startup issues.
- Added panic recovery to check for crashes on Windows.

## [0.1.4] - 2026-01-10

### Changed

- Updated "About" page styling: fixed reversed dark/light mode card backgrounds and refined visual hierarchy for tech stack badges.
- Temporarily hid the global search box in the header.

## [0.1.3] - 2026-01-10

### Fixed

- Resolved CORS issues in "Check for Updates" by proxying requests through a new backend endpoint `/api/v1/system/updates/check`.

### Changed

- Parameterized GitHub repository URL for update checks, allowing configuration via `GITHUB_REPO` environment variable.

## [0.1.2] - 2026-01-09

### Added

- Added `.github/workflows/release.yml` for automated multi-platform releases.
- Configured `.gitignore` to exclude `.agent` directory.

## [0.1.1] - 2026-01-09

### Added

- Implemented "Check for Updates" feature in Settings that compares local version with GitHub latest release.
- Added `scripts/bump_version.go` to automate version management across configuration files.
- Added `bump-version` task to `Taskfile.yml`.

### Changed

- Refactored notification detail modal in `SettingsView.vue` to use shared `NotificationDetailModal` component.
- Updated styling for notification details (spacing and layout).
- Updated system version to 0.1.1 across all platforms (macOS, Windows, Linux).
- Modified `SettingsView.vue` to dynamically display version from `package.json`.

### Fixed

- Fixed `Taskfile.yml` syntax error.
- Resolved build error in `StatCard.vue`.
