# 珠算 1.3.1 发布验收

2026-11-22 22:00:30（上海）已公开 [v1.3.1](https://github.com/primordialweave/zhusuan/releases/tag/v1.3.1)，应用源码固定在 `4013b83a68bcc8c458ab93c52e480ef7633229ed`。PR #37、最终主分支 CI、正式 Release 的 prepare、三平台 build、publish 均通过。

本版本包含首页默认全部合同、三范围文案与自定义 Tooltip、分析指标竖线修复及更圆润的玉手镯环图。同步全平台元数据和中英文下载入口，纳入已删除的9个本地Claude技能文件；无数据库迁移或依赖更新。标签和发行包使用固定提交，构建期间其他会话的后续改动保持原状。

本地前端126文件818例全部通过，失败/跳过/todo均0，ESLint、TypeScript、生产构建、Prettier与diff检查通过。Go race在 `. ./internal/... ./cmd/...` 范围194顶层、226子测试通过，16有测试包/10无测试包，失败和用例跳过0；另docs包2顶层/2子测试通过。Python43例、Go vet、模块校验、增量lint均通过。完整lint报告77项为历史问题，对应33文件均与1.3.0基线相同，不把完整报告称为零问题。

同依赖及构建设置重建1.3.0对比，全部JS/CSS的gzip分别减少28/74字节，字体文件SHA完全相同。UI保持同一统计请求与签约口径，新增材质均为静态SVG，没有新增轮询、滤镜或常驻动画；未声明目标设备CPU/GPU/启动性能通过。

十附件共400,440,080字节均有匿名HTTP200与实际大小/SHA256匹配记录；八应用资产共400,435,567字节，SHA256SUMS八项及update.json九项映射、说明和URL均一致，匿名latest清单与直接版本清单逐字节相同。首次RPM的TLS握手失败已仅重试该文件恢复，另外九件复核后保留，原失败日志留存。

两架构Mac ZIP的CRC/路径/权限、1.3.1版本、org.primordialweave.zhusuan标识、12.0.0最低系统、单架构与deep strict ad-hoc签名通过；两DMG完整性和只读挂载通过，Applications链接正确，与对应ZIP的可执行、Info.plist、Assets.car和icons.icns哈希一致。首次夹具的/tmp与/private/tmp比较错误改为realpath匹配，未改发行包；全部自有挂载已卸载。

原1.3.0标签与附件保留。macOS沿用ad-hoc签名，Windows沿用无Authenticode安装包；本轮没有安装/启动已发布应用或操作真实账本。Ego真实页面验证证据来自同一UI源码，覆盖三范围、鼠标/键盘、自定义提示、深浅主题及760px窄窗；SVG端点仅为绘制探针，不声明完整原生产品UI或客户设备验收。

完整结果见 [release-verification-1.3.1.json](release-verification-1.3.1.json)。
