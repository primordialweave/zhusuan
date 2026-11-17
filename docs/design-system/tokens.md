# Design Tokens

## 三层模型

### Reference tokens

`--ods-ref-*` 保存未经业务解释的原始值，例如 palette、四像素间距、字体大小、圆角和时长。它们是内部实现细节，业务页面和组件不得直接消费。

示例：

```css
--ods-ref-color-jade-500: #629569;
--ods-ref-space-4: 16px;
--ods-ref-radius-10: 10px;
--ods-ref-duration-200: 200ms;
```

### Semantic tokens

`--ods-*` 是公共样式 API，名称表达用途而非具体色值。组件和产品模式只能消费这一层。

```css
--ods-color-bg-canvas: var(--ods-ref-color-mist-50);
--ods-color-fg-default: var(--ods-ref-color-jade-900);
--ods-color-border-focus: var(--ods-color-accent-text);
--ods-radius-control: var(--ods-ref-radius-10);
```

主要分组：

- `--ods-color-bg-*`：canvas、surface、raised、glass 和交互状态。`--ods-color-bg-surface-glass-dense` 是导航玻璃的底色，比承载内容的玻璃更不透明。
- `--ods-color-scene-veil`：盖在江南场景静帧上的主题遮罩；烟雨为透明，夜雨把同一幅画压暗。`--ods-color-scene-mist` 是业务页背景上半部多加的一层雾（烟雨 30%，夜雨为透明），让面板四周的树和屋顶退后，到 Dock 上方淡出。
- `--ods-color-fg-*`：default、muted、subtle、disabled、inverse。
- `--ods-color-border-*`：default、strong、control、focus。`control` 用于复选框、单选、开关这类靠边界辨认的控件，对比度目标 3:1。
- `--ods-color-accent*` 与 `--ods-color-status-*`：品牌和语义状态。`--ods-color-accent-warm` 是杏色，只用于装饰性的笔触，不做文字色。
- `--ods-font-*`、`--ods-line-height-*`、`--ods-letter-spacing-*`：排版。`--ods-font-family-title` 是系统宋体栈，只用于页面一级标题，字重用 `--ods-font-weight-title`（900，Songti SC Black；原型标题的墨迹覆盖率 0.38，Bold 只有 0.30）。`--ods-font-family-brush` 是系统楷体栈（Kaiti SC → STKaiti → KaiTi，再回落到宋体栈），只用于登录页和 404 页的大标题；`--ods-font-family-numeral` 是斜体衬线数字栈（Baskerville → Didot → Georgia），只用于 404 的数字。两者都不随包分发。
- `--ods-space-*`、`--ods-radius-*`、`--ods-control-*`：几何。`--ods-radius-surface` 是业务面板的圆角。
- `--ods-duration-*`、`--ods-ease-*`：动效；按压使用 `--ods-duration-press`（160ms），释放使用 `--ods-duration-release`（100ms）。
- `--ods-ease-in-out`：屏幕内持续移动与形变使用的对称缓动曲线。
- `--ods-material-frost-veil`、`--ods-material-frost-rim`、`--ods-material-frost-control`：磨砂材质。磨砂不做实时模糊，而是在一张预模糊的静帧上盖 `veil`，边缘画 2px 的 `rim`；`control` 是磨砂面上输入框等控件的底色（更亮的一层玻璃，不是实色）。用于 `CloudPanel`。
- `--ods-shadow-*`、`--ods-material-glass-*`：表面与材质。`--ods-material-glass-specular` 是玻璃边缘 2px 的高光环，`--ods-material-glass-sheen` 是面上的光泽；`--ods-material-glass-shadow-dense` 是导航玻璃的整组阴影。
- `--ods-data-*`：Canvas/Chart.js 等数据可视化角色。`--ods-data-part-paid`、`--ods-data-part-pending` 是已收与待收两段构成的颜色。
- `--ods-shell-*`：Wails/macOS 标题栏和应用壳层尺寸，包括 `--ods-shell-dock-width`、`--ods-shell-dock-height`、`--ods-shell-dock-offset`，以及 Dock 项的 `--ods-shell-dock-icon-size`、`--ods-shell-dock-label-size`、`--ods-shell-dock-label-weight`、`--ods-shell-dock-item-gap`。

### Component tokens

组件在自己的根 class 内声明局部 token，并根据 variant 重映射。局部 token 不作为全局 API：

```css
.ods-button {
  --ods-button-bg: var(--ods-color-accent);
  --ods-button-fg: var(--ods-color-accent-fg);
}

.ods-button[data-variant="secondary"] {
  --ods-button-bg: var(--ods-color-bg-surface-raised);
  --ods-button-fg: var(--ods-color-fg-default);
}
```

## 主题

- `:root:not([data-theme])` 与 `[data-theme='light']` 使用烟雨（`themes/jiangnan-mist.css`）。
- `[data-theme='dark']` 使用夜雨（`themes/jiangnan-night.css`）。
- `auto` 是 theme store 中的用户偏好；DOM 只接收解析后的 `light` 或 `dark`。
- 两个主题必须声明同一组 `--ods-*` theme tokens。契约测试会阻止单主题缺项。

## Canvas 与第三方库

Canvas 不可靠地解析 CSS custom property。Chart.js 等库应通过 `@/design-system` 导出的 `readDesignToken()` 读取 computed styles，再传入 `--ods-data-*` 值。禁止在 TypeScript 中维护一份 light/dark 三元色表。主题切换后重新读取。

## 兼容层已移除

全路由迁移完成后，`compatibility.css` 与旧 `styles/tokens.css` 已删除。生产组件、patterns
和页面 feature CSS 只允许消费 `--ods-*` semantic tokens；契约测试会阻止 `--color-*`、
`--space-*`、`--motion-*` 等旧 alias 回流。

## 新 token 的准入条件

1. 先证明现有 semantic token 无法表达该用途。
2. 主题相关 token 必须在烟雨与夜雨同时定义。
3. 文字、软色底和渐变色标的组合要通过 `tokens/contrast.test.ts`。
4. 名称描述角色，不包含页面或临时视觉名称。
5. 组件私有差异优先使用局部 component token。
6. 添加或修改 token 时同步契约测试和本文档。
