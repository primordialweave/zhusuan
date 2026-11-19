# Changelog

## [Unreleased]

## [1.0.1] - 2026-11-20

### Fixed

- **更新取消**：下载读取与取消同时结束时，优先保留“已取消”状态，避免误报安装包不完整；取消不会启动安装助手。

- **macOS 图标与名称**：应用显示名和应用包名称统一为“珠算”，Finder 和 Dock 共用透明青瓷算盘图标。
- **Windows 安装**：修正安装器与快捷方式中文乱码；首次安装使用当前用户的 `%LOCALAPPDATA%\PrimordialWeave\zhusuan`，保留旧 Orange 程序，仅复用已有珠算安装目录；用户安装和机器安装分别按原范围更新。
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
