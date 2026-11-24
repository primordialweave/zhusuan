# 全局代码审查 — 2026-11-24

复审起点为 `976e2c7` 加审查时已存在的68项未提交/未跟踪记录。审查覆盖前端、Go 后端/数据库/同步、Wails 桌面生命周期、图标和安装构建、Docker Compose 与发布配置。原审查在源码副本中复现了11项问题，后续按本文“修复结果”完成实现与回归；没有覆盖或还原其他在制修改。

## 发现（复现前状态）

### P1：MySQL 同步的自然键冲突会改写并随后删除其他云端行

`ON DUPLICATE KEY UPDATE` 会处理任意唯一索引冲突，而不只匹配 `id`。同步器随后仍按本地 ID 集合清理云端额外行。因此，若本地 `users.id=2, username=admin`，云端已有 `users.id=99, username=admin`，UPSERT 会更新 ID 99 的自然键冲突行，但 `DELETE ... WHERE id NOT IN (2)` 随即删掉 ID 99。两条 SQL 均成功时，同步可以报告成功而云端用户消失。`users.username`、`dictionaries.code` 和关联表的复合唯一键都受影响。

代码位置在 [`sync.go`](/Users/willxue/will/primordialweave/zhusuan/internal/service/sync.go:629) 的 MySQL UPSERT 以及 [`sync.go`](/Users/willxue/will/primordialweave/zhusuan/internal/service/sync.go:546) 的 ID 记录/清理。已在隔离 MySQL 8.4.3 实例复现，测试数据位于独立临时 datadir/socket，测试后正常关闭并清理。

### P2：云同步确认文案没有明确告知云端独有行会被删除

确认框说明同 ID 行会更新，但同步器会删除所有选中表中 ID 不存在于本地的云端行。若本地可选表为空，云端该整表会被清空。界面称同步为单向上传，仍没有明说这些云端独有数据会删除。连接过含独立项目、令牌、通知的目标库时，用户确认后可能丢失本地没有的云端数据。

代码位置在 [`DataSyncPanel.tsx`](/Users/willxue/will/primordialweave/zhusuan/frontend/src/components/settings/DataSyncPanel.tsx:217)、[`sync.go`](/Users/willxue/will/primordialweave/zhusuan/internal/service/sync.go:481) 和 [`sync.go`](/Users/willxue/will/primordialweave/zhusuan/internal/service/sync.go:490)。

### P2：macOS 登录项待授权标志会在紧接着的状态读取时丢失

SMAppService 注册成功但需要用户在系统设置批准时，`platformSetAutostart` 临时返回 `RequiresApproval=true`。`updatePreferences` 随后调用 `getState()`，常规状态函数没有传递该状态，OS 的 `Enabled=false` 会把已保存的 `Autostart` 改回 false，返回时只恢复本次响应中的授权标志。后续读取状态后设置页不再显示“登录项授权”按钮，用户无法从该行继续批准。

位置在 [`autostart_darwin.go`](/Users/willxue/will/primordialweave/zhusuan/internal/desktop/autostart_darwin.go:40)、[`manager.go`](/Users/willxue/will/primordialweave/zhusuan/internal/desktop/manager.go:678)、[`manager.go`](/Users/willxue/will/primordialweave/zhusuan/internal/desktop/manager.go:779) 与 [`DesktopSettingsPanel.tsx`](/Users/willxue/will/primordialweave/zhusuan/frontend/src/components/settings/DesktopSettingsPanel.tsx:216)。用临时 Go overlay 回归复现了保存状态被清除和下一次 `GetState()` 丢失授权提示。

### P2：macOS 隐藏与恢复窗口并发时，Dock 图标可能最终保持隐藏

`HideWindow` 先在锁内把 `dockHidden` 设为 true，之后才隐藏窗口并调用 `setDockVisible(false)`。如果其间另一个快捷键调用 `ShowWindow`，后者会先恢复 Dock，然后较早的 `HideWindow` 仍可晚到并再次隐藏 Dock。overlay 回归得到调用顺序 `[true, false]`，最终状态为窗口可见而 Dock 仍隐藏。

位置在 [`manager.go`](/Users/willxue/will/primordialweave/zhusuan/internal/desktop/manager.go:519) 和 [`manager.go`](/Users/willxue/will/primordialweave/zhusuan/internal/desktop/manager.go:545)。

### P2：窗口隐藏会关闭原生关闭询问标志，但不会关闭前端弹窗

