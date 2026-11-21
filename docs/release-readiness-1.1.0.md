# 珠算 1.1.0 发布检查

日期：2026-11-21。用户明确授权提交并发布，选择1.1.0，覆盖此前本地待确认限制。

## 发布范围

玉雕字标与帝王绿算盘资源、公开品牌配置与旧配置整理、玉质组件与选择清除、全界面Skeleton、计划批次收款口径与查询失败隔离，以及主分支已合入的依赖更新。目录迁移属于开发环境记录，不改变客户数据位置。

用户/通知新查询失败不再回显旧数据，保留同查询缓存；Swagger运行时模板、JSON和YAML同步真实字段/路由/Bearer定义。新cohort统计仅增加按user/status/plan_date过滤的一条SUM；现金流口径保持actual_date，缓存统一v2。

## 验证状态

- 冻结快照前端116文件650例、ESLint/TypeScript/production build通过；Python发布工具31例通过。
- Go全量race150顶层183子测试/17测试包通过，0失败/0测试跳过，另10包无测试；vet、模块verify、相对origin/main增量lint0、actionlint1.7.12全部工作流通过。
- macOS本地打包与发行CI正在进行，run与平台结果将在完成后记录。
- PR33 CI44867310036与mainCI44868152544四job均成功。首轮Release44868158371 Linux649/650，唯一失败为Analytics测试过早捕获尚未创建Chart的undefined；受控复现确认夹具问题，调整为先动态等待实例labels，再保留实例校验旧响应，产品代码、断言、timeout不变。修复定向12次及14文件内例全过，候选仍未公开。
- 此前Skeleton验证：前端644例、Ego/WebKit各30种界面/主题加载组合通过；当前P2修复另有12例定向回归通过。本次冻结快照重新全量验证通过。
- Go docs/handler补充回归、字体清理与1.1.0全平台元数据校验通过；Windows/Linux与macOS发行产物由CI验证。
- 初轮前端647/650仅三个native恢复测试写死v1.0.2；现读取pkg.version，未削弱等待/状态断言。初轮与冻结快照日志保留。

## 性能与分发边界

- Skeleton仅数据等待阶段使用现有CSS动画，同范围刷新保留数据；系统/应用reduce均停止动画。没有新增后台请求或JavaScript循环；用户主动重试复用原接口。
- 新API仍是三字段白名单；公众号与简介共用一条请求。主JS此前882.56kB，当前发行构建已完成并将记录包大小；既有500kBchunk提示与目标硬件CPU/GPU/电池验收分开。
- 图标源与43个派生资源历史摘要一致，当前Assets.car可因工具时间戳变化，须核来源stamp与发行bundle实际渲染；不将历史JSON摘要当当前catalog证据。
- macOS包使用ad-hoc签名，未Developer ID/公证；Windows未Authenticode。移动平台仅资源/脚手架同步，不声明分发验收。

## 保护范围

不连接真实账本/云库，不修改HOME/globalGit配置/Keychain。根node_modules缓存、生成events/index.ts与原design-qa.md删除不纳入本功能提交。旧公开1.0.0/1.0.1/1.0.2标签与附件保持不变；新十附件完整后公开并核匿名更新入口。

## 正式发布结果

北京时间 2026-11-21 13:41:22 已公开并设 latest：[v1.1.0](https://github.com/primordialweave/zhusuan/releases/tag/v1.1.0)。应用标签固定于 `044d5b58c4313b56c584308cfd36cb4997f7767f`；PR33/34 与最终 main CI 均四job成功。最终 [Release44870825972](https://github.com/primordialweave/zhusuan/actions/runs/44870825972) prepare、三平台 build 与 publish 全部成功。

首轮44868158371的Windows/macOS通过、Linux649/650与publish跳过保留为失败历史；受控夹具问题经测试等待顺序修复，仅修改test/docs，未更改应用代码/断言/超时。未公开候选更新后全部三平台统一重建，最终没有配方覆盖。

十附件本地CI载荷与公开API大小/SHA256完全一致，SHA256SUMS和update.json九条资产对应正确；匿名latest manifest内容一致，十download HEAD200与长度通过。公开1.0.0/1.0.1/1.0.2的附件名/大小/digest及标签commit不变。正式两架构ZIP路径/CRC、版本/标识/minOS/唯一架构、ad-hoc deep strict签名及DMG只读目录/Applications链接检查通过，临时mount已detach。当前JS883.22kB/gzip275.49kB，CSS351.37kB/gzip68.45kB；不能据此声明目标设备性能或公证。

机器证据见 [release-verification-1.1.0.json](release-verification-1.1.0.json)。Windows普通用户安装/升级/原生窗口由最终发行runner通过；没有在用户设备替换已安装应用或改真实账本。
