# 珠算 1.0.2 发布检查

日期2026-11-20。用户授权发布当前修复，然后处理依赖PR及清理分支；依赖更新另行合入，不改变1.0.2应用源码。

范围：Windows已有机器安装按需UAC，普通用户新安装asInvoker；透明标题栏去品牌，仅四胶囊按钮，拖动/resize/max/min/restore/fullscreen/F11/Esc/close。macOS/Linux既有平台行为保持。

前置证据：PR #30 CI44645064756前端/后端/安全通过；WindowsCheck44640534380普通同SID Medium token欢迎页/安装卸载、原升级smoke、原生窗口及完整Go测试/vet通过。最新胶囊样式19项行为/ODS检查及productionbuild通过、浅深浏览器验收无溢出。正式Release将重新验证最新样式的普通用户与原生窗口操作。

Release改为官方标准Intel macOS runner，顺序两架构构建；全平台前端单worker避免已知慢runner测试时序失败。Windows正式构建加入普通用户安装与原生窗口检查。无配方替换，十附件完整校验后公开latest。

本次未新增依赖；标题栏状态事件驱动，无闲时轮询。JS主chunk保留既有>500KB提示。真实设备性能、多屏/高DPI、SmartScreen/MOTW和真人UAC接受/取消仍需设备验收；macOS ad-hoc、Windows无Authenticode。

最终应用提交、CI/Release与附件验收结果完成后追加。

首轮Release44654031499的Linux/macOS完整构建通过；Windows普通用户/升级通过，原生最大化后立即全屏未执行。deferred native action/query +提前窗口事件可稳定复现旧actionPending保护吞点击。修复为Promise串行命令队列，失败后继续、卸载后不执行后续，四个行为回归新增，旧行为失败、新14例通过。此产品修复纳入尚未公开的1.0.2候选，原始候选保留，不混后续依赖升级。
