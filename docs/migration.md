# Orange → 珠算 / zhusuan

仓库已从 FruitsAI/Orange 转移并改名为 [primordialweave/zhusuan](https://github.com/primordialweave/zhusuan)。提交、分支、标签、Issues、PR 与历史 Releases 保留在同一个仓库。旧地址由 GitHub 重定向；不要重新创建 FruitsAI/Orange，否则会破坏该重定向。

**1.0.0** 已发布；本次 **1.0.1** 调整 Windows 安装为新的用户目录，并保留旧 Orange 安装。旧安装包不会因仓库改名而自动获得这些实现；以下安装规则从 1.0.1 起生效。

## 新名称与标识

| 项目 | 新值 |
| --- | --- |
| 产品显示名 | 珠算 |
| 英文名、Go 模块 | zhusuan / github.com/primordialweave/zhusuan |
| 应用文件 | 珠算.app / zhusuan.exe |
| Apple 应用标识 | org.primordialweave.zhusuan |
| Windows 卸载记录 | PrimordialWeaveZhusuan |
| 系统凭据服务 | org.primordialweave.zhusuan.login |
| 默认记住登录的 scope | zhusuan-desktop/api/v1 |
| 外观存储键 | zhusuan.appearance.v1 |
| 容器镜像 | ghcr.io/primordialweave/zhusuan |

全部平台图标使用青瓷算盘资源；macOS bundle 与运行时 Dock 共用 ICNS，避免开发启动仍显示 Wails 默认图标。生成入口与移动端资源限制见 [icons.md](icons.md)。

## 数据库迁移

默认目录为 `UserConfigDir/primordialweave/zhusuan`，数据库为 zhusuan.db：

| 系统 | 默认目录 |
| --- | --- |
| macOS | `~/Library/Application Support/primordialweave/zhusuan` |
| Windows | `%APPDATA%\primordialweave\zhusuan` |
| Linux | `~/.config/primordialweave/zhusuan` |

首次启动时，若新的默认库尚不存在且未配置非空 DB_PATH，应用读取旧 FruitsAI/Orange/orange.db，以只读 SQLite `VACUUM INTO` 获取包含已提交 WAL 的一致快照。OS 文件锁与独占发布防止并发迁移覆盖目标，旧库保留。已有新默认库优先；迁移不会把两个库合并。旧默认库的初始密码说明仅随该库迁入，不混入已有新库。

未设置、空或仅空白 DB_PATH 均按默认路径处理，仍会尝试旧库迁移。非空自定义 DB_PATH 保持原值；需要继续使用旧自定义库时保留该配置。MySQL/PostgreSQL 连接继续使用配置的云端库，不复制成 SQLite。

Windows 1.0.1 首次安装使用新的用户程序目录 `%LOCALAPPDATA%\PrimordialWeave\zhusuan`，不会查找或继承 Orange 安装目录，也不删除 Orange 程序、卸载记录或快捷方式。程序安装目录与 `%APPDATA%\primordialweave\zhusuan` 账本目录是不同位置。安装完成后，**第一次以原 Windows 用户启动珠算才迁移用户数据库**；安装器不直接复制账本，也不在完成页自动启动应用。新旧版本不要同时进行账本写入；迁移后继续使用珠算，旧库作为备份保留。

迁移发生错误时先检查日志与源库是否可读，保留新旧目录，不通过删库、改名或反复安装来试错。不要手动将仍在使用的 SQLite 单个 db 文件复制到新目录而遗漏 WAL。正式升级前可额外保存一份一致数据库备份。

## 登录与外观

新凭据记录不存在时，首次加载已记住的登录会读取旧服务及 scope，成功后写入新服务并保留旧记录；已有新记录优先。用户主动忘记密码时会清理相关新旧记录，防止旧密码再次恢复。

需要手动补迁一个记住的登录时可运行：

```sh
go run ./cmd/migrate-credentials
```

工具仅报告是否找到记录，不输出账号或密码；其他服务器可用 `-scope` 指定对应 scope。凭据由系统存储管理，数据库复制不等于密码迁移。

macOS/Linux 只读查询旧 WebKit 的主题、外观、记住用户名/密码标志及统计范围，在前端 store 初始化前补入缺失值。只读取白名单偏好，不复制活跃 WebView profile、密码或登录会话。

Windows 在旧 Orange.exe 关闭后，检查同用户旧进程与 LevelDB LOCK，再将旧 WebView2 持久文件迁入新目录的 WebView2。跳过缓存、锁文件、会话存储与非普通文件，并限制迁移大小。旧进程仍运行或配置被锁定时，先关闭旧版再重试珠算。已有新 profile 不覆盖。

首次以新身份启动可能需要重新登录；保存的登录信息可继续使用。退出登录只清除本地会话，JWT 不由此获得即时服务端撤销能力；当前账号状态/角色检查有短期缓存。

## 安装与应用内更新

Windows 1.0.1 的普通首次安装是当前用户安装，无需管理员权限，程序默认位于 `%LOCALAPPDATA%\PrimordialWeave\zhusuan`，新卸载记录位于 HKCU `PrimordialWeaveZhusuan`，开始菜单和桌面快捷方式使用“珠算”。旧 Orange.exe、FruitsAIOrange 注册记录和 Orange 快捷方式保留；旧数据在珠算启动阶段迁入新数据目录，而不是由安装器接管旧程序目录。

重装只复用已有珠算的新注册记录与 zhusuan.exe，可识别 HKCU/HKLM 64/32 位路径以及 InstallLocation/DisplayIcon/UninstallString 记录；不会将 Orange.exe 当作已有珠算。显式 `/D=` 的现有珠算自动更新仍优先，若目标目录包含旧 Orange.exe 则拒绝覆盖，避免改写它的卸载器。

已经安装在 Program Files 或其他机器目录的珠算 1.0，继续按原 HKLM 安装记录更新，并需要管理员权限；更新完成后仍由原用户态 helper 启动新程序。新的用户目录安装走原用户上下文，避免不必要的 UAC 或写入另一管理员的 HKCU。安装失败执行珠算文件回滚，数据库、凭据和无关文件保留。

新包及更新 manifest 使用 zhusuan-vX.Y.Z-*，历史 Orange Release 资产不重写。旧 GITHUB_REPO 配置规范化到新仓库。没有自动更新器的旧版先手动安装珠算，后续版本可在关于页检测、下载、校验、安装并请求重启。

卸载保留用户数据。文件替换或操作系统拒绝启动时有更新回滚；系统接受启动请求后，新应用初始化或数据库迁移失败不属于当前自动回滚覆盖。完整安装契约和实际验证边界见 [release.md](release.md) 与 [release-readiness.md](release-readiness.md)。

## 维护操作

```sh
git remote set-url origin https://github.com/primordialweave/zhusuan.git
```

继续使用新版本标签，不重发已有 tag。GitHub Actions、GHCR 及第三方集成应确认新组织权限。保留历史资料中的 Orange 名称、路径与旧标识作为迁移兼容依据，不做无差别全文替换。

数据库、凭据与 profile 回归使用隔离目录或 mock；Windows 实际安装、UAC、跨系统迁移与原生更新应按目标平台验收。最终 1.0.0 检查结果记录在发布检查文档中，旧 commit 的通过结果不代替当前代码验收。
