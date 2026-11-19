# Orange → 珠算 / zhusuan

仓库已从 `FruitsAI/Orange` 转移并改名为 `primordialweave/zhusuan`。这是同一个仓库，提交、分支、标签、Issues、PR 与历史 Releases 继续保留。旧地址由 GitHub 重定向；不要在 FruitsAI 下重新创建 Orange，否则会破坏该重定向。

## 新名称与标识

| 项目 | 新值 |
| --- | --- |
| 产品显示名 | 珠算 |
| 英文名、Go 模块与包名前缀 | zhusuan / github.com/primordialweave/zhusuan |
| 应用程序文件 | zhusuan.app / zhusuan.exe |
| Apple 应用标识 | org.primordialweave.zhusuan |
| Windows 卸载记录 | PrimordialWeaveZhusuan |
| 钥匙串服务 | org.primordialweave.zhusuan.login |
| 默认记住登录的 scope | zhusuan-desktop/api/v1 |
| 外观存储键 | zhusuan.appearance.v1 |
| 镜像地址 | ghcr.io/primordialweave/zhusuan |

首次启动使用新系统身份，自动读取旧版的必要记录。已有的新数据库、凭据或设置始终优先，不由旧版覆盖。

## 用户数据

默认数据库变为 `UserConfigDir/primordialweave/zhusuan/zhusuan.db`：macOS 位于 `~/Library/Application Support`，Windows 位于 `%APPDATA%`，Linux 默认位于 `~/.config`。配置了明确 `DB_PATH` 的用户继续使用自己选择的数据库。

旧 `FruitsAI/Orange/orange.db` 通过只读 SQLite `VACUUM INTO` 获取包含 WAL 的一致快照；OS 文件锁防止并发迁移，目标文件独占创建，原库保留。初始密码说明只随旧默认数据库迁入，不混入已存在的新数据库。

新的钥匙串记录不存在时，会读取原服务及旧 scope，成功后写入新服务并保留旧记录。用户明确选择忘记密码时，相关新旧记录一起删除，防止旧密码再次恢复。手动补迁移一个已记住的登录可运行：

```sh
go run ./cmd/migrate-credentials
```

该工具只报告是否找到登录记录，不输出账号或密码；其他服务器可用 `-scope` 指定对应 scope。

macOS 用只读 SQLite 查询旧 WebKit 中的主题、外观、记住用户名/密码标志和统计范围，在前端 store 初始化之前补入缺失值。它不复制活跃的整套 WebKit profile，也不搬密码或登录会话。Windows 将关闭的旧 WebView2 持久配置迁入新数据目录的 `WebView2`，检查同用户旧进程及 LevelDB LOCK，并跳过缓存、锁文件和会话存储。首次新身份启动可能需要重新登录，保存的登录信息可继续使用。

## 安装与更新

Windows 新安装器兼容旧 `FruitsAIOrange` 注册表项和 `Orange.exe`，在原安装位置备份、替换、写入新记录，成功后清理旧记录与快捷方式；失败回滚，用户数据与无关文件保留。新安装包和更新 manifest 使用 `zhusuan-vX.Y.Z-*`，历史 Orange Releases 不重写。

更新检查指向新仓库，旧仓库配置会规范化到新地址。旧版尚未包含自动更新器时，需先安装一次珠算新版，之后可应用内下载、校验、安装与重启。

## 维护操作

```sh
git remote set-url origin https://github.com/primordialweave/zhusuan.git
```

发布继续使用新的版本标签；不要重发已有 tag。GitHub Actions 和 GHCR 的权限由新组织策略管理，第三方集成需要拥有新仓库的访问权限。

本次用真实旧库与新库核对了核心记录，并迁移了当前记住的登录记录；源码与 UI 使用隔离目录、凭据 mock 和浏览器 fixture 验证。Windows 安装/UAC及新 bundle 的跨系统实机验收应以相应平台结果为准。
