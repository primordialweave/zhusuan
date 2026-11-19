# 珠算 1.0.1 发布检查

珠算 1.0.1 已于北京时间 **2026-11-20 02:34:19** 正式公开并设为 latest：[下载 Release](https://github.com/primordialweave/zhusuan/releases/tag/v1.0.1)。原会话已明确授权该版本发布，本会话接续完成。十个正式附件已核对本地与服务端大小、SHA-256，匿名下载入口均返回 200。完整机器验证结果见 [release-verification-1.0.1.json](release-verification-1.0.1.json)。

## 发行来源

发行应用统一来自标签 `v1.0.1`，提交 **176c9780dbcfb0932370e9c98d5c5e7a9eb08d3a**。原候选在未公开前发现下载取消与 NSIS 显式路径产品缺陷，修复后使用旧 ref lease 更新候选；旧候选本地保留在 `archive/v1.0.1-candidate-0959eb1`。已公开 1.0.0 的十个附件名称、大小和摘要均保持不变。

| 检查 / 产物 | 运行及结果 |
| --- | --- |
| 最终应用 CI | [44569458459](https://github.com/primordialweave/zhusuan/actions/runs/44569458459)，frontend/backend/security/Docker 全部成功 |
| Windows 完整原生预检 | [44569492188](https://github.com/primordialweave/zhusuan/actions/runs/44569492188)，应用和 smoke 均为最终提交，全部成功 |
| Windows / Linux 正式产物 | [44571413947](https://github.com/primordialweave/zhusuan/actions/runs/44571413947)，两个平台各自完整 job 成功，无配方覆盖 |
| macOS 正式产物 | [44583607176](https://github.com/primordialweave/zhusuan/actions/runs/44583607176)，Intel runner 的全部步骤及最终 job 成功 |
| macOS 工作流与测试来源 | 93f59779bd260f04b94316ea94d1fa868f46b0e4；仅覆盖三份固定前端测试文件，发行 Go / 前端应用源码保持标签原样 |

最终 Release 的原 macOS job 因 GitHub hosted arm64 runner 容量不足，排队约15分钟未取得机器后自动取消，runner_id=0、无执行步骤。因此采用官方 `macos-15-intel` 标准 runner 补齐同标签两架构产物，不重复已通过的 Windows/Linux。不能称原 Release 整个 run 全绿。

Intel runner 前两次前端分别为 597/598、593/598，通过项之外存在交互总超时及日历仍 aria-busy 时默认1秒查询到期。三份固定测试夹具减少重复语义查询和非行为验证的逐字录入，显式保留角色、八步键盘导航/焦点、必填错误、保存重试和 API 断言，并给多交互流程30秒/加载条件10秒预算。最终 **115文件、598用例全部通过**，无全局超时放宽，应用源码未替换。来源记录在 artifact 和发行说明中。

## 变更与功能验收

- macOS 按 Apple Silicon / Intel 分别生成 DMG 与 ZIP。DMG 包含“珠算.app”和 Applications 快捷方式；ZIP 顶层保持 zhusuan.app 兼容1.0更新器。现代图标通过无背景画布及原画图层缩放消除额外外板，旧系统保留透明 ICNS；catalog 校验同时覆盖原图片和 manifest。
- Windows Unicode 简体中文与 UTF-8 BOM。首次安装位于 LOCALAPPDATA/PrimordialWeave/zhusuan、HKCU；保留 Orange，仅复用珠算记录；原 HKLM 安装继续按原范围更新。修复 NSIS 在 .onInit 前移除 /D 导致显式目录被注册记录覆盖，显式目标现在保持优先。
- 金额普通文本输入，只接受数字和最多两位小数；字符串补齐小数位避免科学记数。必填项中文错误/红框/首错焦点；提示组件移除粗左线。
- 令牌和通知弹层限制在视口，长令牌换行；通知详情固定高度、正文滚动、底部固定留白。
- 下载取消与 EOF 同时发生时保留已取消状态，不误报安装包不完整。稳定回归在读取开始后 CancelUpdate/Close 再返回 EOF，旧产品两分支均失败；修复后 available、无 launch/quit，未取消的大小/摘要/完整性错误继续拒绝。

Windows 正式 runner 通过默认LOCALAPPDATA/HKCU/中文注册名、两个中文快捷方式原生完整路径与hash、旧Orange保留、显式Orange目录拒绝、带空格自定义目录、已有路径/DisplayIcon回退、锁文件回滚/解锁更新、HKLM机器更新且无重复HKCU、卸载保留无关数据。WScript读取中文lnk返回空值是假阴性，最终使用 IShellLinkW/IPersistFile Unicode 接口严格验证。

Ego lite 使用隔离脱敏数据库和专用3466/9331服务，在1280×800与760×520下验收：横向溢出为0，令牌窗口512×420且长字符串换行，通知详情512×448、内部滚动并有25px固定底部留白；小窗通知弹层完整在视口内。空表单9必填中文错误、红框、焦点以及普通金额输入已验。项目类型 medicine 实际显示“医学”，天平为系统青绿 rgb(45,101,74)。[通知详情截图](screenshots/1.0.1/notification-detail-light.png) / [必填校验截图](screenshots/1.0.1/project-required-light.png)。测试令牌未进入仓库且已撤销，专用服务和ego space8均已关闭，真实账本与用户服务未改。

## 测试与正式包复验

- 前端115文件598用例、ESLint、TypeScript/production build通过；三份最终夹具本地单worker全量598通过，最终Intel CI598通过。
- Go全量race通过：16有测试包、140顶层及156子测试，无测试失败/跳过，另10包无测试文件。vet通过，golangci相对原主分支增量0新问题；全量历史告警基线保留。
- 取消相关普通和race各重复100次、各1300通过；完整updater race81通过。
- Python31用例通过，覆盖版本/完整资产/摘要/manifest、DMG元数据/架构、图标catalog兼容与过期、Linux镜像有界切换/失败传播。最新版actionlint及diff检查通过。
- 正式两DMG再次只读挂载，核对版本1.0.1、标识、唯一arm64/x86_64、严格签名、珠算.app及Applications链接；两ZIP解包同样核验。Assets.car与发行标签逐字节一致，原生NSWorkspace图标确认无白灰外板。

| 正式资产 | 字节数 |
| --- | ---: |
| Apple Silicon DMG / ZIP | 46,550,441 / 42,081,023 |
| Intel DMG / ZIP | 48,411,641 / 43,709,343 |
| Windows installer | 37,819,165 |
| Linux AppImage / deb / rpm | 107,796,984 / 36,576,420 / 37,469,833 |

三份原平台SHA清单聚合后，release.py verify/manifest/verify全部通过。草稿恰十附件（八载荷+SHA256SUMS+update.json），服务端大小/SHA256与本地逐个相同，发行说明相同后公开。发布后标签解析为最终应用提交、匿名latest update.json1.0.1、内部9条资产/8条载荷摘要一致；十下载HEAD200且Content-Length正确，旧1.0.0十附件名称/大小/digest不变。本地十文件亦重新计算SHA256与服务端一致。

## 开销与验收边界

本次未新增前端依赖。弹层仅打开期间监听尺寸/resize/scroll，关闭清理，无新增闲时网络轮询；金额本地校验。打包逐架构顺序执行并流式计算摘要。主JS chunk817.91KB（gzip264.18KB）仍有既有500KB警告；未以实现预算代替目标设备CPU/GPU、启动、内存或电池验收。

macOS仍为ad-hoc，未做Developer ID/公证；Windows无Authenticode。旧macOS Finder、真实用户UAC/系统提示、Wails原生窗口，以及真实设备完整更新重启/回滚仍须独立验收，CI与浏览器fixture不代替这些边界。
