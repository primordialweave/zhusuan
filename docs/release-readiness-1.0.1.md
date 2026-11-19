# 珠算 1.0.1 发布检查

检查日期：2026-11-19 至 2026-11-20。用户在原会话明确选择发布 1.0.1，本会话接续执行。1.0.0 的应用标签与公开附件保持不变。1.0.1 在相同仓库 main 与新稳定标签构建，最终公开状态以 [Release](https://github.com/primordialweave/zhusuan/releases/tag/v1.0.1) 为准。

## 变更范围

- macOS 按 Apple Silicon / Intel 分别生成 DMG 与 ZIP；DMG 内为中文“珠算.app”及 Applications 快捷方式，ZIP 保持 ASCII 顶层 zhusuan.app 兼容现有更新器。
- Finder 与 Dock 使用同一青瓷算盘原画，现代 Icon Composer 调整画布及图层缩放以消除额外外板；旧系统保留透明 ICNS。旧 Xcode 复用 catalog 时核对源图片和 manifest 组合哈希。
- Windows 使用 Unicode 简体中文安装器及 UTF-8 BOM 源文件。普通首次安装位于 LOCALAPPDATA/PrimordialWeave/zhusuan，使用 HKCU；保留 Orange 安装，新标识的珠算记录才可复用。原 HKLM 机器安装按其原范围更新。
- 金额改为普通文本输入，只接受数字和最多两位小数；字符串补齐小数位，避免格式化生成科学记数。必填项显示中文提示、红框与首错焦点；提示组件移除粗左线。
- 令牌/通知弹层限制在视口内，长令牌换行；通知详情固定高度、增加内边距、正文独立滚动。
- Linux CI 采用临时源 Azure→Canonical 有界切换，保留签名；先下载再离线安装，避免网络timeout中断dpkg。

## 本地验证

- 前端：115 文件、598 用例全部通过；ESLint src --max-warnings=0 与 TypeScript/production build 通过。覆盖空提交中文错误与红框、首错焦点、不调用保存API；普通金额输入、非法输入拒绝、两位小数规范化；弹层位置、视口限制、令牌换行和固定详情尺寸。
- Go：race 全量通过，16 个有测试包、140 个顶层测试及 156 个子测试，测试无失败/跳过；另 10 个包无测试文件。go vet 通过，golangci 相对 origin/main 的增量检查为 0 新问题（全量历史告警基线保留）。
- Python：31 用例通过，覆盖版本同步、完整资产/摘要/manifest、DMG元数据与架构、图标catalog兼容/过期、Linux镜像切换和失败传播。actionlint 与 git diff --check 通过。
- Windows：2 顶层 + 8 子测试检查 scope 与注册路径，Windows amd64 updater 测试包交叉编译通过；NSIS 3.13 在临时fixture编译成功，无警告。此项不代替真实 Windows 安装。
- macOS：NSWorkspace 原生图标渲染确认无额外白灰外层。真实 1.0.1 源码两架构生产程序通过唯一架构、plist 1.0.1/中文名称/标识、ad-hoc 签名、DMG 只读挂载和 ZIP 全量 CRC 验证。Apple Silicon DMG 46,013,893 B / ZIP 41,754,579 B，Intel DMG 48,734,891 B / ZIP 43,825,201 B。私有临时构建总耗时分别 23.71 秒 / 31.16 秒；未启动应用。这些包用于本地验收，正式附件仍由 CI 构建。
- 页面：使用隔离脱敏数据库与专用 3466/9331 服务进行 ego lite 验证，1280×800 与 760×520 下横向溢出为 0：令牌窗口 512×420，长令牌自动换行；通知详情 512×448，长文内部滚动，底部固定留白 25px；小窗通知弹层 x381.25/y123.72/340×317.19，右/下边均在视口内。空表单中文提示、红框、焦点及普通金额输入已验。详情 type=medicine 显示字典名称“医学”，天平为系统青绿色 rgb(45,101,74)。公开截图见 [通知详情](screenshots/1.0.1/notification-detail-light.png) / [必填校验](screenshots/1.0.1/project-required-light.png)；测试令牌未进入仓库且已在隔离库撤销。未改真实账本、用户服务或已安装应用。

## 开销和验收边界

本次未新增前端依赖。弹层定位只在打开期间监听事件/尺寸，关闭后清理，不增加闲时网络轮询；金额校验在本地执行。图标为打包静态资源，打包逐架构顺序执行并以流式方式计算摘要。主 JS chunk 为 817.91 KB（gzip 264.18 KB），仍有既有的 500 KB 构建警告，真实设备 CPU/GPU、启动、内存与电池开销尚未测量。

macOS 仍是 ad-hoc 签名，未做 Developer ID/公证；Windows 未做 Authenticode。旧 macOS Finder、真实 Windows 安装界面/UAC、实际机器上的应用内更新重启/回滚仍须与 CI fixture 分开验收，不能以编译或模拟通过代替。

## CI 和发布

[PR #21](https://github.com/primordialweave/zhusuan/pull/21) 已合并，最初候选标签 `v1.0.1` 指向应用提交 `0959eb1516168a22c0cc65d44a798a0d60bcafc8`；尚未公开。取消竞态证实为产品问题后，最终候选将从修复后的 main 重新构建，最终提交在完成后记录。

- [PR CI 44558648378](https://github.com/primordialweave/zhusuan/actions/runs/44558648378)：frontend/backend/security 成功，Docker 因 PR 条件跳过。
- [main CI 44560362947](https://github.com/primordialweave/zhusuan/actions/runs/44560362947)：frontend/backend/security/Docker 四项全部成功。Linux 依赖准备分别 22/32 秒完成，实际使用 Azure HTTPS，未触发 fallback。
- [Release 44562497173](https://github.com/primordialweave/zhusuan/actions/runs/44562497173)：首轮 Linux 构建/后端/产物全通过；Windows 安装编译成功，快捷方式的 WScript 原始读取断言失败，未公开。
- [Recovery 44564873938](https://github.com/primordialweave/zhusuan/actions/runs/44564873938)：应用仍为标签0959eb1，验收脚本来自 main7611099。macOS 两架构正式产物全通过并已本地复验，Assets.car 与仓库提交相同；Windows 诊断明确 WScript 目标为空，继续使用原生 IShellLinkW 核查；Linux 取消测试出现时序失败。只有完整产物验证后才公开 latest，正式附件核对结果在完成后追加。

取消下载回归补充：可控响应在读取开始后等待CancelUpdate/Close，再返回EOF；旧产品两分支稳定失败。修复后两个分支保持available、无launch/quit，未取消的truncated/oversized/digest仍拒绝。定向普通与race各重复100次、各1300通过，完整updater race81通过。

## 最终候选（2026-11-20）

真实修复下载取消 EOF 竞态及 NSIS 显式 /D 覆盖后，未公开的 `v1.0.1` 使用比较旧 ref 的 lease 更新为 `176c9780dbcfb0932370e9c98d5c5e7a9eb08d3a`，旧候选保存于本地 `archive/v1.0.1-candidate-0959eb1`。没有公开过旧候选 Release，公开 1.0.0 不变。

- [最终 main CI 44569458459](https://github.com/primordialweave/zhusuan/actions/runs/44569458459)：frontend/backend/security/Docker 全部通过。
- [Windows Check 44569492188](https://github.com/primordialweave/zhusuan/actions/runs/44569492188)：应用与 smoke 同为最终候选，完整安装/升级、Go 测试/vet 全部通过。原生 IShellLinkW 证实两个中文快捷方式正确；普通与自动更新的显式 Orange 路径返回非零，旧程序/注册保留，带空格目标、DisplayIcon fallback、锁定回滚、用户更新与 HKLM 更新均通过。
- [最终 Release 44571413947](https://github.com/primordialweave/zhusuan/actions/runs/44571413947)：从最终标签直接构建，无 build/test recipe 替换，Windows 与 Linux 全job通过；macOS 未取得 runner，排队约15分钟后因 GitHub hosted arm64 capacity constraints 自动取消（runner_id=0、无执行步骤）。保留同源码已过产物，使用专用 Intel macOS runner 完成剩余两架构验证后聚合发布。
