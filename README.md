# Math Draft

Math Draft 是一个面向数学推导场景的前端工作台（Vue 3 + MathLive）。
它不是“单条公式编辑器”，而是把推导过程拆成可管理的“行/页/草稿本”，并提供历史快照、回收站、导入导出、坚果云同步和 AI 助手。
详细使用说明见 `help.md`。

## 1. 项目定位

这个项目解决的是“推导过程管理”问题，而不只是公式输入问题：

- 逐行推导：每一步都可编辑、可复制、可删除。
- 过程可回溯：随时保存快照并恢复。
- 本地优先：无需项目自建后端，开箱即用。
- 云端备份：支持通过坚果云 WebDAV 做手动/自动同步并恢复历史版本。
- AI 辅助：在已有上下文上继续推导，而不是孤立问答。

## 2. 主要功能

### 2.1 工作区（Workspace）

- 多草稿本管理：新建、重命名、删除。
- 多分页编辑：一个草稿本可包含多个页面。
- 行级输入：每行是一个 `math-field`。
- 回车换行策略可配置：默认回车新建下一行；可设置“新行首字符为等号”（默认开）。
- 快捷模板插入。
- 行选择与批量操作：复制/删除。
- 输出区预览：`current` / `all` / `aligned`。

### 2.2 历史快照（Snapshots）

- 将当前页面保存为快照（带名称与时间）。
- 搜索、重命名、恢复。
- 全选与批量删除。
- 快照复制格式：`aligned` / Markdown 公式块 / 纯文本。

### 2.3 回收站（Recycle Bin）

- 草稿本删除与快照删除进入回收站。
- 支持单条恢复、全部恢复、清空。
- 带数量上限，避免本地无限膨胀。

### 2.4 导入导出

- 导出当前草稿本。
- 导出草稿本 + 快照组合包。
- 导出全部草稿本备份。
- 导出/导入时可勾选是否包含 AI 会话记录。
- 支持单独导出 AI 会话 JSON、单独导入 AI 会话 JSON。
- JSON 导入时采用“追加”策略，不覆盖现有内容。

### 2.5 AI 助手（OpenAI 兼容）

- 右侧采用 `AI 助手 / 设置` 双页签。
- 会话管理：新建、切换、编辑、删除、重试。
- API 节点管理：`baseUrl` / `model` / `apiKey` / `customParams`。
- 系统提示词管理。
- 上下文模式：`none` / `current-flow` / `selected-lines` / `whole-notebook`。
- 思考模式：`off` / `on` / `deep`。
- 流式接收并实时渲染。
- 支持 `<think>...</think>` 思考块解析；响应结束后自动收起思考块。

### 2.6 坚果云同步（WebDAV）

- 支持手动同步到坚果云（WebDAV 地址默认 `https://dav.jianguoyun.com/dav/`，可改为任意兼容地址）。
- 支持按固定频率自动同步（分钟级）。
- 支持远程历史版本列表与一键恢复。
- 最大备份数可配置；可切换为“无限制”。
- WebDAV 同步/恢复会遵循“导出时包含 AI 会话记录 / 导入时应用 AI 会话记录”勾选项。

## 3. AI 请求与流式渲染机制

AI 发送流程（实现位于 `src/composables/workbench/aiAssistantActions.js`）：

1. 读取当前会话、节点、提示词、上下文模式。
2. 组装请求消息（系统提示词 + 上下文 + 历史消息）。
3. 发送 `stream: true` 请求到 OpenAI 兼容接口。
4. 通过 SSE 持续消费增量（`reply` + `thinking`）。
5. 实时合并写回当前 assistant 消息，前端立即渲染。
6. 失败时回滚空消息并给出错误提示。

对应的底层拆分在 `src/composables/workbench/aiAssistant/`：

- `request.js`：请求构造与参数解析。
- `stream.js`：SSE 流消费与 delta 提取。
- `response.js`：回复/思考提取与合并。
- `entities.js`：实体构建。
- `constants.js`：AI 常量与默认值。

## 4. 技术栈

- Vue 3
- Vite 5
- MathLive
- markdown-it + markdown-it-texmath + markdown-it-container
- KaTeX
- DOMPurify

Vite 配置中将 `math-field` 作为自定义元素处理（见 `vite.config.js`）。

## 5. 代码结构