原生端在 `HideWindow`、窗口显示事件和普通 `GetState()` 中重置 `closePromptOpen`。前端只在 `resolveClosePrompt` 时将 `closePrompt.open` 设为 false；可见性事件只更新 `windowHidden`。用户先点击关闭看到询问，再通过全局快捷键隐藏并恢复时，旧询问仍留在主窗口上，前后端状态不一致。

位置在 [`manager.go`](/Users/willxue/will/primordialweave/zhusuan/internal/desktop/manager.go:549)、[`manager.go`](/Users/willxue/will/primordialweave/zhusuan/internal/desktop/manager.go:664) 与 [`desktop.ts`](/Users/willxue/will/primordialweave/zhusuan/frontend/src/stores/desktop.ts:109)。

### P2：隐私模式切换会把分析趋势图重建为空图

`initCharts` 将 `privacyMode` 加入依赖。切换隐私模式会销毁并创建 Chart，新图的 `labels` 和 `datasets[0].data` 初始为空。负责将已加载趋势填进图表的 effect 依赖不包含 `privacyMode`，因此隐私模式单独变化时不会重填数据，也不会再次请求趋势。

位置在 [`AnalyticsView.tsx`](/Users/willxue/will/primordialweave/zhusuan/frontend/src/views/AnalyticsView.tsx:433)、[`AnalyticsView.tsx`](/Users/willxue/will/primordialweave/zhusuan/frontend/src/views/AnalyticsView.tsx:501) 和 [`AnalyticsView.tsx`](/Users/willxue/will/primordialweave/zhusuan/frontend/src/views/AnalyticsView.tsx:572)。隔离 Vitest 复现了原有数据 `[1200]` 在隐私开关变化后变为空数组。

### P2：MSIX 打包任务指向仓库中不存在的 Wails 配置文件

Windows MSIX 任务固定传入根目录 `wails.json`。干净仓库没有该文件，且没有前置任务生成它；Wails 打包器会直接返回配置文件读取错误。普通 NSIS 发布流程不走该任务，所以其发行检查不会覆盖这个受支持的格式。

位置在 [`build/windows/Taskfile.yml`](/Users/willxue/will/primordialweave/zhusuan/build/windows/Taskfile.yml:134)。Wails v3.1.0 的 MSIX 工具读取传入的 `ConfigPath`，当前 [`build/config.yml`](/Users/willxue/will/primordialweave/zhusuan/build/config.yml) 存在但任务没有使用。

### P2：默认 SQLite Compose 部署仍要求 MySQL profile 的 root 密码

`docker-compose.yml` 中 PostgreSQL/MySQL 服务的变量插值使用必填运算符。即使这两个服务 profile 未启用，Compose 仍在解析配置时检查这些变量。以仅配置生产 JWT 和 SQLite 默认值执行 `docker compose config --quiet`，报缺少 `DB_PASSWORD`；补上该值后仍报缺少 `MYSQL_ROOT_PASSWORD`。与 `DB_TYPE=sqlite` 的默认运行方式和 `.env.example` 的可选数据库密码不匹配。

位置在 [`docker-compose.yml`](/Users/willxue/will/primordialweave/zhusuan/docker-compose.yml:64) 与 [`docker-compose.yml`](/Users/willxue/will/primordialweave/zhusuan/docker-compose.yml:86)。

### P2：下拉菜单内按 Tab 会返回触发器，而不是移到下一个控件

新增 Tab 处理调用 Popover 的 `close()`，该方法始终把焦点异步送回触发器。因此在对话框中从菜单项按 Tab，菜单会收起但焦点停回触发器，下一个控件需要再按一次 Tab 才能到达。

位置在 [`Dropdown.tsx`](/Users/willxue/will/primordialweave/zhusuan/frontend/src/design-system/components/dropdown/Dropdown.tsx:105) 与 [`Popover.tsx`](/Users/willxue/will/primordialweave/zhusuan/frontend/src/design-system/components/popover/Popover.tsx:96)。隔离组件测试复现焦点未落到后续按钮。

### P3：云端计数查询的任意错误会显示成“未建表”

`CompareData` 把所有远端 `COUNT(*)` 错误，包括权限和查询失败，都压成 `RemoteCount=-1`。前端把所有 `-1` 显示为“未建表”，并将该结果集视为有效对比，按钮仍可启动同步。权限配置问题和真实缺表因此无法区分。

位置在 [`sync.go`](/Users/willxue/will/primordialweave/zhusuan/internal/service/sync.go:197) 与 [`DataSyncPanel.tsx`](/Users/willxue/will/primordialweave/zhusuan/frontend/src/components/settings/DataSyncPanel.tsx:540)。

