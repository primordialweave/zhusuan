# 珠算 1.2.0 发布验收

用户于 2026-11-22 明确授权提交当前代码并公开 v1.2.0。发行包含玉质 SVG 图标、十组品牌空态、短时交互反馈、组件和图表材质，以及全平台应用图标与 macOS 资源目录深浅双态。

## 本地检查

- 前端 Vitest：118 个文件、746 个用例全部通过；单 worker，失败 0。
- 非修改式 ESLint、`tsc --noEmit -p tsconfig.app.json` 与生产 Vite 构建通过。
- `go test -mod=readonly -race -json ./...`：150 个顶层测试、183 个子测试，17 个测试包通过，失败和跳过测试 0。另 15 个包没有测试，包含脚手架和依赖目录。
- `go vet -mod=readonly ./...`、`go mod verify`、增量 golangci-lint 通过，新增 issues 0。
- Python 发布/图标测试 32/32 通过，`git diff --check` 通过。
- 当前 macOS 图标来源摘要匹配浅色 PNG、深色 PNG 和 Icon Composer JSON；`assetutil` 确认独立 Aqua/DarkAqua 图组，ictool Default/Dark 导出图已复核。

首次浏览器检查发现：仅启动时检查 reduced-motion，不能取消已经开始的 WAAPI ripple/pulse。已补应用 MutationObserver 与系统 media change 监听，动画完成/取消/卸载时释放，并新增 5 个回归；最终全量 118 文件/746 用例通过。Ego/WebKit 中途切换均立即取消，监听器无长期驻留。

证据保留于 `/tmp/zhusuan-release-1.2.0`。CI 和正式发行结果完成后追加机器记录，不以旧版本的成功替代当前源码验证。

## 性能与验收范围

Remix 字体依赖和 CSS 导入已移除。SVG 渐变由应用根节点共享，图标交互按实际操作触发，没有新增长期后台轮询或动画依赖。分析折线图增加每次重绘的静态阴影，指针交互有有限滤镜过渡；这些渲染开销须与包体积一起记录。

本地生产主 JS 943.05 kB / gzip 288.23 kB，仍有既存 500 kB chunk 提示。系统和应用减少动态设置均纳入回归。浏览器检查和实现预算不代表目标硬件 CPU/GPU、内存、启动时间或电池验收。

与 1.1.0 代码对应的 main CI `44873141644` 前端产物比较，全部 JS gzip 从 277,491 增至 289,973 字节（+12.2 KiB）；CSS gzip 从 79,197 降至 60,975 字节（-17.8 KiB），woff2 文件从 305,340 降至 116,124 字节（-184.8 KiB）。完整 dist 从 26,830,988 降至 26,475,929 字节（-346.7 KiB，包含公开图片资源）。比较统一使用 Python gzip/mtime=0，详见机器记录。

macOS 资源目录支持系统深浅外观；Wails 运行时 Dock 仍嵌入浅色 PNG。macOS 使用 ad-hoc 签名，未 Developer ID/公证；Windows 未 Authenticode。移动平台仅图标/版本与脚手架同步，不声明移动分发完成。

## 发布和保护范围

通过 PR/main CI 后，从正式 main 提交创建 v1.2.0，跟进 prepare、macOS/Windows/Linux build 和 publish。必需十附件为两架构 DMG/ZIP、Windows 安装器、Linux AppImage/deb/rpm、SHA256SUMS 与 update.json。公开后验证匿名 latest manifest、九条资产映射及十个下载入口，并比较旧公开标签与资产名称/大小/SHA256。

不连接真实账本或云库，不替换用户已安装应用，不改 Keychain、HOME 或全局 Git 配置。历史 design-qa.md 删除、根 node_modules 与非必需生成 events/index.ts 保持工作区状态。独立 QA 服务按精确 PID 关闭。

## 浏览器复核

Ego Lite 与 WebKit 各检查 8 个主/表单路由、8 个设置 tab，浅/深与 1280×800/760×620，共 128 个布局观测，全部无横向溢出、共享渐变根各 1 份。WebKit 页面错误 0；登录另外检查 Ego 浅色与 WebKit 浅/深。项目详情三操作 SVG 均 20×20，六个 gallery 图标的 16/20/32 尺寸均准确。

Ego 20 次 hover 反转、WebKit 每主题 20 次反转，键盘按钮/Option+Tab+Enter 清除与触摸 reduced 清除通过。两引擎 app/OS 中途切换后 active WAAPI 均为空。SaveText transport 成功 fixture 后真实 UI 导航到第二项目，反馈 overlay 为 0，三个图标 opacity 均为 1；未打开真实 native 保存对话框或写导出文件。初次 QA 使用独立 router 实例超时，修正为真实链接后通过，原日志保留。

[浅色复核图](screenshots/release-1.2.0/light.jpg) · [深色复核图](screenshots/release-1.2.0/dark.jpg)。两张联系图逐图复核无可行动项，环图同心、图标清晰完整；未将 viewport 外表单视作全页视觉验收。没有执行 10% 慢放、原生 Retina、屏幕阅读器或新完整慢网矩阵；加载失败/旧请求仍由现有回归覆盖。Ego 未另行采集 page exception/console error，不宣称其为 0。
