# 打包、发布与桌面更新

## 当前版本与发布入口

当前准备版本为 **1.0.0**，草稿 [PR #2](https://github.com/primordialweave/zhusuan/pull/2) 保留审查，尚未合并或发布。README 中的版本号和界面截图表示当前代码状态，不表示安装包已公开。最终检查及未验收范围记录在 [release-readiness.md](release-readiness.md)。

稳定版使用 `vMAJOR.MINOR.PATCH` 标签，例如 `v1.0.0`。Windows 版本资源要求每段不超过 65535；Android 的编码要求次版本和补丁版本小于 1000，且 versionCode 不超过 2100000000。分支名与预发布标签不进入此稳定版发布流程。

先统一源代码版本：

```sh
python3 scripts/release.py metadata v1.0.0
# 等价入口
task bump-version VERSION=1.0.0
```

命令同步前端 package/lockfile、后端 `AppVersion`、Wails build/config、macOS/iOS plist、Windows 文件资源及 MSIX、Linux 包与 Android versionName/versionCode。MSIX 使用 `1.0.0.0`，Android versionCode 使用 `1000000`；系统最低版本要求独立保留。NSIS 从 build/config.yml 读取版本，避免生成 include 中的默认版本漂移。CI 在自己的工作副本执行相同同步。

发布工作流由推送稳定版本标签触发，也可在 GitHub Actions 的 Release 手动选择已有标签。手动运行必须填写 `tag`；构建该标签对应的代码。公开 Release 是单独的发布操作，准备文档、提交或更新草稿 PR 不会运行此标签发布流程。默认分支合并还可能触发 GHCR 镜像构建，合并前应确认发布意图。

## 构建和发布顺序

1. `prepare` 校验已有版本标签、版本编码与发布工具回归用例。
2. `build` 在 macOS、Windows、Linux runner 分别校验前端、构建应用并运行 Go 测试与静态检查。
3. macOS 构建 arm64 + amd64 universal 应用，以 `lipo -verify_arch` 验证后打 zip；Windows 编译 NSIS 并在临时目录进行安装/覆盖升级检查；Linux 构建 AppImage、deb 与 rpm。
4. 各平台检查必需产物，生成 SHA256 清单并上传 Actions artifact。缺失、空文件、重复资产直接使流程失败。
5. 单一 `publish` job 汇总全部平台产物，重新核对摘要，生成 `SHA256SUMS` 与静态 `update.json`。
6. 完整产物先上传草稿 Release，核对远端文件名和大小与本地清单一致后才公开并设为 latest。构建或上传失败时不会把缺包版本设为最新；已公开版本拒绝覆盖。

| 用途 | 资产名 |
| --- | --- |
| macOS Intel / Apple Silicon | `zhusuan-vX.Y.Z-macOS-universal.zip` |
| Windows amd64 安装/更新 | `zhusuan-vX.Y.Z-windows-amd64-installer.exe` |
| Linux amd64 AppImage | `zhusuan-vX.Y.Z-linux-x86_64.AppImage` |
| Debian/Ubuntu | `zhusuan-vX.Y.Z-linux-amd64.deb` |
| RPM 发行版 | `zhusuan-vX.Y.Z-linux-amd64.rpm` |
| 所有安装/更新文件的 SHA256 | `SHA256SUMS` |
| 应用内更新的版本与资产信息 | `update.json` |

更新检查优先读取 `https://github.com/primordialweave/zhusuan/releases/latest/download/update.json`，避免每次依赖匿名 GitHub API 额度。旧版本没有此文件时，404 回退到 Release API。manifest 记录版本、更新说明、五个分发资产及 SHA256SUMS 的 URL、大小和 `digest: "sha256:..."`；不引用自身。下载地址须属于当前仓库，且大小、摘要和当前系统/架构匹配。前端与原生服务禁止降级。

macOS、Windows、Linux 是当前发布目标。iOS/Android 已同步名称、图标与版本，保留构建脚手架，尚未完成移动端分发验收。图标生成和平台资源说明见 [icons.md](icons.md)。

## 从 Orange 升级

产品名为“珠算”，应用文件为 zhusuan.exe / zhusuan.app，应用标识为 `org.primordialweave.zhusuan`，Windows 卸载键为 `PrimordialWeaveZhusuan`。仓库、Go 模块、镜像与新发布资产使用 primordialweave/zhusuan。历史 Releases 与 Orange 资产名保留，不重写旧版本。

Windows 覆盖安装读取新旧卸载记录并识别 Orange.exe；成功后才清理旧应用与安装记录。数据库、登录信息和必要外观设置在新应用首次以原用户启动或首次加载凭据时迁移，新数据优先，旧记录保留。安装器本身不复制数据库，也不自动启动应用。完整路径、迁移条件与备份范围见 [migration.md](migration.md)。

更新器将旧 `GITHUB_REPO=FruitsAI/Orange` 配置规范化到新仓库，兼容历史 Orange 资产名、bundle 及 helper flag；新包优先使用 zhusuan-*。旧 Orange 更新结果只导入一次，不覆盖新结果。没有自动更新器的旧版需先手动安装一次珠算，再使用后续应用内更新。

## Windows 安装契约

普通安装按 HKLM/HKCU、64/32 位检查新 `PrimordialWeaveZhusuan` 和旧 `FruitsAIOrange` 卸载记录，读取 InstallLocation、历史默认值、DisplayIcon / UninstallString。目录中存在 zhusuan.exe 或 Orange.exe 时才采用，避免过期注册表指向错误目录。成功后持久保存 InstallLocation 和兼容默认值。

显式 `/D=` 优先于自动发现，必须是命令行最后一项；目录不加引号，即使包含空格。这是 NSIS 的参数格式，不通过 shell 拼接运行。

```text
installer.exe /S /UPDATE /D=C:\Custom directory\zhusuan
```

`/UPDATE` 使用静默模式且必须找到已有安装。用户态 helper 等待旧应用退出，按需提升权限运行安装器并等待退出码；安装器成功后由原用户态 helper 请求启动新应用，避免新应用继承管理员权限。NSIS 不自行重启应用。

安装前检查 WebView2 Runtime，缺失时启动 bootstrapper；检查启动/退出状态并重新读取有效 runtime 版本后，才进入主程序备份与替换。依赖安装失败返回非零状态。NSIS 拒绝覆盖仍被占用的 executable，替换前备份主程序与卸载器，复制或注册失败时执行回滚。用户数据库、凭据和安装目录中的无关文件保留，不先运行旧卸载器。

Windows runner 的 `scripts/windows-installer-smoke.ps1` 覆盖带空格的自定义目录、重装找回位置、历史注册表路径回退、锁定文件时更新失败且旧文件摘要不变、解锁后静默更新成功。这些场景和真实用户电脑上的 UAC、权限、WebView2 下载失败仍需分别验收。

## 更新、回滚与开销

桌面关于页由用户检测并确认更新，原生服务下载、流式校验 SHA-256、完成暂存后启动私有 helper。helper 在数据库和窗口初始化前分流，等待旧进程退出后安装并请求重启。界面支持下载取消、进度与失败重试；开发模式不执行安装。

macOS 暂存 app bundle 与安装目标位于同一文件系统，校验应用标识/版本后替换；AppImage 在原路径替换，保留旧文件到启动请求成功；deb/rpm 通过包管理器与 PolicyKit 安装。只读磁盘映像中的 macOS 应用应先移至应用程序文件夹，不支持的安装方式提供发布页下载。

文件替换失败或操作系统拒绝启动时有回滚；操作系统接受启动请求之后，新进程初始化、窗口创建或数据库迁移失败不在当前自动回滚范围。源码测试、浏览器状态 fixture 和隔离 helper 测试不能代替真实平台安装、签名/公证、权限提示及更新重启验收。

客户端以 128 KiB 缓冲下载，安装包上限 512 MiB，macOS 解压上限 1 GiB，更新日志上限 4 MiB。更新期间每 500 ms 串行读取内存状态；空闲时不轮询或检查网络。Linux 包归属探测延迟至用户主动检测更新。发布侧每次读取 1 MiB 计算摘要，不把安装包全部载入内存。

前端场景有帧率、像素预算、后台暂停和资源释放控制；项目选择器按需读取 20 项。实际 CPU/GPU、内存、启动时间及电池开销仍需在目标设备测量，不以实现预算代替性能验收。

## 本地检查与验收记录

```sh
python3 scripts/test_release.py
actionlint .github/workflows/ci.yml .github/workflows/release.yml
golangci-lint config verify
ZHUSUAN_CONFIG_ROOT=/tmp/zhusuan-release-check go test -race . ./internal/... ./cmd/...
go vet . ./internal/... ./cmd/...
cd frontend
node node_modules/eslint/bin/eslint.js src --max-warnings=0
npm run test:run
npm run build
```

涉及配置加载、数据库和凭据的本地验证使用隔离目录或 mock；不要连接真实账本或改变系统 Keychain。macOS 本地链接存在 SDK 与旧部署目标不同的提示，旧 macOS 兼容性需实际系统验收。

CI/Release 通过 install-linux-deps.sh 使用 Canonical HTTPS 镜像并省略推荐包，保留 APT 签名校验；Linux 依赖安装设置 30 秒网络超时、2 次重试和 10 分钟步骤上限，镜像不可用时明确失败。CI 使用锁文件 `npm ci`、固定构建工具和 go.mod 工具链；复用生成的 frontend dist。Linux 桌面需 CGO 与 GTK/WebKit 开发库，macOS CGO universal 构建在 macOS runner 上完成。增量 golangci 门禁以 PR base.sha、push beforeSHA、手动运行父提交为基线，保留全量文本/JSON/SARIF 报告。Gosec 全量扫描报告本身使用原有 no-fail 语义，新增问题由增量门禁检查。

当前 1.0.0 的最终测试、构建与 CI 结果以 [release-readiness.md](release-readiness.md) 为准。历史版本或历史 commit 的成功 CI 不代表当前代码已通过，也不代表三个平台的真实安装与原生更新已验收。
