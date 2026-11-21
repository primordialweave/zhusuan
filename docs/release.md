# 打包、发布与桌面更新

## 1.2.0 与发布入口

**1.2.0** 已公开并设为 latest，包含统一 SVG 玉质图标与品牌空态、组件和图表材质打磨、有限交互动效，以及 macOS 深浅双态图标资源。完整发行验收见 [release-readiness-1.2.0.md](release-readiness-1.2.0.md)；公开状态以 [v1.2.0 Release](https://github.com/primordialweave/zhusuan/releases/tag/v1.2.0) 为准，提交代码或创建标签不代表安装包已发布。

**1.1.0** 已公开，包含玉质界面、全界面Skeleton、可配置品牌信息与收款计划批次口径，历史检查记录见 [release-readiness-1.1.0.md](release-readiness-1.1.0.md)。

**1.0.2** 已公开，包含Windows普通启动时按需UAC、透明胶囊标题栏与全屏、窗口操作串行队列修复。[v1.0.2 Release](https://github.com/primordialweave/zhusuan/releases/tag/v1.0.2) 三平台完整通过，检查证据见 [release-readiness-1.0.2.md](release-readiness-1.0.2.md)。依赖升级另行合入主分支，已发布源码/标签/附件不变。

macOS 下载入口改为 Apple Silicon（arm64）和 Intel（amd64）两个 DMG。打开映像后将珠算拖入 Applications，再从应用程序文件夹启动。包仍采用 ad-hoc 签名，未配置 Developer ID/公证；Windows 安装器未配置 Authenticode 签名。首次打开时可能需要按系统提示允许运行。安装前退出旧应用，首次以原用户启动珠算完成数据迁移，旧数据保留。

已公开的 1.0.0 原 universal ZIP、SHA256SUMS 和 update.json 保留，新增 DMG 使用独立校验清单，避免改变现有更新载荷。后续标签按下面的新资产清单构建。

稳定版使用 `vMAJOR.MINOR.PATCH` 标签，例如 `v1.0.0`。Windows 版本资源要求每段不超过 65535；Android 的编码要求次版本和补丁版本小于 1000，且 versionCode 不超过 2100000000。分支名与预发布标签不进入此稳定版发布流程。

先统一源代码版本：

```sh
python3 scripts/release.py metadata v1.2.0
# 等价入口
task bump-version VERSION=1.2.0
```

命令同步前端 package/lockfile、后端 `AppVersion`、Wails build/config、macOS/iOS plist、Windows 文件资源及 MSIX、Linux 包与 Android versionName/versionCode。1.2.0 的 MSIX 使用 `1.2.0.0`，Android versionCode 使用 `1002000`；系统最低版本要求独立保留。NSIS 从 build/config.yml 读取版本，避免生成 include 中的默认版本漂移。CI 在自己的工作副本执行相同同步。

发布工作流由推送稳定版本标签触发，也可在 GitHub Actions 的 Release 手动选择已有标签。手动运行必须填写 `tag`；构建该标签对应的代码。准备阶段先拒绝已公开 Release，避免重建和覆盖正式版本；公开 Release 是单独的发布操作，准备文档、提交或更新草稿 PR 不会运行此标签发布流程。默认分支合并还可能触发 GHCR 镜像构建，合并前应确认发布意图。

## 已有标签的构建配方恢复

首次 1.0.0 打包发现 Task 同时重装 node_modules 并扫描 Go 包的竞争。应用源码及公开标签保持不变，构建调整为先完成前端安装，再生成绑定；只下载/校验固定 Go 依赖，macOS 两个架构顺序构建。

手动 Release 可填写完整的 `build_recipe_ref` 提交 SHA。该提交必须已包含在 main，流程只读取四份桌面 Taskfile，不替换 Go/前端应用源码、版本或资源；应用仍从 tag 构建，配方来源写入发行说明和 update.json 正文。后续标签包含修复后的配方时无需填写。新的 DMG 工作流要求标签内包含 scripts/build_macos_packages.py；已经公开的 1.0.0 不通过此工作流重建，附加 DMG 由原已校验 bundle 转换并保持原载荷及 manifest 不变。

Windows 原生测试如需修复平台夹具，可另外指定 `test_recipe_ref`，同样要求完整 SHA 且已合入 main，只覆盖四份固定 `_test.go` 文件和 `scripts/windows-installer-smoke.ps1` 安装验收夹具。它用于 POSIX 权限位、Darwin WebKit、日志临时文件等测试边界；保留实际数据库快照、路径穿越和回滚断言，不替换发行应用代码。来源也写入发行说明与 manifest 正文。

```sh
gh workflow run release.yml --ref main -f tag=v1.0.0 -f build_recipe_ref=<40位已审查提交SHA>
```

## 构建和发布顺序

1. `prepare` 校验已有版本标签、版本编码与发布工具回归用例。
2. `build` 在 macOS、Windows、Linux runner 分别校验前端、构建应用并运行 Go 测试与静态检查。发行前端测试使用单 worker，保留全部用例和断言，避免不同 runner 的并发资源争用。
3. macOS 在同一 runner 顺序构建 arm64、amd64 两个应用，由 scripts/build_macos_packages.py 校验版本与架构后生成各自 DMG 和 ZIP；Windows 编译 NSIS 并在临时目录进行安装/覆盖升级检查；Linux 构建 AppImage、deb 与 rpm。
4. 各平台检查必需产物，生成 SHA256 清单并上传 Actions artifact。缺失、空文件、重复资产直接使流程失败。
5. 单一 `publish` job 汇总全部平台产物，重新核对摘要，生成 `SHA256SUMS` 与静态 `update.json`。
6. 完整产物先上传草稿 Release，核对远端文件名和大小与本地清单一致后才公开并设为 latest。构建或上传失败时不会把缺包版本设为最新；已公开版本拒绝覆盖。

| 用途 | 资产名 |
| --- | --- |
| macOS Apple Silicon 手动安装 | `zhusuan-vX.Y.Z-macOS-arm64.dmg` |
| macOS Intel 手动安装 | `zhusuan-vX.Y.Z-macOS-amd64.dmg` |
| macOS Apple Silicon 应用内更新 | `zhusuan-vX.Y.Z-macOS-arm64.zip` |
| macOS Intel 应用内更新 | `zhusuan-vX.Y.Z-macOS-amd64.zip` |
| Windows amd64 安装/更新 | `zhusuan-vX.Y.Z-windows-amd64-installer.exe` |
| Linux amd64 AppImage | `zhusuan-vX.Y.Z-linux-x86_64.AppImage` |
| Debian/Ubuntu | `zhusuan-vX.Y.Z-linux-amd64.deb` |
| RPM 发行版 | `zhusuan-vX.Y.Z-linux-amd64.rpm` |
| 所有安装/更新文件的 SHA256 | `SHA256SUMS` |
| 应用内更新的版本与资产信息 | `update.json` |

更新检查优先读取 `https://github.com/primordialweave/zhusuan/releases/latest/download/update.json`，避免每次依赖匿名 GitHub API 额度。旧版本没有此文件时，404 回退到 Release API。新 manifest 记录版本、更新说明、八个分发/更新资产及 SHA256SUMS 的 URL、大小和 `digest: "sha256:..."`，共九个资产条目；加上 update.json，本次发布共十个文件，不引用自身。下载地址须属于当前仓库，且大小、摘要和当前系统/架构匹配。前端与原生服务禁止降级。

本机使用 `task darwin:package ARCH=arm64` 或 `task darwin:package ARCH=amd64` 生成该架构的 DMG/ZIP；`task darwin:package:app` 仅构建 app bundle，供 CI 逐架构校验后调用打包脚本。

DMG 是 macOS 手动安装入口；ZIP 保留为对应架构的应用内更新载荷，兼容已发布的 1.0 更新器。更新器按自身运行架构优先选择匹配 ZIP，并兼容历史 universal ZIP，不将 DMG 直接当作 ZIP 解压。

macOS、Windows、Linux 是当前发布目标。iOS/Android 已同步名称、图标与版本，保留构建脚手架，尚未完成移动端分发验收。图标生成和平台资源说明见 [icons.md](icons.md)。

## 从 Orange 升级

产品名为“珠算”，应用文件为 zhusuan.exe / 珠算.app，应用标识为 `org.primordialweave.zhusuan`，Windows 卸载键为 `PrimordialWeaveZhusuan`。仓库、Go 模块、镜像与新发布资产使用 primordialweave/zhusuan。历史 Releases 与 Orange 资产名保留，不重写旧版本。

Windows 1.0.1 首次安装使用新的用户目录，不读取 Orange 安装记录，也不删除旧程序；珠算重装只复用已有 zhusuan.exe 对应的新记录。数据库、登录信息和必要外观设置在新应用首次以原用户启动或首次加载凭据时迁移，新数据优先，旧记录保留。安装器本身不复制数据库，也不自动启动应用。完整路径、迁移条件与备份范围见 [migration.md](migration.md)。

更新器将旧 `GITHUB_REPO=FruitsAI/Orange` 配置规范化到新仓库，兼容历史 Orange 资产名、bundle 及 helper flag；新包优先使用 zhusuan-*。旧 Orange 更新结果只导入一次，不覆盖新结果。没有自动更新器的旧版需先手动安装一次珠算，再使用后续应用内更新。

## Windows 安装契约

Windows 1.0.1 普通首次安装使用 `%LOCALAPPDATA%\PrimordialWeave\zhusuan`，无需管理员权限，在 HKCU 写入 `PrimordialWeaveZhusuan` 卸载记录并创建当前用户的“珠算”快捷方式。NSIS 源文件使用 UTF-8 BOM，Unicode 安装器配套简体中文界面，避免系统 ACP 将名称解码成乱码。

自动发现仅检查 HKCU/HKLM 64/32 位的新 `PrimordialWeaveZhusuan` 记录，读取 InstallLocation、历史默认值、DisplayIcon / UninstallString；目录中存在 zhusuan.exe 时才复用。Orange 的目录、程序、卸载记录与快捷方式均保留，数据通过应用首次启动迁移。已有珠算 1.0 的机器范围安装仍按其 HKLM 记录和原路径更新；1.0.2起需要权限时自动请求UAC，保留原目标并等待提升进程真实退出码；取消时明确提示原安装未改。

显式 `/D=` 优先于自动发现，必须是命令行最后一项；目录不加引号，即使包含空格。这是 NSIS 的参数格式，不通过 shell 拼接运行。

```text
installer.exe /S /UPDATE /D=C:\Custom directory\zhusuan
```

`/UPDATE` 使用静默模式且必须找到已有珠算，不能把 Orange-only 目录作为目标。用户态 helper 等待旧应用退出，用户目录安装使用原用户上下文，机器目录安装按需提升权限运行安装器并等待退出码；安装器成功后由原用户态 helper 请求启动新应用，避免新应用继承管理员权限。NSIS 不自行重启应用。

安装前检查 WebView2 Runtime，缺失时启动 bootstrapper；检查启动/退出状态并重新读取有效 runtime 版本后，才进入主程序备份与替换。依赖安装失败返回非零状态。NSIS 拒绝覆盖仍被占用的 executable，替换前备份主程序与卸载器，复制或注册失败时执行回滚。用户数据库、凭据和安装目录中的无关文件保留，不先运行旧卸载器。

Windows runner 的 `scripts/windows-installer-smoke.ps1` 覆盖新 LOCALAPPDATA 默认路径、旧 Orange 程序/记录保留、中文 HKCU/快捷方式、带空格的现有珠算自定义目录、DisplayIcon 路径回退、锁定文件回滚、用户目录静默更新与已安装机器版本兼容更新。这些场景和真实用户电脑上的 UAC、权限、WebView2 下载失败仍需分别验收。

## 更新、回滚与开销

桌面关于页由用户检测并确认更新，原生服务下载、流式校验 SHA-256、完成暂存后启动私有 helper。helper 在数据库和窗口初始化前分流，等待旧进程退出后安装并请求重启。界面支持下载取消、进度与失败重试；开发模式不执行安装。

macOS 暂存 app bundle 与安装目标位于同一文件系统，校验应用标识/版本后替换；AppImage 在原路径替换，保留旧文件到启动请求成功；deb/rpm 通过包管理器与 PolicyKit 安装。只读磁盘映像中的 macOS 应用应先移至应用程序文件夹，不支持的安装方式提供发布页下载。

文件替换失败或操作系统拒绝启动时有回滚；操作系统接受启动请求之后，新进程初始化、窗口创建或数据库迁移失败不在当前自动回滚范围。源码测试、浏览器状态 fixture 和隔离 helper 测试不能代替真实平台安装、签名/公证、权限提示及更新重启验收。

客户端以 128 KiB 缓冲下载，安装包上限 512 MiB，macOS 解压上限 1 GiB，更新日志上限 4 MiB。更新期间每 500 ms 串行读取内存状态；空闲时不轮询或检查网络。Linux 包归属探测延迟至用户主动检测更新。发布侧每次读取 1 MiB 计算摘要，不把安装包全部载入内存。

前端场景有帧率、像素预算、后台暂停和资源释放控制；项目选择器按需读取 20 项。1.2.0 的 SVG 图标共用应用根部渐变定义，交互动效由 hover、按压或真实业务结果触发，并服从系统与应用的减少动态设置；主界面采用静态玉质材质。发行验收记录生产包体及浏览器交互结果，实际 CPU/GPU、内存、启动时间及电池开销仍需在目标设备测量，不以实现预算代替性能验收。

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

CI/Release 通过 install-linux-deps.sh 使用临时 Ubuntu sources，优先 Azure HTTPS，失败再切换 Canonical HTTPS，并省略推荐包、保留 Ubuntu archive keyring 签名校验。两个镜像各有 50 秒索引与 130 秒下载预算，完整下载后才进入最长 180 秒的本地安装；总预算 565 秒，低于 10 分钟步骤上限。索引部分失败也会明确报错，网络超时不会中断 dpkg。CI 使用锁文件 `npm ci`、固定构建工具和 go.mod 工具链；复用生成的 frontend dist。Linux 桌面需 CGO 与 GTK/WebKit 开发库，macOS CGO arm64/amd64 构建在同一 macOS runner 上顺序完成。增量 golangci 门禁以 PR base.sha、push beforeSHA、手动运行父提交为基线，保留全量文本/JSON/SARIF 报告。Gosec 保留原始 no-fail 模式报告并结合输入边界复核；Trivy 对已有修复版本的 HIGH/CRITICAL 依赖漏洞返回非零，阻断 CI 及 main 镜像发布。

1.0.2 的完整正式结果见 [release-readiness-1.0.2.md](release-readiness-1.0.2.md)，1.0.1 历史结果见 [release-readiness-1.0.1.md](release-readiness-1.0.1.md)，1.0.0 的历史证据保留在 [release-readiness.md](release-readiness.md)。历史版本或历史 commit 的成功 CI 不代表当前代码已通过，也不代表三个平台的真实安装与原生更新已验收。
