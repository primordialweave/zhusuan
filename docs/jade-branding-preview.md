# 玉雕品牌资源与介绍预览

日期2026-11-20。本次按用户要求只修改和验证，**不发布新版本，等待确认**。版本号与公开Release/标签保持不变。

关于页图标使用用户新增“玉雕风珠算字标.png”；应用各平台图标使用“帝王绿翡翠算盘图标.png”。原文件均不改，44项派生资源覆盖macOS ICNS/catalog、Windows ICO/MSIX、Linux、Android、iOS和Web/favicon。原生macOS图标已确认没有外板/主体裁剪，原图透明边缘零星彩点保留。

默认slogan：**心中有数，账目有序**。`.env` 设置 `APP_SLOGAN="你自己的介绍"`，重启应用或服务生效。未配置、空值、仅空白都回退默认。环境变量优先于.env。已鉴权 `/api/v1/system/info` 只返回version/slogan/wechat_public_account，不暴露其它配置；旧后端/加载失败保留前端默认。

[浅色关于页](screenshots/jade-branding/about-light.png) / [深色关于页](screenshots/jade-branding/about-dark.png) / [深色小窗](screenshots/jade-branding/about-dark-small.png) / [原生Mac图标](screenshots/jade-branding/macos-icon.png)。关于页浏览器验证默认浅1280×800、深760×520横向溢出0。

前端614/116文件、ESLint和productionbuild通过；Go全量race144顶层168子测试/16包、vet/增量静态0，Python31通过。配置新增6子例/handler3子例、route匿名401，页面自定义值与请求失败回退测试通过。Mac原生验证使用临时复制bundle，未启动/替换用户应用。

资源开销：派生资产合计+857750B（约838KiB），canonicalPNG-282116B；Web256PNG+16995B。About字标546201B只在关于页加载；系统info仅关于标签请求，无新增轮询。主JS868.21KB/gzip272.30KB，保留既有500KB构建提示。未以构建代替真实Windows设备图标/旧系统验收。

隔离运行时配置端到端：在临时目录.env设APP_SLOGAN="每一笔，都有着落"，全新SQLite/独立JWT/API3466，实际登录后鉴权GET/info200仅返回version+slogan，关于页实际显示自定义文案且无横溢。不是以mockfetch代替AxiosXHR接口证据。真实用户账本与3456/9245服务未操作。

本次自有ego空间14、9331前端预览与3466隔离服务已关闭；真实.env仅增加APP_SLOGAN默认项，不改其它配置。未创建Release、版本标签、PR或推送分支；当前改动留在本地codex/jade-branding-slogan等待用户确认。

微信公众号名称也可配置：`APP_WECHAT_PUBLIC_ACCOUNT="原初织界"`，默认“原初织界”，自定义值去首尾空白，未配置/空白时回退默认。与slogan共用已鉴权system/info请求（增加wechat_public_account字段），无额外请求或轮询；修改.env重启生效。本次仍只修改本地，不发版。
