# 打包、发布与桌面更新

## 发布版本

稳定版使用 `vMAJOR.MINOR.PATCH` 标签，例如 `v0.7.3`。Windows 版本资源要求每段不超过 65535；分支名与预发布标签不会通过此发布流程。

发布工作流可由推送版本标签触发，也可在 GitHub Actions 的 Release 中手动选择已有标签。手动运行必须填写 `tag`，构建的是该标签的代码，不能把分支名当作版本。

如需在源代码中提前更新显示版本，运行：

```sh
python3 scripts/release.py metadata v0.7.3
```

此命令同步前端 package / lockfile、Wails build/config、macOS plist、Windows文件资源及 Linux 包版本。CI 在自己的工作副本里执行同样的同步，因此 Release 标签、设置页版本与主程序嵌入的版本保持一致。NSIS 从 `build/config.yml` 读取版本，避免生成的 `wails_tools.nsh` 留有旧版本。

## 构建和发布顺序

1. `prepare` 校验版本标签和发布工具回归用例。
2. `build` 在 macOS、Windows、Linux 三个 runner 上分别校验前端、构建应用并运行 Go 测试与静态检查。
3. macOS 显式构建 arm64 + amd64 universal 应用，使用 `lipo -verify_arch` 验证后再打 zip；Windows 编译 NSIS 并在临时目录执行安装/覆盖升级验收；Linux 构建 AppImage、deb 与 rpm。
4. 每个平台检查必需产物、生成自己的 SHA256 清单，再上传 Actions artifact。缺失、空文件、重复产物均直接使流程失败。
5. 单一 `publish` job 汇总全部平台产物，重新计算并核对所有摘要，生成 `SHA256SUMS`。
   然后生成 `update.json`，记录版本、更新说明、五个平台资产及 SHA256SUMS 的 URL、大小和摘要。
6. 完整产物先上传到 GitHub **草稿 Release**，远端文件名与大小和本地清单完全一致后才公开并设为 latest。任何构建或上传失败都不会把半成品作为最新版本；已公开版本拒绝覆盖。

每个版本公开以下文件：

| 用途 | 资产名 |
| --- | --- |
| macOS Intel / Apple Silicon | `zhusuan-vX.Y.Z-macOS-universal.zip` |
| Windows amd64 安装/更新 | `zhusuan-vX.Y.Z-windows-amd64-installer.exe` |
| Linux amd64 AppImage | `zhusuan-vX.Y.Z-linux-x86_64.AppImage` |
| Debian/Ubuntu | `zhusuan-vX.Y.Z-linux-amd64.deb` |
| RPM 发行版 | `zhusuan-vX.Y.Z-linux-amd64.rpm` |
| 所有安装/更新文件的 SHA256 | `SHA256SUMS` |
| 应用内更新检查的静态版本与资产信息 | `update.json` |

应用内检查更新优先读取 `https://github.com/primordialweave/zhusuan/releases/latest/download/update.json`。此路径直接提供最新 Release 资产，可避免公共 GitHub API 的匿名速率限制；旧版本未提供该文件时，404 会回退到原 GitHub Release API。manifest 中每个资产条目包含 `browser_download_url`、字节大小和 `digest: "sha256:..."`，它不引用自身；生成与发布前验证均基于已通过校验的本地产物。

## 从 Orange 迁移到珠算

新的产品显示名为“珠算”，二进制与 macOS bundle 名为 `zhusuan.exe` / `zhusuan.app`，应用标识为 `org.primordialweave.zhusuan`。仓库、Go module 与发布资产来自 `primordialweave/zhusuan`；新 Windows 卸载键为 `PrimordialWeaveZhusuan`。新安装使用新名称和标识。

覆盖升级会读取旧 `FruitsAIOrange` 的 HKLM/HKCU 64/32 位注册表值，并识别目录中的 `Orange.exe`。在原安装目录备份旧/新 executable 与卸载器，写入新程序及注册信息；成功后才移除旧 exe、旧安装记录和 Orange 快捷方式。失败会恢复旧文件与记录，不会先运行旧卸载器。卸载珠算也保留数据库、凭据、profile 及安装目录中的无关文件。

更新器将旧 `GITHUB_REPO=FruitsAI/Orange` 配置明确规范化到新仓库，仍可识别被保留下来的 Orange 历史资产名、bundle 及 helper flag。新版包优先选择 `zhusuan-*`，且校验下载地址归属当前仓库；旧名称只作为迁移兼容输入。更新缓存使用 `zhusuan/updates`，旧 `Orange/updates/result.json` 只导入一次并保留原文件，新缓存结果不会被覆盖。