### P3：用户表同步漏掉 `last_login_time`

用户模型及自动建表 DDL 含 `last_login_time`，但 `syncTableColumns` 和 `userSyncValues` 均未包含它。其他用户字段会镜像，最后登录时间却长期留在云端旧值。

位置在 [`sync.go`](/Users/willxue/will/primordialweave/zhusuan/internal/service/sync.go:21)、[`sync.go`](/Users/willxue/will/primordialweave/zhusuan/internal/service/sync.go:290) 和 [`sync.go`](/Users/willxue/will/primordialweave/zhusuan/internal/service/sync.go:515)。

## 修复结果

- **MySQL 同步安全性**：改为 `UPDATE ... WHERE id = ?`，通过仅用于同步的 `ClientFoundRows` 检查主键是否存在，对不存在的 ID 执行普通 `INSERT`。自然唯一键冲突或并发插入冲突会使同步事务回滚。隔离 MySQL 8.4.3 测试覆盖自然键冲突保留远端 ID 99、同 ID 更新、新 ID 插入、无变化重同步、额外行清理、空业务表镜像清空和真实缺表错误。
- **同步范围告知与错误分类**：确认框写明云端独有行会被删除、空的可镜像业务表会清空远端、核心用户和字典表为空会中止。Compare 仅把 MySQL 1146 和 PostgreSQL 42P01 识别为缺表，其他查询错误返回对比失败。`last_login_time` 已纳入用户同步列、DDL 和行值映射。
- **macOS 生命周期**：授权待批准写入持久化标志并在授权成功或用户关闭开机启动后清除。窗口/Dock 转换和 Dock 偏好变更统一串行，原生可见性在取得转换锁后重查，以忽略已过期的隐藏/显示事件。关闭询问状态不再被 `GetState` 消费，通过 revision 事件、窗口可见性事件和启动状态快照同步前端。
- **前端**：隐私状态变化重建趋势图后重新应用已加载的数据，更新 Tooltip/轴文字脱敏且不重新拉取 API。Dropdown 的 Tab/Shift+Tab 在关闭菜单后移到相邻控件，在对话框内循环。
- **安装及 Compose 配置**：MSIX 使用已有 `build/config.yml`、`zhusuan.exe` 和 Windows 图标源，Task dry-run 已确认参数。Docker Compose 的 SQLite 默认 app 配置不再因未启用的 PostgreSQL/MySQL profiles 强制缺少数据库密码，`.env.example` 说明启用相关 profile 所需密码。

## 验证

- 最终工作树 `npm run test:run` **134文件、994项通过**，ESLint 零警告，`tsc --build`、私有 outDir 生产 Vite 构建通过。Go race 全包18个有测试的包通过，另9个包无测试文件；原生及 Windows/Linux 交叉 `go vet` 通过。Python 工具测试 **55项通过、1项平台跳过**，含新增 MSIX/Compose 配置回归2项。
- MySQL 原生唯一键冲突使用私有服务器和 schema 完成端到端复现及回归。Compose 5.2.0 在无数据库 profile 凭据时解析 `app` 配置通过，MSIX Task dry-run 使用现存配置和 EXE 路径通过。Ego Lite 用隔离 SQLite 账本显示非空分析趋势，并实测 Dropdown 前进/后退 Tab 焦点移动。
- MySQL 回归场景在隔离 MySQL 8.4.3 上通过。未提供 PostgreSQL 实例，因此其数据库集成未运行，缺表和权限错误码由驱动错误单测覆盖。当前没有 Docker daemon，未运行 Compose 服务；没有 Windows 主机，未构建实际 MSIX 或执行 Explorer/DPI 对照。macOS Login Items 授权状态只由隔离状态机测试复现和验证，没有切换真实系统设置。
- 全量 Go 测试首次运行时有一个通知测试仍断言管理员只能看本人收件箱，与此前已存在的管理员查看全部通知实现不一致。已更新该回归到管理员/普通用户既定可见范围契约，最终全量 Go race 通过。
- 全工作树 `git diff --check` 仍被生成绑定中的文件末尾空行与行尾空格拦截，报告与 HANDOFF 自身的作用域检查通过。Vite 构建仍显示约1MB启动 chunk 的既有体积警告。

QA 临时 API 使用 `/tmp/zhusuan-regression-20261124`，SQLite 文件、生成凭据和服务已清理；Vite 与 API 仅使用临时端口9380/3498，均已退出。没有修改真实账本或已安装应用。本工作区保留先前未提交修改，本轮未提交或发布。
