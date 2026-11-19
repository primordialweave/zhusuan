# Windows 普通启动与自定义标题栏验收

日期：2026-11-20。用户确认问题是下载的安装器.exe普通双击无法打开；另要求自定义Windows标题栏并支持全屏。候选在 `codex/windows-installer-custom-titlebar`、[PR #30](https://github.com/primordialweave/zhusuan/pull/30)，未发布新版本或覆盖公开1.0.1。

## 修改

正式1.0.1的实际PE manifest已为asInvoker。确证的静默退出路径是：检测到已有HKLM珠算后，非管理员进程在.onInit直接Abort，安装页未出现。现在仅机器范围目标自动请求UAC，保留参数与已解析目标，等待提升进程并传播真实退出码；全新用户安装仍asInvoker，取消UAC明确提示且不修改原安装。此原因适用于已有机器范围安装，未据此把全新下载的SmartScreen/杀软问题视作已复现。

仅Windows原生窗口启用Frameless，保留DWM阴影圆角、resize及原生最小化/最大化/关闭。全局React标题栏覆盖登录与业务页面，使用ODS图像与WindowControlButton，提供拖动、最小化、最大化/还原、全屏/退出、关闭、F11与Esc。事件驱动状态，无空闲轮询；macOS/Linux保持原窗口配置。

## 实际 Windows 证据

[Windows Check 44640534380](https://github.com/primordialweave/zhusuan/actions/runs/44640534380) 全部成功，应用和所有验收脚本来自 `50b06bb8fde4a5515ed59be191773309938273f1`，无fixture覆盖。安装器SHA256 `6f3bb641adc14f27c043a9fc617f209d85a6a0613e241ac8e5c012f0ccd47879`。完整几何和结果见 [verification JSON](windows-titlebar-verification.json)。

- 普通用户：同用户SID真实restricted token，Medium integrity RID8192、Administrators有效成员false、HKLM SOFTWARE写访问被拒绝。无参数启动实际安装欢迎窗成功，然后默认LOCALAPPDATA安装/HKCU中文注册/两个快捷方式/普通卸载全部通过。TokenElevation元数据仍true（由原runner token派生），没有把它误报为false；有效管理员能力检查与拒写证据独立存在。
- 原完整安装升级：旧Orange保留与目录拒绝、自定义空格路径、注册回退、锁定回滚、用户升级、HKLM机器升级、卸载保留无关数据全部通过。
- 原生窗口：Win32/UI Automation、真实鼠标和键盘，验证客户区与窗口上沿相同（无系统标题栏）、可拖边resize、可拖自定义标题栏、最大化/还原/最小化、全屏、F11/Esc、双击最大化、关闭。
- 实际几何：正常924×620，拖边变864×580；最大化客户区1024×720符合工作区；全屏1024×768覆盖显示器；Esc后恢复864×580及原位置。Wails alpha.55保留WS_CAPTION位，通过WM_NCCALCSIZE消除系统标题栏，不能用该style位缺失验收。

[正常窗口](screenshots/windows-titlebar/normal.png) / [全屏窗口](screenshots/windows-titlebar/fullscreen.png) 均为真实Windows runner截图，隔离全新数据库登录页，无用户数据。

## 其他验证和边界

- 前端116文件608用例、ESLint、TypeScript/production build通过；Go全量race141顶层159子测试/16包、vet与增量静态检查0新问题通过。
- NSIS3.13隔离编译无警告，实际生成manifest保持asInvoker/uiAccess=false；三个PowerShell AST、内嵌C#编译及最新版actionlint通过。Python31用例通过。
- [PR CI 44637964271](https://github.com/primordialweave/zhusuan/actions/runs/44637964271) frontend/backend/security全通过；后续只变验收脚本。Windows最终job完整Go测试/vet同样通过。
- 第一轮Chocolatey 504未进入构建；第二轮restricted worker 0xC0000142未执行安装器。指定winsta0/default交互桌面后辅助进程正常，最终run全过；不把这些环境/夹具失败写成产品验收。
- 原生检查仅使用新临时配置、数据库、WebViewprofile，禁外部API；未触真实账本/用户配置。浏览器ego空间9和自有9331预览已关闭。
- UAC交互授权接受/取消、下载来源MOTW/SmartScreen/杀软，以及不同Windows版本/DPI/多屏仍需真实用户设备验证；安装器仍无Authenticode。本次不改变系统安全设置或绕过下载保护。
- 主JS834.18KB（gzip268.15KB），保留既有500KB构建警告，无新增依赖；窗口状态只初始化/操作后/事件时查询，空闲无轮询。
