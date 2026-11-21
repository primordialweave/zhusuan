# 珠算当前品牌与配置检查

日期：2026-11-20。用户要求修复.env.example中的Orange和旧更新仓库，并检查其它位置。本次只完成本地修改，沿用品牌任务的“等确认、不发版”要求。

## 已修正

- `.env.example` 标题改为珠算，`GITHUB_REPO=primordialweave/zhusuan`，数据库名示例为zhusuan；DB_PATH/LOG_PATH留空使用系统用户配置目录下的珠算库与日志。现有自定义库仍应保留其显式路径。
- 本地 `.env` 的旧GITHUB_REPO同步新仓库，仅改该非敏感配置，不修改实际数据库、日志、自定义连接或凭据。运行中的应用需要重启才能重新加载。
- 系统更新接口不再写旧仓库fallback，沿更新器现有规范化逻辑处理空值/历史别名，实际请求新仓库。
- API启动日志、logger备用文件名、新库seed的示例邮箱、SQL示例、第三方声明标题及Docker忽略当前构建产物已对齐。
- 当前Compose模板传入新仓库和关于页配置，默认镜像使用CI实际产出的main标签；新库默认名/path为zhusuan，已有卷/云数据库应保留原路径、库名、账号。
- 监控容器/网络/Prometheus job/alert/Promtail路径、API3456端口、Grafana显示标题及当前部署/贡献指南已对齐。监控密码由环境显式配置，不改用户现有密码。未提供的exporter目标注释，后端不存在的AlertManager默认webhook禁用，文档明确自行接入真实接收服务。

## 保留的旧名称

旧数据库位置、Keychain/WebView/本地偏好键、Orange.exe/app、旧更新helper与历史资产/仓库别名用于升级迁移，必须继续识别；旧弱JWT黑名单继续拒绝历史弱密钥。原LICENSE版权、历史计划/发布验收/实际Vercel地址均是来源记录，不全文替换。Grafana旧dashboard UID是稳定标识，保留避免断开已有链接。ODS技术缩写及历史文档文件名不改。

## 验证

新增隔离测试实际复制.env.example再Load，验证默认库/日志落在config/primordialweave/zhusuan内，新仓库和数据库名正确。补齐LOG_PATH空白fallback；前端617例/116文件、ESLint，Go race146顶层174子测试/16有测试包、vet、增量静态检查0新问题全部通过。两个Compose使用临时env文件config校验通过，没有启动服务或加载真实.env；9份YAML/dashboardJSON和Prometheus抓取/告警一致性通过。历史仓库别名测试继续通过。

没有修改或移动用户账本，没有运行部署、发布或改变公开版本。
