# 珠算前端

React 19.3 + TypeScript 6 + Vite 8，路由使用 React Router，状态使用 Zustand，公共视觉层为 frontend/src/design-system 的 ODS。当前主题是烟雨/夜雨，主色为青绿色。

## 开发

使用 Node.js 24，`npm ci` 安装锁定依赖。`npm run dev` 仅提供前端开发服务；普通浏览器需要 vite.preview.config.mts 的 API 代理，Wails 使用自己的资源/API处理器。

- `npm run test:run`：Vitest。
- `node node_modules/eslint/bin/eslint.js src --max-warnings=0`：不自动修改文件的检查。
- `npm run build`：TypeScript project references 与 production build。

main.tsx 先迁移缺失的旧偏好，再动态载入 bootstrap.tsx 初始化 store/router。新的存储值优先。不要把账号/令牌直接打印到日志。

UI截图、存储路径及发布步骤见仓库根 README 和 docs/migration.md、docs/release.md。
