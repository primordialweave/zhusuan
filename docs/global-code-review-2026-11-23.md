# 全局代码审查与修复 — 2026-11-23

本轮审查覆盖当前工作区的前端、Go 后端、原生桌面服务、构建/发布工具、数据库参考文件及监控配置。以权限、账款、事务、异步生命周期和真实调用关系为重点，直接修复确认的问题。审查前冻结源码与既有改动，最终检查使用独立源码/依赖副本、独立账本和配置目录；没有提交、发布或操作真实账本。

## 已修复的问题

| 领域 | 原问题与结果 | 主要位置 |
| --- | --- | --- |
| 原生鉴权 | 桌面摘要只接收用户 ID，缺少登录凭据校验。现在要求匹配的 JWT，复用当前启用账号校验；令牌更新、账号切换及旧验证响应有代际保护。 | `internal/desktop/manager.go`、`internal/middleware/jwt.go`、`DesktopBridge.tsx` |
| JWT | 原解析允许其他 HMAC 算法或缺少有效期/正数身份的载荷。限定 HS256、有效期及正数 ID，保留旧版合法发行者的迁移兼容。 | `internal/pkg/jwt/jwt.go` |
| 账款归属 | 不一致的导入关联可能把其他项目的收款带入列表、详情或统计。查询增加同属用户约束；按合同分别计算未收，超收不抵消其他合同未收。 | `internal/repository/payment.go`、`project.go`、`internal/service/dashboard.go` |
| 同步事务 | 某些表成功后，后续失败导致整体回滚，却仍返回前表成功/数量。回滚时统一标为失败并归零，不回传驱动细节；六套循环合并，SQL 每表构建一次。 | `internal/service/sync.go` |
| 数据库连接 | PostgreSQL 凭据/主机转义和 MySQL IPv6 拼接不正确。共享驱动兼容的 DSN 构造器，覆盖常规连接、建库和同步；保留 Unix socket。 | `internal/database/dsn.go`、`database.go` |
| 缓存与退出 | 初始化可能重复创建实例及清理协程，字节切片共享，重复关闭不安全。初始化和关闭可并发/重复调用，缓存拥有独立数据，应用退出释放资源。 | `internal/pkg/cache`、`internal/middleware/ratelimit.go` |
| 初始凭据 | 随机源失败回退固定值，覆盖既有文件可能保留宽松权限或跟随链接。随机失败终止；完整 0600 文件原子发布，仅在成功写入用户/字典的事务内发布，失败或竞争者不覆盖赢家凭据；发布失败回滚，提交成功后才记录用户创建完成。 | `internal/database/seed.go` |
| 原生异步状态 | 旧会话/周期快照恢复过时金额；偏好并发更新互相覆盖。摘要有会话/请求代际校验，使用当前隐私设置；偏好更新及其 OS 效果串行。 | `internal/desktop/manager.go`、`menubar.go`、`MenuBarPopoverView.tsx`、`stores/desktop.ts` |
| 原生副作用回滚 | 通知授权错误仍启用提醒，保存失败或开机启动失败后留下新快捷键/系统设置。授权失败不保存；失败时尝试恢复原设置，恢复错误明确记录；每日提醒并发防重。 | `internal/desktop/manager.go`、`scheduler.go` |
| 自动备份 | 同一时间点覆盖快照，轮转会误删相似名称文件，并忽略删除失败。使用私有唯一暂存目录，拒绝覆盖，严格匹配日期命名，保留刚创建快照，失败返回错误；手工/定时备份串行。 | `internal/desktop/backup.go` |
| 窗口恢复 | 原先只检查窗口主体，可能恢复出不可见的拖动区域。现在同屏检查可见拖动条并保留主体可见高度，覆盖负Y和最大化边框。 | `internal/desktop/tray_format.go` |
| 文件持久化 | 偏好及两平台启动项重复实现临时文件流程。合并到统一的写入、权限、sync、关闭和原子发布 helper，保留各类最终权限。 | `internal/desktop/atomic_file.go` |
| 前端登录 | 旧登录覆盖新账号，登出后迟到登录恢复会话。请求代际与登出失效保护阻止旧响应。 | `frontend/src/stores/auth.ts` |
| 前端列表/确认 | 字典/通知变更完成后刷新旧分类/分页；卸载后的确认继续提交，同步完成后继续过期对比。刷新当前查询并检查生命周期，保留在途请求结果的隔离。 | `frontend/src/components/settings` |
| 深链与输入 | 非正数/NaN 深链导致无限骨架或误入通用收款页；Field 禁用时 NumberInput 加减按钮仍可写。共用正整数解析，显示明确地址错误；加减按钮继承禁用。补齐 API 的 overdue 状态类型。 | `utils/routeId.ts`、项目相关视图、`NumberInput.tsx`、`api/project.ts` |
| 更新/导出 | 原生 URL opener 之前缺少 URL 约束，多个桌面检测实现不一致。检查 HTTPS 和无用户凭据；共用运行时识别，历史类型路径重导出 canonical API。 | `utils/appUpdater.ts`、`csv.ts`、`rememberedLogin.ts`、`types/project.ts` |
| 参数/迁移工具 | 非正数 ID、超大分页 offset，反向项目日期，更新遗漏状态；索引工具使用旧字段/表并吞错。输入在写前拒绝或安全规范化，遗漏状态保留现值，工具使用真实 SQLite 模型且失败报错。 | `internal/pkg/response`、`internal/service/project.go`、`cmd/migrate` |
| 构建上下文 | 多种 env、SQLite WAL/SHM、初始凭据可能进入 Git/镜像导出缓存。完善排除，保留 Git 中的 `.env.example`。 | `.gitignore`、`.dockerignore` |
| 监控 | 默认端口向全网发布；错误率把请求次数/秒当比例，P99未按实例聚合。默认 loopback，配置/日志只读，正确比例/聚合，持久化 Promtail 位置并修正 Loki ruler/存储配置。 | `docker-compose.monitoring.yml`、`monitoring` |
| 工具/注释 | CI 环境隐式授权修改 Xcode/模拟器；SDK文件误作目录，版本读取失败误报；版本字段缺失时已修改部分文件。改为明确授权、真实目录检查及先验证全部元数据。修正 React/Vitest、随机凭据、缓存和监控说明。 | `build/*/scripts/deps`、`scripts/release.py`、`AGENTS.md`、相关文档 |