用户选择了新系统身份，因此数据库与登录/profile 偏好的迁移由应用启动迁移代码执行，旧数据保留作为备份；Windows 安装目录仍尊重旧安装的自定义路径。Linux新包通过 replaces/conflicts（RPM还包括旧大小写名称）接管旧包，安装后重启新路径的 executable。Android applicationId 已换新，内部 `com.wails.app` namespace 仍是 Wails JNI 框架命名，不能作为产品身份任意替换。

## Windows 安装和更新契约

普通安装会依次查 HKLM、HKCU 的 64/32 位卸载注册表 `Software\Microsoft\Windows\CurrentVersion\Uninstall\PrimordialWeaveZhusuan`，优先取 `InstallLocation`，然后检查旧默认值、`DisplayIcon` / `UninstallString`。只有目录中存在 zhusuan.exe 才采用，避免指向过期安装位置。安装成功后持久保存 `InstallLocation` 和兼容的默认值。

显式 `/D=` 优先于注册表自动发现，必须是命令行最后一个参数，目录不加引号，即使包含空格也如此。这是 NSIS 的标准参数格式。

应用内更新调用：

```text
installer.exe /S /UPDATE /D=C:\Custom directory\zhusuan
```

用户态更新 helper 等待旧应用退出，再按需提升权限运行 installer，等待退出码。`/UPDATE` 自动使用静默模式且必须找到已有安装。NSIS 拒绝覆盖仍在使用的 exe；替换前备份主程序和卸载器，复制或注册失败时恢复旧文件，返回非零状态。成功返回 0 后，由原用户态 helper 重启新应用，避免新应用继承安装器的管理员权限。NSIS 不自行重启应用。

升级覆盖应用文件，数据库和用户设置继续位于用户配置目录，不通过先卸载旧版本来更新。

## 验证与开销

桌面「关于」页确认更新后，原生服务按当前系统/架构下载、流式校验 SHA-256，再启动私有更新助手。助手在数据库和窗口初始化之前分流，等待旧进程真正退出后才安装并重启；界面支持下载取消、进度和失败重试。开发模式不执行安装。

macOS 使用同一文件系统中的暂存 app bundle，校验应用标识/版本后替换；AppImage 在原路径替换并保留旧文件到启动请求成功；系统 deb/rpm 安装使用包管理器和 PolicyKit 的权限提示。只读磁盘映像中的 macOS 应用应先移到应用程序文件夹，不支持的安装方式提供发布页下载。文件替换和操作系统拒绝启动时有回滚；新进程启动后初始化或数据库迁移失败不属于当前自动回滚覆盖。

客户端安装包逐块读取，缓冲区 128 KiB，安装包上限 512 MiB，macOS 解压上限 1 GiB；日志上限 4 MiB。仅更新进行时每 500ms 串行读取内存状态，空闲不轮询或检查网络；Linux 包归属探测延迟到用户主动检测更新，避免影响应用启动。

```sh
python3 scripts/test_release.py
actionlint .github/workflows/ci.yml .github/workflows/release.yml
golangci-lint config verify
```

Windows runner 还执行 `scripts/windows-installer-smoke.ps1`，涵盖带空格的自定义目录、重装找到持久路径、历史路径回退、锁定文件时更新失败且旧 exe 摘要保持不变、解锁后静默更新成功。

发布侧对资产逐块读取计算 SHA256，每次读取 1 MiB，不把安装包一次性载入内存。前端依赖使用 `npm ci` 与锁文件；CI 合并重复工作流，复用一次生成的前端 dist，避免多个过期流程重复构建。Linux 桌面构建必须使用 CGO 与 GTK/WebKit 开发依赖，macOS 必须在 macOS runner 上完成 CGO universal 构建。

CI 的 golangci-lint 门禁检查本次新增问题：PR 以 `base.sha` 为基线，push 以 `before` 提交为基线，手动运行以当前提交的父提交为基线；完整历史通过 `fetch-depth: 0` 保留。全量 JSON/文本报告仍上传 `backend-checks`，已有静态检查欠账不会掩盖新增问题。Gosec 保留原有 `-no-fail` 完整 SARIF 报告语义，上传到代码扫描和 `security-reports`；新增安全问题由 golangci 的 gosec 增量门禁负责。

本次本地前端 552 用例、Go 100 顶层/132 子测试（含更新器 51 测试事件）、race/vet、增量 lint、构建和 Windows amd64 交叉编译均通过，发布脚本 9 用例与 NSIS 编译通过。页面真实检测最新版本通过；下载/取消/错误状态用页内原生响应 fixture 核对浅深主题，未替换真实应用。Windows 实际安装、UAC、完整 Actions 三平台构建和远端发布应以对应 runner 结果为准。macOS 本地链接仍提示当前 SDK 与旧部署目标版本不同，不能据此声称旧 macOS 兼容性已验收。
