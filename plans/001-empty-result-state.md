# 001 — 先区分真实空结果与请求失败

- Status: DONE (branch `feat/jade-icons-motion`)
- Commit: 555c2fd
- Severity: HIGH
- Category: Purpose / state meaning
- Scope: 4 个数据控制器及其回归测试；无视觉布局改动

## 问题与当前证据

- `frontend/src/components/settings/TokenManagement.tsx:81`：请求失败只有 toast，`finally` 直接关 loading，缺少 `requestIdRef`/unmount 保护；初始 `tokens=[]` 随后误入“暂无访问令牌”。此外若列表原为空、用户新建首个令牌成功后随后的 `fetchTokens()` 失败，也会残留 `tokens=[]` 误报空态。
- `frontend/src/components/settings/DictionaryManagement.tsx:61` 与 `:83`：条目请求失败后 `finally` 仍把 `code` 写入 `loadedItemsCodeRef`/`itemsScope`；且当上层**字典分类 `list()`** 首载失败时，`activeDictId` 保持 `''`，直接掉入“字典还没有条目”的伪空态且无分类重试入口。
- `frontend/src/components/settings/DataSyncPanel.tsx:90`：compare 缺少 `requestIdRef`/unmount 保护，失败仅关 loading，初始空结果误入“暂无对比数据”；同时顶部 `settings-stats` 露出 `0 / 0 / 0`，第 338 行“开始同步”按钮仅受 `disabled={loading}` 控制导致失败态仍可点击；第 93 行 `JSON.stringify(cloudConfig)` 含明文 `password`。
- `frontend/src/components/layout/NotificationEntry.tsx:92`：请求失败也在 `finally` 写 `loadedUserId`，混淆了“首轮尝试结束（收起 Dock 旁 Skeleton）”与“首次成功建立 baseline（允许判暂无通知与后续未读摇铃）”。

以上失败分支绝不能触发“算盘归位/暂无”品牌空态动画。

Token 现有结构：
```ts
try {
  const response = await tokenApi.list()
  setTokens(response.data.data)
} catch {
  toastError('获取令牌列表失败')
} finally {
  setLoading(false)
}
```

## 目标

每块数据区显式区分 `waiting`、`成功 data`、`error`：
- 仅在**请求成功且结果为空**时显示 `EmptyState` 并允许品牌空态入场动画；
- 请求失败时结束 Skeleton 并展示对应错误与明确的重试动作（后台静默轮询除外）；
- 同 query 已有成功 data 时刷新失败，保留既有 data 并提示失败反馈；跨 query 失败不得恢复旧 query 的行或统计数字。

## 执行步骤

1. **参照既有范式建立显式状态门控**：参照 `frontend/src/views/ProjectsView.tsx:75` 的 `loadedQueryScope` / `failedQueryScope` 与 `requestIdRef` + `mountedRef` 守卫，分别为 Token 列表、Dictionary（分类与条目两层）、Sync compare 建立真实的成功/失败标记，严禁在 `finally` 中写入成功态。
2. **TokenManagement**：
   - scope key 为当前会话，补充 `requestIdRef` 与 unmount 清理；
   - 首载失败展示错误态与“重试”按钮，不进入“暂无访问令牌”；
   - 同会话已有非空列表刷新失败保留既有列表；但若此前列表为空、创建首个令牌成功后紧跟的 `fetchTokens()` 失败，须进入列表刷新失败态并允许重试，不得继续显示“暂无访问令牌”。
3. **DictionaryManagement（分离两层失败态）**：
   - 分类层（`fetchDictionaries`）与条目层（`fetchDictItems(code)`）各自独立记录 loaded/failed 状态与 generation guard；
   - 分类首载失败时结束 Skeleton，展示“字典分类加载失败”及重试 `fetchDictionaries`，禁用新增条目，不落入“字典还没有条目”；
   - 分类成功但当前 `activeDictId` 条目失败时，展示当前分类条目加载失败及重试 `fetchDictItems(activeDictId)`，跨 Tab 切换失败不得残留上一个分类的条目。
4. **DataSyncPanel**：
   - 为 `compareData` 补充 `requestIdRef`、unmount 与切回 `config` 步骤时的 `refreshTimer` 清理；
   - compare scope 以提交时的连接配置快照区分，但**不得将明文 `password` 写入日志、DOM、公开诊断或 React state**（改用纯 ref 对比或非明文指纹）；
   - compare 未成功/失败时，顶部 `settings-stats` 显示 `—`（不露假 `0` 或旧配置统计），禁用“开始同步”按钮，下方展示对比失败与重试，不落入“暂无对比数据”。保持既有请求次数，不新增轮询。
5. **NotificationEntry（拆分 Dock 静默态与 Popover 错误态）**：
   - 保留既有 30s poll 与 `pendingReadMutationsRef` 读写隔离；
   - 拆分两个状态：`attemptedUserId`（首轮请求结束即收起 Dock 旁圆形 Skeleton，避免后台首载失败时 Skeleton 卡死 30s 或在 Dock 旁弹出干扰性报错）与 `baselineUserId`（仅在首次成功拿到未读数与列表后写入，用于门控“暂无通知”与 `003` 的未读增加摇铃）；
   - 仅当 Popover 处于打开态、尚未有当前用户缓存列表且请求失败时，在 Popover 列表区内展示错误与重试按钮，不阻断 Dock 主导航。
6. **状态渲染顺序与回归测试**：
   - 各控制器统一遵循 `loading（无当前 scope 数据） → error（无当前 scope 数据） → data 为空（品牌空态） → data 列表`；
   - 新增 deferred 异步回归测试：首载失败→error 且无 empty art；跨 scope 失败不露旧 rows/count；重试→data；same-scope 刷新失败保留 data；旧请求/旧会话/unmount 不回写新状态；`NotificationEntry` 首载失败收起 Skeleton 且不写 baseline、打开弹层失败展示重试；`TokenManagement` 空态创建后刷新失败不伪空。

## 边界与完成标准

不改后端 API/SQL、权限或敏感存储，不虚构“无权限”页面，不改 UI 业务数值与既有新建/复制/确认流程。完成时四区域的成功、失败、真实空结果均可独立观测，失败无永久 Skeleton、无伪空态、无明文密码泄露，后续 `004` 品牌空态动画仅响应真实 empty。

## 共享基线与验证

严格遵循 [plans/README.md](README.md) 中的「共享基线、项目约定与通用验证」。本任务无视觉布局改动，以类型检查、ESLint、四控制器新增异步状态回归与全量 `npm run test:run` 为核心验收。