## 精简、目录与命名

- 删除 `build/ios/app_options_default.go`、`build/ios/app_options_ios.go`：`modifyOptionsForIOS` 只出现在这两个定义中，主入口及生成任务均未引用/复制。
- 删除未被生产源码、HTML、依赖、CI 或文档调用的 Puppertino 下载/改写任务；前端已有 ODS。
- 合并六组同步循环、三处桌面原子写入；抽出 PAT 处理、收款赋值、同步分发、更新取消等明确流程。修正导入分组和有误的注释/错误处理。
- 保留 Orange 兼容符号链接、迁移命名和原生绑定名称。`frontend/src/types/project.ts` 保留为 canonical 类型重导出，避免维护重复定义。
- Go lint 排除第三方 node_modules，不修改安装依赖。Go `./...` 仍可发现依赖内 Go 文件；CI 已采用自有包范围，最终隔离检查不包含这些安装源码。

## 验证结果

| 检查 | 结果 |
| --- | --- |
| 前端全量测试 | 133 文件、973 项通过；失败/跳过 0 |
| Go 全量 race | 20 个测试包、270 顶层测试、266 子测试通过；失败/测试跳过 0 |
| Python 工具 | 44/44 通过 |
| Prometheus | 真实 promtool 语法检查及 6 个行为夹具组通过；原错误率/聚合规则先复现失败 |
| 静态/构建 | 前端 ESLint 0 警告、TypeScript/生产构建成功，Go vet 与 Windows/Linux 交叉 vet 成功 |
| 已知依赖漏洞 | npm audit 0；govulncheck 无当前代码可达的漏洞 finding |
| 实际接口 | 非正数 ID 返回400，反向日期写入拒绝，超大分页安全回退；多状态12条、5条分页正确，30条隔离项目未被验证写入改变 |
| Ego 页面 | 非法详情/编辑/固定收款地址显示错误并提供返回入口；项目状态并集及分页显示正确，稳定截图复核 |

前端基线939项通过，新增行为回归后973项通过。Go、前端、移动辅助脚本和告警均保留 RED 与最终通过日志；中途工具路径/夹具错误没有计入通过。最后补齐 overdue 类型后再次通过 TypeScript；窗口和并发播种回归补齐后重新运行完整 Go race/vet/交叉检查。凭据文件发布与数据库 COMMIT 不作为跨资源原子事务声明。源码哈希与冻结验证副本核对一致，持续变化的用户 dist/缓存、文档验收产物不纳入此比较。

机器记录见 `global-code-review-2026-11-23.json`，完整基线、最终源码副本、日志、截图和接口记录在本机私有 `/tmp/zhusuan-global-review.nTR8Fp`。

## 剩余维护提示与验收范围

完整 Go lint 从基线136项降到45项，仍以非零退出：32项重复常量、5项复杂度、4项 Wails/持久字段的 British spelling、4项公开类型前缀。未处理项已审阅，不能把当前仓库报告为全量 lint 清零。主程序初始化、桌面管理及收款赋值仍适合后续按职责进一步拆分；兼容命名涉及原生 API/JSON/绑定，需保持对应契约。

MySQL/PostgreSQL 检查使用真实驱动 DSN 解析，没有连接云库。监控只解析配置/检查规则，没有启动实际栈；远程访问默认 loopback 需显式配置，Linux host-gateway 无法直接连接仅监听127.0.0.1的主机 API。Windows/Linux 是交叉静态检查，移动端仅辅助脚本测试。原生登录项、快捷键、通知、系统托盘、窗口及真实屏幕阅读器未在目标设备全量验收；CPU/GPU、实际部署容量和所有 Git 历史秘密扫描未执行。

原生 `SetSessionUser` 现在需要 JWT，前端 wrapper 和生成绑定已同步，前后端须使用匹配代码。未重启用户服务或发布版本。当前配置始终提供 MenuBar snapshot provider；未配置 provider 的兼容 fallback 不在实际应用数据路径验收中。