```text
src/
├─ App.vue
├─ main.js
├─ style.css
├─ components/
│  └─ AiAssistantSidebar.vue
├─ composables/
│  ├─ useMathScratchWorkbench.js
│  └─ workbench/
│     ├─ constants.js
│     ├─ shared.js
│     ├─ aiContext.js
│     ├─ aiStore.js
│     ├─ workbenchLifecycle.js
│     ├─ lineNotebookActions.js
│     ├─ historyActions.js
│     ├─ recycleBinActions.js
│     ├─ exportImportActions.js
│     ├─ nutstoreSyncActions.js
│     ├─ aiAssistantActions.js
│     └─ aiAssistant/
│        ├─ constants.js
│        ├─ entities.js
│        ├─ request.js
│        ├─ response.js
│        └─ stream.js
└─ styles/
   ├─ layout.css
   ├─ sidebar-tabs.css
   ├─ sidebar-tabs/
   │  ├─ tabs.css
   │  ├─ snapshots.css
   │  └─ assistant.css
   ├─ editor-header-tools.css
   ├─ editor-lines-controls.css
   ├─ recycle.css
   └─ responsive.css
```

## 6. 模块职责（简版）

- `src/App.vue`：三栏布局壳层，连接工作区、输出区、回收站、AI 组件。
- `src/components/AiAssistantSidebar.vue`：AI 会话 UI、Markdown/LaTeX 渲染、思考块 UI。
- `src/composables/useMathScratchWorkbench.js`：状态聚合与模块装配入口。
- `src/composables/workbench/lineNotebookActions.js`：草稿本/页面/行编辑逻辑。
- `src/composables/workbench/historyActions.js`：快照逻辑。
- `src/composables/workbench/recycleBinActions.js`：回收站逻辑。
- `src/composables/workbench/exportImportActions.js`：导入导出逻辑。
- `src/composables/workbench/nutstoreSyncActions.js`：坚果云 WebDAV 同步与历史恢复逻辑。
- `src/composables/workbench/workbenchLifecycle.js`：持久化与生命周期监听。
- `src/composables/workbench/aiStore.js`：AI 存储结构归一化。
- `src/composables/workbench/aiContext.js`：AI 上下文摘要与拼装。

## 7. 本地存储与数据兼容

本项目将数据保存在浏览器 `localStorage`，关键键：

- `math-scratch.notebooks.v3`
- `math-scratch.notebooks.v2`（旧版本兼容读取）
- `math-scratch.active-notebook.v3`
- `math-scratch.recycle-bin.v1`
- `math-scratch.enter-equation-line-on-enter.v1`
- `math-scratch.ai-assistant.v1`
- `math-scratch.nutstore-sync.v1`
- `math-scratch.import-export-options.v1`

导入导出数据版本为 `version: 3`。

## 8. 快速开始

### 环境要求

- Node.js 18+
- npm 9+

### 安装与运行

```bash
npm install
npm run dev
```

### 构建与预览

```bash
npm run build
npm run preview
```

## 9. npm scripts

- `npm run dev`：启动开发服务器。
- `npm run build`：生产构建。
- `npm run preview`：本地预览生产构建结果。

## 10. 使用建议工作流

1. 新建草稿本，按题目拆分页。
2. 在工作区逐行推导，阶段性保存快照。
3. 需要分支尝试时，新建页面或恢复快照。
4. 需要外发时，按目标格式导出或复制。
5. 使用 AI 时按需切换上下文来源，保证回答贴近当前推导。
6. 关键阶段执行坚果云手动同步；若开启自动同步，定期检查历史版本是否生成。

## 11. 常见问题

### Q1：为什么某些 LaTeX 没有按预期渲染？

- 检查 `$$...$$` 是否成对且独立成行。
- 检查是否混入了普通文本导致数学解析冲突。
- 多行推导建议使用 `aligned` 环境。

### Q2：数据会不会丢失？

- 日常编辑会自动持久化到本地。
- 仍建议定期执行“导出全部备份”。

### Q3：AI 为什么回答不够贴合当前页面？

- 检查上下文模式是否设为 `current-flow` / `selected-lines` / `whole-notebook`。
- 检查系统提示词是否被误改。

### Q4：坚果云同步失败怎么办？

- 优先确认使用的是坚果云 WebDAV 地址（默认 `https://dav.jianguoyun.com/dav/`）。
- 使用“应用密码”而不是登录密码。
- 检查 `WebDAV 地址 / 用户名 / 应用密码` 三项是否填写完整。

## 12. 开发与维护注意事项

- 所有源码文件建议使用 UTF-8 编码保存，避免中文乱码。
- 项目是纯前端应用，AI 接口地址与密钥由用户自行配置。
- 对高风险场景（考试/论文/生产推导）请人工复核 AI 结果。

## 13. License

MIT License
