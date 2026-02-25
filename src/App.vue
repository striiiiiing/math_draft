<script setup>
import { computed, ref } from 'vue';
import AiAssistantSidebar from './components/AiAssistantSidebar.vue';
import { useMathScratchWorkbench } from './composables/useMathScratchWorkbench';

const {
  notebooks,
  activeNotebookId,
  activePageId,
  draftLines,
  selectedLineIds,
  selectedSnapshotIds,
  activeLineId,
  newNotebookName,
  notebookNameDraft,
  snapshotNameDraft,
  searchQuery,
  renamingSnapshotId,
  fileInputRef,
  copiedSnapshotId,
  recycleBinItems,
  showRecycleBin,
  enterCreatesEquationLine,
  quickTemplates,
  activeNotebook,
  snapshots,
  filteredSnapshots,
  allSnapshotsSelected,
  recycleBinCount,
  aiSessions,
  activeAiSessionId,
  aiPromptDraft,
  aiEndpoints,
  activeAiEndpointId,
  aiSystemPrompts,
  activeAiSystemPromptId,
  aiContextMode,
  aiThinkingMode,
  aiIsRequesting,
  aiLastError,
  activeAiSession,
  activeAiEndpoint,
  activeAiSystemPrompt,
  aiContextSummary,
  setMathFieldRef,
  setActiveLine,
  isLineSelected,
  toggleLineSelection,
  selectNotebook,
  selectPage,
  addPage,
  removePage,
  createNotebookAction,
  renameActiveNotebook,
  deleteNotebook,
  onLineInput,
  insertLineAfter,
  addLineToEnd,
  insertEquationLineAfter,
  deleteLine,
  deleteSelectedLines,
  clearDraft,
  insertTemplate,
  copyLineText,
  copySelectedLinesAs,
  saveSnapshot,
  restoreSnapshot,
  startRenameSnapshot,
  finishRenameSnapshot,
  deleteSnapshot,
  toggleSelectAllSnapshots,
  deleteSelectedSnapshots,
  makePreview,
  formatTime,
  exportCurrentNotebook,
  exportNotebookBundle,
  exportAllNotebooks,
  triggerImport,
  handleFileImport,
  copySnapshotData,
  openRecycleBin,
  closeRecycleBin,
  restoreRecycleBinItem,
  restoreAllRecycleBinItems,
  clearRecycleBin,
  createAiSessionAction,
  deleteAiSession,
  selectAiSession,
  updateAiMessage,
  deleteAiMessage,
  sendAiPrompt,
  retryAiMessage,
  setAiContextMode,
  setAiThinkingMode,
  selectAiEndpoint,
  addAiEndpoint,
  removeAiEndpoint,
  updateAiEndpointField,
  selectAiSystemPrompt,
  createAiSystemPromptAction,
  removeAiSystemPrompt,
  updateAiSystemPromptField,
} = useMathScratchWorkbench();

const outputMode = ref('current');
const isOutputCollapsed = ref(false);
const sidebarView = ref('notebooks');
const isSidebarCollapsed = ref(false);

const outputText = computed(() => {
  const lines = draftLines.value.map((line) => line?.latex ?? '');
  const nonEmptyLines = lines.filter((line) => line.trim().length > 0);
  if (outputMode.value === 'current') {
    const current = draftLines.value.find((line) => line.id === activeLineId.value)?.latex ?? '';
    return current || draftLines.value[0]?.latex || '';
  }
  if (outputMode.value === 'aligned') {
    if (nonEmptyLines.length === 0) return '';
    return '\\begin{aligned}\n' + nonEmptyLines.join(' \\\\\n') + '\n\\end{aligned}';
  }
  return lines.join('\n');
});

const outputRenderLatex = computed(() => {
  const lines = draftLines.value.map((line) => line?.latex ?? '').filter((line) => line.trim().length > 0);
  if (lines.length === 0) return '';
  if (outputMode.value === 'current') {
    const current = draftLines.value.find((line) => line.id === activeLineId.value)?.latex ?? '';
    return current || lines[0] || '';
  }
  return '\\begin{aligned}\n' + lines.join(' \\\\\n') + '\n\\end{aligned}';
});

function handleLineEnter(lineId, event) {
  if (event.defaultPrevented || event.isComposing || event.altKey) return;
  if (event.shiftKey || event.ctrlKey || event.metaKey) return;
  event.preventDefault();
  if (enterCreatesEquationLine.value) {
    insertEquationLineAfter(lineId);
    return;
  }
  insertLineAfter(lineId, '');
}

function clearSelectedLines() {
  selectedLineIds.value = [];
}

function clearSelectedSnapshots() {
  selectedSnapshotIds.value = [];
}
</script>
<template>
  <div class="app-container">
    <input type="file" ref="fileInputRef" accept=".json" style="display:none;" @change="handleFileImport" />

    <aside :class="['sidebar workspace-sidebar', { collapsed: isSidebarCollapsed }]">
      <div class="sidebar-header">
        <h2><span v-if="!isSidebarCollapsed">工作区</span></h2>
        <button class="icon-btn" @click="isSidebarCollapsed = !isSidebarCollapsed">{{ isSidebarCollapsed ? '‹' : '›' }}</button>
      </div>
      <template v-if="!isSidebarCollapsed">
        <div class="sidebar-switch">
          <button type="button" :class="['sidebar-switch-btn', { active: sidebarView === 'notebooks' }]" @click="sidebarView = 'notebooks'">草稿本</button>
          <button type="button" :class="['sidebar-switch-btn', { active: sidebarView === 'snapshots' }]" @click="sidebarView = 'snapshots'">历史记录 <span class="badge">{{ filteredSnapshots.length }}</span></button>
        </div>

        <section v-show="sidebarView === 'notebooks'" class="sidebar-panel">
          <div class="sidebar-search">
            <input class="input-base" v-model="newNotebookName" placeholder="新草稿本名称..." @keydown.enter.prevent="createNotebookAction" />
            <button class="btn btn-primary btn-sm" @click="createNotebookAction">新建</button>
          </div>
          <ul class="nav-list">
            <li v-for="item in notebooks" :key="item.id" :class="['nav-item', { active: item.id === activeNotebookId }]" @click="selectNotebook(item.id)">
              <div class="nav-content">
                <h4>{{ item.name }}</h4>
                <span class="meta">{{ item.snapshots.length }} 记录 · {{ item.pages?.length || 1 }} 分页</span>
              </div>
              <button class="icon-btn danger" title="删除草稿本" aria-label="删除草稿本" @click.stop="deleteNotebook(item.id)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M3 6h18" />
                  <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                  <path d="M10 11v6" />
                  <path d="M14 11v6" />
                </svg>
              </button>
            </li>
          </ul>
          <div class="sidebar-footer">
            <button class="btn btn-dashed" style="margin-bottom:8px;" @click="triggerImport">导入草稿本</button>
            <button class="btn btn-dashed" style="margin-bottom:8px;" @click="openRecycleBin">回收站（{{ recycleBinCount }}）</button>
            <button class="btn btn-dashed" @click="exportAllNotebooks">导出全部备份</button>
          </div>
        </section>

        <section v-show="sidebarView === 'snapshots'" class="sidebar-panel">
          <div class="sidebar-search">
            <input class="input-base" v-model="searchQuery" placeholder="搜索说明或公式内容..." />
          </div>
          <div class="sidebar-actions" v-if="activeNotebook">
            <button v-if="filteredSnapshots.length > 0" class="btn btn-sm" @click="toggleSelectAllSnapshots">{{ allSnapshotsSelected ? '取消全选' : '全选' }}</button>
            <button v-if="selectedSnapshotIds.length > 0" class="btn btn-sm" @click="clearSelectedSnapshots">取消选择</button>
            <button v-if="filteredSnapshots.length > 0" class="btn btn-sm danger" :disabled="selectedSnapshotIds.length === 0" @click="deleteSelectedSnapshots">批量删除</button>
          </div>
          <ul class="snapshot-list">
            <li class="snapshot-card" v-for="item in filteredSnapshots" :key="item.id">
              <div class="snapshot-header">
                <input type="checkbox" v-model="selectedSnapshotIds" :value="item.id" />
                <div class="snapshot-info">
                  <input v-if="renamingSnapshotId === item.id" class="input-base rename-input" :value="item.name" @blur="finishRenameSnapshot(item, $event)" @keydown.enter="$event.target.blur()" />
                  <h4 v-else @dblclick="startRenameSnapshot(item)">{{ item.name }}</h4>
                  <time>{{ formatTime(item.createdAt) }}</time>
                </div>
              </div>
              <div class="snapshot-preview">{{ makePreview(item.lines) }}</div>
              <div class="snapshot-actions">
                <button class="btn btn-sm" @click="restoreSnapshot(item)">恢复</button>
                <button class="btn btn-sm btn-primary" @click="copySnapshotData(item, 'aligned')">{{ copiedSnapshotId === item.id ? '已复制' : '复制' }}</button>
                <button class="btn btn-sm" @click="startRenameSnapshot(item)">重命名</button>
                <button class="icon-btn danger" style="margin-left:auto;" title="删除历史记录" aria-label="删除历史记录" @click.stop="deleteSnapshot(item.id)">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M3 6h18" />
                    <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    <path d="M10 11v6" />
                    <path d="M14 11v6" />
                  </svg>
                </button>
              </div>
            </li>
            <li v-if="snapshots.length > 0 && filteredSnapshots.length === 0" class="empty-state"><div class="empty-text">没有找到匹配的记录</div></li>
            <li v-if="snapshots.length === 0" class="empty-state"><div class="empty-text">暂无记录</div></li>
          </ul>
        </section>
      </template>
    </aside>

    <main class="main-editor">
      <header class="editor-header">
        <div class="title-area">
          <input class="title-input" v-model="notebookNameDraft" @blur="renameActiveNotebook" @keydown.enter="$event.target.blur()" placeholder="草稿本名称..." />
        </div>
        <div class="header-actions">
          <div class="combo-input">
            <input class="input-base unstyled-input" v-model="snapshotNameDraft" placeholder="推导流说明（可选）" @keydown.enter="saveSnapshot" />
            <button class="btn btn-primary" @click="saveSnapshot">保存</button>
          </div>
        </div>
      </header>

      <div class="tabs-container">
        <div v-for="page in activeNotebook?.pages" :key="page.id" :class="['tab-item', { active: page.id === activePageId }]" @click="selectPage(page.id)">
          <span class="tab-title">{{ page.name }}</span>
          <button class="tab-close-btn" :disabled="(activeNotebook?.pages?.length || 0) <= 1" @click.stop="removePage(page.id)">×</button>
        </div>
        <button class="tab-add-btn" @click="addPage">+</button>
      </div>

      <section class="top-tools-section">
        <div class="toolbar">
          <button v-for="item in quickTemplates" :key="item.label" class="tool-btn" @click="insertTemplate(item.latex)">{{ item.label }}</button>
          <div class="toolbar-meta"><span class="toolbar-hint">回车：补全优先，否则插入新行</span></div>
        </div>
      </section>

      <div class="editor-content">
        <transition name="fade">
          <div v-if="selectedLineIds.length > 0" class="selection-toolbar">
            <span class="selection-count">已选 {{ selectedLineIds.length }} 行</span>
            <div class="selection-actions">
              <button class="btn btn-sm" @click="copySelectedLinesAs('raw')">复制（纯多行）</button>
              <button class="btn btn-sm btn-primary" @click="copySelectedLinesAs('aligned')">复制为 Aligned</button>
              <button class="btn btn-sm" @click="copySelectedLinesAs('markdown')">复制为 MD 公式</button>
              <button class="btn btn-sm" @click="clearSelectedLines">取消选择</button>
              <div class="divider-vertical"></div>
              <button class="btn btn-sm danger" @click="deleteSelectedLines">删除</button>
            </div>
          </div>
        </transition>

        <transition-group name="row" tag="div" class="lines-container">
          <article v-for="(line, index) in draftLines" :key="line.id" :class="['math-line', { 'is-selected': isLineSelected(line.id) }]">
            <div class="line-num" @click="toggleLineSelection(line.id, index, $event)">{{ index + 1 }}</div>
            <div class="math-field-wrapper">
              <math-field
                class="custom-math-field"
                :ref="(element) => setMathFieldRef(line.id, element)"
                :value="line.latex"
                virtual-keyboard-mode="manual"
                @focusin="setActiveLine(line.id)"
                @input="onLineInput(line.id, $event)"
                @keydown.enter="handleLineEnter(line.id, $event)"
              />
            </div>
            <div class="line-actions">
              <button class="icon-btn" title="复制本行" aria-label="复制本行" @click="copyLineText(line.latex)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <rect x="9" y="9" width="11" height="11" rx="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              </button>
              <button class="icon-btn" @click="insertLineAfter(line.id, '')">+</button>
              <button class="icon-btn" @click="insertEquationLineAfter(line.id)">=</button>
              <button class="icon-btn danger" title="删除本行" aria-label="删除本行" @click="deleteLine(line.id)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M3 6h18" />
                  <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                  <path d="M10 11v6" />
                  <path d="M14 11v6" />
                </svg>
              </button>
            </div>
          </article>
        </transition-group>
        <div class="editor-bottom-actions"><button class="btn btn-dashed" @click="addLineToEnd('')">新增一行</button></div>
      </div>

      <section class="output-panel" :class="{ collapsed: isOutputCollapsed }">
        <header class="output-header">
          <div class="output-title"><strong>输出区</strong><span>渲染预览</span></div>
          <div class="output-actions">
            <button type="button" :class="['output-mode-btn', { active: outputMode === 'current' }]" @click="outputMode = 'current'">当前行</button>
            <button type="button" :class="['output-mode-btn', { active: outputMode === 'all' }]" @click="outputMode = 'all'">全部行</button>
            <button type="button" :class="['output-mode-btn', { active: outputMode === 'aligned' }]" @click="outputMode = 'aligned'">Aligned</button>
            <button class="btn btn-sm" @click="copyLineText(outputText)">复制输出</button>
            <button class="btn btn-sm" @click="isOutputCollapsed = !isOutputCollapsed">{{ isOutputCollapsed ? '展开输出区' : '收起输出区' }}</button>
          </div>
        </header>
        <div v-show="!isOutputCollapsed" class="output-body">
          <div class="output-render-wrap"><math-field class="output-render-field" :value="outputRenderLatex" read-only virtual-keyboard-mode="off" /></div>
          <p v-if="!outputRenderLatex" class="output-empty">暂无输出内容</p>
        </div>
      </section>
    </main>

    <AiAssistantSidebar
      v-model:aiPromptDraft="aiPromptDraft"
      v-model:enterCreatesEquationLine="enterCreatesEquationLine"
      :ai-sessions="aiSessions"
      :active-ai-session-id="activeAiSessionId"
      :ai-endpoints="aiEndpoints"
      :active-ai-endpoint-id="activeAiEndpointId"
      :ai-system-prompts="aiSystemPrompts"
      :active-ai-system-prompt-id="activeAiSystemPromptId"
      :ai-context-mode="aiContextMode"
      :ai-thinking-mode="aiThinkingMode"
      :ai-is-requesting="aiIsRequesting"
      :ai-last-error="aiLastError"
      :active-ai-session="activeAiSession"
      :active-ai-endpoint="activeAiEndpoint"
      :active-ai-system-prompt="activeAiSystemPrompt"
      :ai-context-summary="aiContextSummary"
      :format-time="formatTime"
      :create-ai-session-action="createAiSessionAction"
      :delete-ai-session="deleteAiSession"
      :select-ai-session="selectAiSession"
      :update-ai-message="updateAiMessage"
      :delete-ai-message="deleteAiMessage"
      :send-ai-prompt="sendAiPrompt"
      :retry-ai-message="retryAiMessage"
      :set-ai-context-mode="setAiContextMode"
      :set-ai-thinking-mode="setAiThinkingMode"
      :select-ai-endpoint="selectAiEndpoint"
      :add-ai-endpoint="addAiEndpoint"
      :remove-ai-endpoint="removeAiEndpoint"
      :update-ai-endpoint-field="updateAiEndpointField"
      :select-ai-system-prompt="selectAiSystemPrompt"
      :create-ai-system-prompt-action="createAiSystemPromptAction"
      :remove-ai-system-prompt="removeAiSystemPrompt"
      :update-ai-system-prompt-field="updateAiSystemPromptField"
      :export-current-notebook="exportCurrentNotebook"
      :export-notebook-bundle="exportNotebookBundle"
      :clear-draft="clearDraft"
    />
    <div v-if="showRecycleBin" class="recycle-overlay" @click.self="closeRecycleBin">
      <section class="recycle-panel">
        <header class="recycle-header">
          <h3>回收站</h3>
          <button class="icon-btn" @click="closeRecycleBin">×</button>
        </header>
        <div class="recycle-toolbar">
          <span class="recycle-count">共 {{ recycleBinItems.length }} 条</span>
          <button class="btn btn-sm" :disabled="recycleBinItems.length === 0" @click="restoreAllRecycleBinItems">全部恢复</button>
          <button class="btn btn-sm danger" :disabled="recycleBinItems.length === 0" @click="clearRecycleBin">清空回收站</button>
        </div>
        <ul v-if="recycleBinItems.length > 0" class="recycle-list">
          <li v-for="item in recycleBinItems" :key="item.recycleId" class="recycle-item">
            <div class="recycle-main">
              <span class="recycle-type">{{ item.type === 'notebook' ? '草稿本' : '推导流' }}</span>
              <strong>{{ item.type === 'notebook' ? item.notebookName : item.snapshotName }}</strong>
              <span class="recycle-meta">来源：{{ item.notebookName }} · 删除于 {{ formatTime(item.deletedAt) }}</span>
            </div>
            <div class="recycle-actions"><button class="btn btn-sm" @click="restoreRecycleBinItem(item.recycleId)">恢复</button></div>
          </li>
        </ul>
        <div v-else class="empty-state"><div class="empty-text">回收站为空</div></div>
      </section>
    </div>
  </div>
</template>
