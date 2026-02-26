<script setup>
import { computed, nextTick, ref, watch } from 'vue';
import MarkdownIt from 'markdown-it';
import markdownItTexmath from 'markdown-it-texmath';
import markdownItContainer from 'markdown-it-container';
import DOMPurify from 'dompurify';
import katex from 'katex';
import 'katex/dist/katex.min.css';

const props = defineProps({
  aiSessions: { type: Array, default: () => [] },
  activeAiSessionId: { type: String, default: '' },
  aiPromptDraft: { type: String, default: '' },
  aiEndpoints: { type: Array, default: () => [] },
  activeAiEndpointId: { type: String, default: '' },
  aiSystemPrompts: { type: Array, default: () => [] },
  activeAiSystemPromptId: { type: String, default: '' },
  aiContextMode: { type: String, default: 'current-flow' },
  aiThinkingMode: { type: String, default: 'off' },
  aiIsRequesting: { type: Boolean, default: false },
  aiLastError: { type: String, default: '' },
  includeAiOnExport: { type: Boolean, default: true },
  includeAiOnImport: { type: Boolean, default: true },
  nutstoreSyncSettings: { type: Object, default: () => ({}) },
  nutstoreBackupHistory: { type: Array, default: () => [] },
  nutstoreIsSyncing: { type: Boolean, default: false },
  nutstoreLastError: { type: String, default: '' },
  nutstoreConnectionReady: { type: Boolean, default: false },
  activeAiSession: { type: Object, default: null },
  activeAiEndpoint: { type: Object, default: null },
  activeAiSystemPrompt: { type: Object, default: null },
  aiContextSummary: { type: String, default: '' },
  enterCreatesEquationLine: { type: Boolean, default: true },
  formatTime: { type: Function, required: true },
  createAiSessionAction: { type: Function, required: true },
  deleteAiSession: { type: Function, required: true },
  selectAiSession: { type: Function, required: true },
  updateAiMessage: { type: Function, required: true },
  deleteAiMessage: { type: Function, required: true },
  sendAiPrompt: { type: Function, required: true },
  retryAiMessage: { type: Function, required: true },
  setAiContextMode: { type: Function, required: true },
  setAiThinkingMode: { type: Function, required: true },
  selectAiEndpoint: { type: Function, required: true },
  addAiEndpoint: { type: Function, required: true },
  removeAiEndpoint: { type: Function, required: true },
  updateAiEndpointField: { type: Function, required: true },
  selectAiSystemPrompt: { type: Function, required: true },
  createAiSystemPromptAction: { type: Function, required: true },
  removeAiSystemPrompt: { type: Function, required: true },
  updateAiSystemPromptField: { type: Function, required: true },
  setIncludeAiOnExport: { type: Function, required: true },
  setIncludeAiOnImport: { type: Function, required: true },
  updateNutstoreSyncField: { type: Function, required: true },
  syncToNutstore: { type: Function, required: true },
  refreshNutstoreBackups: { type: Function, required: true },
  restoreNutstoreBackup: { type: Function, required: true },
  exportCurrentNotebook: { type: Function, required: true },
  exportNotebookBundle: { type: Function, required: true },
  exportAiStore: { type: Function, required: true },
  triggerAiImport: { type: Function, required: true },
  clearDraft: { type: Function, required: true },
});

const emit = defineEmits(['update:aiPromptDraft', 'update:enterCreatesEquationLine']);

const aiSessions = computed(() => props.aiSessions);
const activeAiSessionId = computed(() => props.activeAiSessionId);
const aiPromptDraft = computed(() => props.aiPromptDraft);
const aiEndpoints = computed(() => props.aiEndpoints);
const activeAiEndpointId = computed(() => props.activeAiEndpointId);
const aiSystemPrompts = computed(() => props.aiSystemPrompts);
const activeAiSystemPromptId = computed(() => props.activeAiSystemPromptId);
const aiContextMode = computed(() => props.aiContextMode);
const aiThinkingMode = computed(() => props.aiThinkingMode);
const aiIsRequesting = computed(() => props.aiIsRequesting);
const aiLastError = computed(() => props.aiLastError);
const includeAiOnExport = computed(() => props.includeAiOnExport);
const includeAiOnImport = computed(() => props.includeAiOnImport);
const nutstoreSyncSettings = computed(() => props.nutstoreSyncSettings || {});
const nutstoreBackupHistory = computed(() => props.nutstoreBackupHistory || []);
const nutstoreIsSyncing = computed(() => props.nutstoreIsSyncing);
const nutstoreLastError = computed(() => props.nutstoreLastError);
const nutstoreConnectionReady = computed(() => props.nutstoreConnectionReady);
const activeAiSession = computed(() => props.activeAiSession);
const activeAiEndpoint = computed(() => props.activeAiEndpoint);
const activeAiSystemPrompt = computed(() => props.activeAiSystemPrompt);
const aiContextSummary = computed(() => props.aiContextSummary);
const enterCreatesEquationLine = computed(() => props.enterCreatesEquationLine);

const formatTime = (...args) => props.formatTime(...args);
const createAiSessionAction = (...args) => props.createAiSessionAction(...args);
const deleteAiSession = (...args) => props.deleteAiSession(...args);
const selectAiSession = (...args) => props.selectAiSession(...args);
const updateAiMessage = (...args) => props.updateAiMessage(...args);
const deleteAiMessage = (...args) => props.deleteAiMessage(...args);
const sendAiPrompt = (...args) => props.sendAiPrompt(...args);
const retryAiMessage = (...args) => props.retryAiMessage(...args);
const setAiContextMode = (...args) => props.setAiContextMode(...args);
const setAiThinkingMode = (...args) => props.setAiThinkingMode(...args);
const selectAiEndpoint = (...args) => props.selectAiEndpoint(...args);
const addAiEndpoint = (...args) => props.addAiEndpoint(...args);
const removeAiEndpoint = (...args) => props.removeAiEndpoint(...args);
const updateAiEndpointField = (...args) => props.updateAiEndpointField(...args);
const selectAiSystemPrompt = (...args) => props.selectAiSystemPrompt(...args);
const createAiSystemPromptAction = (...args) => props.createAiSystemPromptAction(...args);
const removeAiSystemPrompt = (...args) => props.removeAiSystemPrompt(...args);
const updateAiSystemPromptField = (...args) => props.updateAiSystemPromptField(...args);
const setIncludeAiOnExport = (...args) => props.setIncludeAiOnExport(...args);
const setIncludeAiOnImport = (...args) => props.setIncludeAiOnImport(...args);
const updateNutstoreSyncField = (...args) => props.updateNutstoreSyncField(...args);
const syncToNutstore = (...args) => props.syncToNutstore(...args);
const refreshNutstoreBackups = (...args) => props.refreshNutstoreBackups(...args);
const restoreNutstoreBackup = (...args) => props.restoreNutstoreBackup(...args);
const exportCurrentNotebook = (...args) => props.exportCurrentNotebook(...args);
const exportNotebookBundle = (...args) => props.exportNotebookBundle(...args);
const exportAiStore = (...args) => props.exportAiStore(...args);
const triggerAiImport = (...args) => props.triggerAiImport(...args);
const clearDraft = (...args) => props.clearDraft(...args);

const rootRef = ref(null);
const aiSidebarTab = ref('chat');
const isAiSidebarCollapsed = ref(false);
const editingAiMessageId = ref('');
const editingAiMessageDraft = ref('');

const aiContextOptions = [
  { value: 'current-flow', label: '当前推导流（默认，Aligned）' },
  { value: 'none', label: '不读取上下文' },
  { value: 'selected-lines', label: '读取多行选择（Aligned）' },
  { value: 'whole-notebook', label: '读取整个草稿本（分页 Aligned）' },
];

const aiThinkingOptions = [
  { value: 'off', label: '关闭（不注入 enable_thinking）' },
  { value: 'on', label: '标准（enable_thinking=true）' },
  { value: 'deep', label: '深度（enable_thinking=true）' },
];

const markdownRenderer = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
  typographer: true,
});

markdownRenderer.use(markdownItTexmath, {
  engine: katex,
  delimiters: 'dollars',
  katexOptions: {
    throwOnError: false,
    strict: 'ignore',
  },
});

function registerCallout(type, defaultTitle) {
  markdownRenderer.use(markdownItContainer, type, {
    validate: (params) => params.trim().toLowerCase().startsWith(type),
    render: (tokens, idx) => {
      const token = tokens[idx];
      if (token.nesting === 1) {
        const info = token.info.trim();
        const customTitle = info.length > type.length ? info.slice(type.length).trim() : '';
        const title = customTitle || defaultTitle;
        return `<div class="md-callout md-callout-${type}"><div class="md-callout-title">${markdownRenderer.utils.escapeHtml(title)}</div>\n`;
      }
      return '</div>\n';
    },
  });
}

registerCallout('note', 'Note');
registerCallout('info', 'Info');
registerCallout('tip', 'Tip');
registerCallout('warning', 'Warning');
registerCallout('danger', 'Danger');

function normalizeGithubCallouts(markdownText) {
  const text = typeof markdownText === 'string' ? markdownText : '';
  if (!text.includes('[!')) return text;

  const lines = text.split('\n');
  const output = [];
  const alertTypeMap = {
    NOTE: 'note',
    TIP: 'tip',
    IMPORTANT: 'info',
    WARNING: 'warning',
    CAUTION: 'danger',
  };

  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    const match = line.match(/^\s*>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*(.*)$/i);
    if (!match) {
      output.push(line);
      index += 1;
      continue;
    }

    const rawType = (match[1] || '').toUpperCase();
    const mappedType = alertTypeMap[rawType] || 'note';
    const title = (match[2] || '').trim();
    const contentLines = [];
    index += 1;

    while (index < lines.length) {
      const blockLine = lines[index];
      if (!/^\s*>/.test(blockLine)) break;
      const cleaned = blockLine.replace(/^\s*>\s?/, '');
      contentLines.push(cleaned);
      index += 1;
    }

    output.push(`::: ${mappedType}${title ? ` ${title}` : ''}`);
    output.push(...contentLines);
    output.push(':::');
  }

  return output.join('\n');
}

function wrapBareEquationLine(line) {
  const rawLine = typeof line === 'string' ? line : '';
  const trimmed = rawLine.trim();
  if (!trimmed) return rawLine;
  if (trimmed.includes('$')) return rawLine;
  if (trimmed.startsWith('```') || trimmed.startsWith(':::') || trimmed.startsWith('>')) return rawLine;
  if (/^[-*+]\s/.test(trimmed) || /^\d+\.\s/.test(trimmed)) return rawLine;
  if (/^[\u2022\u25CB\u25E6\u2219\u00B7]\s?/.test(trimmed)) return rawLine;
  if (/[\u3400-\u9fff\u3040-\u30ff]/.test(trimmed)) return rawLine;
  if (/[。！？；]/.test(trimmed)) return rawLine;

  const hasLatexCommand = /\\[a-zA-Z]+/.test(trimmed);
  const hasSubscriptOrSuperscript = /(?:^|[^\\])[_^]/.test(trimmed);
  const hasEquationHint = /[=∑Σ+\-]/.test(trimmed);
  const hasEquationHintEnhanced =
    hasEquationHint ||
    /[<>]/.test(trimmed) ||
    /\\(?:approx|sim|ne|leq?|geq?|to|rightarrow|Rightarrow|Leftarrow|implies)\b/.test(trimmed);
  const shouldWrap = (hasLatexCommand || hasSubscriptOrSuperscript) && hasEquationHintEnhanced;

  if (!shouldWrap) return rawLine;
  return `$$\n${trimmed}\n$$`;
}

function looksLikeInlineLatex(expr) {
  const text = typeof expr === 'string' ? expr : '';
  if (!text) return false;
  if (/\\[a-zA-Z]+/.test(text)) return true;
  if (/(?:^|[^\\])\^/.test(text)) return true;

  if (!/(?:^|[^\\])_/.test(text)) return false;
  if (/[{}]/.test(text)) return true;
  if (/_\d{1,3}\b/.test(text)) return true;
  if (/_[a-zA-Z]{1,3}\b/.test(text)) return true;
  return false;
}

function autoWrapInlineLatex(markdownText) {
  const raw = typeof markdownText === 'string' ? markdownText : '';
  if (!raw) return raw;

  const protectedBlocks = [];
  const placeholderPrefix = '@@MSPROTECT';
  const placeholderSuffix = '@@';
  const placeholderPattern = new RegExp(`${placeholderPrefix}(\\d+)${placeholderSuffix}`, 'g');

  const protect = (pattern) => {
    return (input) =>
      input.replace(pattern, (match) => {
        const token = `${placeholderPrefix}${protectedBlocks.length}${placeholderSuffix}`;
        protectedBlocks.push(match);
        return token;
      });
  };

  let text = raw;
  text = protect(/```[\s\S]*?```/g)(text);
  text = protect(/`[^`\n]+`/g)(text);
  text = protect(/\$\$[\s\S]*?\$\$/g)(text);
  text = protect(/\$(?:\\.|[^$\n])+\$/g)(text);

  const isMathishChar = (ch) => {
    if (!ch) return false;
    const code = ch.charCodeAt(0);
    if (code >= 48 && code <= 57) return true;
    if (code >= 65 && code <= 90) return true;
    if (code >= 97 && code <= 122) return true;
    if (code > 127) {
      if (/[\u3400-\u9fff\u3040-\u30ff]/.test(ch)) return false;
      if ((code >= 0x0370 && code <= 0x03ff) || (code >= 0x1f00 && code <= 0x1fff)) return true;
      if ((code >= 0x2190 && code <= 0x21ff) || (code >= 0x2200 && code <= 0x22ff)) return true;
      return false;
    }
    return (
      ch === ' ' ||
      ch === '\t' ||
      ch === '\\' ||
      ch === '_' ||
      ch === '^' ||
      ch === '{' ||
      ch === '}' ||
      ch === '(' ||
      ch === ')' ||
      ch === '[' ||
      ch === ']' ||
      ch === '|' ||
      ch === '+' ||
      ch === '-' ||
      ch === '*' ||
      ch === '/' ||
      ch === '=' ||
      ch === '<' ||
      ch === '>' ||
      ch === ',' ||
      ch === '.' ||
      ch === ':' ||
      ch === ';'
    );
  };

  let output = '';
  let cursor = 0;
  let index = 0;

  while (index < text.length) {
    const ch = text[index];
    const next = index + 1 < text.length ? text[index + 1] : '';
    const isTrigger =
      ch === '^' ||
      ch === '_' ||
      (ch === '\\' && next && next.toLowerCase() !== next.toUpperCase());

    if (!isTrigger) {
      index += 1;
      continue;
    }

    let start = index;
    while (start > 0 && isMathishChar(text[start - 1])) start -= 1;
    let end = index + 1;
    while (end < text.length && isMathishChar(text[end])) end += 1;

    const slice = text.slice(start, end);
    const leadingWhitespace = slice.match(/^[ \t]*/)?.[0] ?? '';
    const trailingWhitespace = slice.match(/[ \t]*$/)?.[0] ?? '';
    const expr = slice.trim();

    if (!looksLikeInlineLatex(expr)) {
      index += 1;
      continue;
    }

    output += text.slice(cursor, start);
    output += `${leadingWhitespace}$${expr}$${trailingWhitespace}`;
    cursor = end;
    index = end;
  }

  output += text.slice(cursor);

  return output.replace(placeholderPattern, (_, rawIndex) => {
    const restored = protectedBlocks[Number(rawIndex)];
    return typeof restored === 'string' ? restored : '';
  });
}

function normalizeMathDelimiters(markdownText) {
  const raw = typeof markdownText === 'string' ? markdownText : '';
  let text = raw
    .replace(/\\\[((?:.|\n)*?)\\\]/g, (_, expr) => `\n$$\n${String(expr || '').trim()}\n$$\n`)
    .replace(/\\\((.+?)\\\)/g, (_, expr) => `$${String(expr || '').trim()}$`);

  let inDisplayMathBlock = false;
  const lines = text.split('\n').map((line) => {
    const normalizedLine = typeof line === 'string' ? line : '';
    const isDisplayFenceLine = /^\s*\$\$\s*$/.test(normalizedLine);

    if (isDisplayFenceLine) {
      inDisplayMathBlock = !inDisplayMathBlock;
      return normalizedLine;
    }

    if (inDisplayMathBlock) return normalizedLine;
    return wrapBareEquationLine(normalizedLine);
  });

  return autoWrapInlineLatex(lines.join('\n'));
}

function renderMarkdown(content) {
  const raw = typeof content === 'string' ? content : '';
  const withCallouts = normalizeGithubCallouts(raw);
  const normalized = normalizeMathDelimiters(withCallouts);
  const html = markdownRenderer.render(normalized);
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true, svg: true, mathMl: true },
    ADD_ATTR: ['style', 'xmlns'],
    ADD_TAGS: ['eq', 'eqn'],
  });
}

const thinkParseCache = new Map();

function parseMessageThinkContent(content) {
  const raw = typeof content === 'string' ? content : '';
  const cached = thinkParseCache.get(raw);
  if (cached) return cached;

  const thoughts = [];
  let visible = raw.replace(/<think(?:\s+[^>]*)?>([\s\S]*?)<\/think>/gi, (_, thinkChunk) => {
    const chunk = String(thinkChunk || '').trim();
    if (chunk) thoughts.push(chunk);
    return '';
  });

  const dangling = visible.match(/<think(?:\s+[^>]*)?>([\s\S]*)$/i);
  if (dangling) {
    const danglingChunk = String(dangling[1] || '').trim();
    if (danglingChunk) thoughts.push(danglingChunk);
    visible = visible.replace(/<think(?:\s+[^>]*)?>[\s\S]*$/i, '');
  }

  const parsed = {
    visible: visible.trim(),
    thoughts,
  };

  if (thinkParseCache.size > 400) thinkParseCache.clear();
  thinkParseCache.set(raw, parsed);
  return parsed;
}

function getMessageVisibleContent(content) {
  return parseMessageThinkContent(content).visible;
}

function getMessageThoughts(content) {
  return parseMessageThinkContent(content).thoughts;
}

function startEditAiMessage(message) {
  editingAiMessageId.value = message.id;
  editingAiMessageDraft.value = message.content || '';
}

function cancelEditAiMessage() {
  editingAiMessageId.value = '';
  editingAiMessageDraft.value = '';
}

function saveEditAiMessage() {
  if (!activeAiSessionId.value || !editingAiMessageId.value) return;
  const ok = updateAiMessage(activeAiSessionId.value, editingAiMessageId.value, editingAiMessageDraft.value);
  if (ok) cancelEditAiMessage();
}

function handleDeleteAiMessage(messageId) {
  if (!activeAiSessionId.value) return;
  deleteAiMessage(activeAiSessionId.value, messageId);
  if (editingAiMessageId.value === messageId) cancelEditAiMessage();
}

async function handleRetryAiMessage(messageId) {
  if (!activeAiSessionId.value) return;
  await retryAiMessage(activeAiSessionId.value, messageId);
}

async function submitAiPrompt() {
  await sendAiPrompt();
}

function handleAiPromptKeydown(event) {
  if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
  event.preventDefault();
  submitAiPrompt();
}

function updatePromptDraft(value) {
  emit('update:aiPromptDraft', String(value ?? ''));
}

function handleToggleEnterCreatesEquationLine(event) {
  emit('update:enterCreatesEquationLine', Boolean(event?.target?.checked));
}

function formatBackupSize(size) {
  const bytes = Number(size);
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function handleNutstoreTextField(field, event) {
  updateNutstoreSyncField(field, event?.target?.value ?? '');
}

function handleNutstoreToggle(field, event) {
  updateNutstoreSyncField(field, Boolean(event?.target?.checked));
}

function handleNutstoreNumberField(field, event) {
  updateNutstoreSyncField(field, event?.target?.value ?? '');
}

function handleToggleIncludeAiOnExport(event) {
  setIncludeAiOnExport(Boolean(event?.target?.checked));
}

function handleToggleIncludeAiOnImport(event) {
  setIncludeAiOnImport(Boolean(event?.target?.checked));
}

async function handleNutstoreManualSync() {
  await syncToNutstore();
}

async function handleNutstoreRefresh() {
  await refreshNutstoreBackups();
}

async function handleNutstoreRestore(item) {
  await restoreNutstoreBackup(item);
}

function collapseAllThinkingBlocks() {
  const root = rootRef.value;
  if (!root) return;
  const blocks = root.querySelectorAll('.ai-think-block[open]');
  blocks.forEach((block) => block.removeAttribute('open'));
}

watch(() => props.aiIsRequesting, async (isRequesting, previous) => {
  if (!previous || isRequesting) return;
  await nextTick();
  collapseAllThinkingBlocks();
});
</script>

<template>
  <aside ref="rootRef" :class="['sidebar assistant-sidebar', { collapsed: isAiSidebarCollapsed }]">
    <div class="sidebar-header">
      <h2><span v-if="!isAiSidebarCollapsed">AI 助手</span></h2>
      <button class="icon-btn" @click="isAiSidebarCollapsed = !isAiSidebarCollapsed">{{ isAiSidebarCollapsed ? '‹' : '›' }}</button>
    </div>
    <template v-if="!isAiSidebarCollapsed">
      <div class="sidebar-switch assistant-switch">
        <button type="button" :class="['sidebar-switch-btn', { active: aiSidebarTab === 'chat' }]" @click="aiSidebarTab = 'chat'">AI 助手</button>
        <button type="button" :class="['sidebar-switch-btn', { active: aiSidebarTab === 'settings' }]" @click="aiSidebarTab = 'settings'">系统和AI设置</button>
      </div>

      <section v-show="aiSidebarTab === 'chat'" class="assistant-panel assistant-chat-panel">
        <div class="ai-sessions-wrap">
          <div class="ai-section-title"><strong>会话历史</strong><button class="btn btn-sm" @click="createAiSessionAction">新建会话</button></div>
          <ul class="ai-session-list">
            <li v-for="item in aiSessions" :key="item.id" :class="['ai-session-item', { active: item.id === activeAiSessionId }]" @click="selectAiSession(item.id)">
              <div class="ai-session-main"><h4>{{ item.name }}</h4><span>{{ item.messages.length }} 条 · {{ formatTime(item.updatedAt) }}</span></div>
              <button class="icon-btn danger" title="删除会话" aria-label="删除会话" @click.stop="deleteAiSession(item.id)">
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
        </div>
        <div class="ai-chat-wrap">
          <div class="ai-section-title"><strong>当前会话</strong><span class="ai-status" v-if="aiIsRequesting">请求中...</span></div>
          <ul class="ai-message-list" v-if="activeAiSession">
            <li v-for="message in activeAiSession.messages" :key="message.id" :class="['ai-message-item', message.role]">
              <div class="ai-message-head"><span>{{ message.role === 'user' ? '提问' : '回复' }}</span><time>{{ formatTime(message.createdAt) }}</time></div>
              <textarea v-if="editingAiMessageId === message.id" class="input-base ai-message-editor" v-model="editingAiMessageDraft" rows="4" />
              <template v-else>
                <div
                  v-if="message.role !== 'assistant'"
                  class="ai-message-content ai-message-markdown"
                  v-html="renderMarkdown(message.content)"
                />
                <template v-else>
                  <div
                    v-if="getMessageVisibleContent(message.content)"
                    class="ai-message-content ai-message-markdown"
                    v-html="renderMarkdown(getMessageVisibleContent(message.content))"
                  />
                  <details
                    v-for="(thinkChunk, thinkIndex) in getMessageThoughts(message.content)"
                    :key="`${message.id}-think-${thinkIndex}`"
                    class="ai-think-block"
                  >
                    <summary>思考过程 {{ thinkIndex + 1 }}</summary>
                    <div class="ai-message-content ai-message-markdown ai-think-content" v-html="renderMarkdown(thinkChunk)" />
                  </details>
                </template>
              </template>
              <div class="ai-message-actions">
                <button class="btn btn-sm" @click="startEditAiMessage(message)">编辑</button>
                <button v-if="editingAiMessageId === message.id" class="btn btn-sm btn-primary" @click="saveEditAiMessage">保存</button>
                <button v-if="editingAiMessageId === message.id" class="btn btn-sm" @click="cancelEditAiMessage">取消</button>
                <button class="btn btn-sm danger" @click="handleDeleteAiMessage(message.id)">删除</button>
                <button v-if="message.role === 'user'" class="btn btn-sm" :disabled="aiIsRequesting" @click="handleRetryAiMessage(message.id)">重试</button>
              </div>
            </li>
            <li v-if="activeAiSession.messages.length === 0" class="empty-state"><div class="empty-text">会话为空，输入问题开始对话</div></li>
          </ul>
          <p v-if="aiLastError" class="ai-error">{{ aiLastError }}</p>
          <div class="ai-composer">
            <textarea
              class="input-base ai-prompt-input"
              :value="aiPromptDraft"
              rows="3"
              placeholder="输入问题，Enter 发送，Shift+Enter 换行"
              @input="updatePromptDraft($event.target.value)"
              @keydown="handleAiPromptKeydown"
            />
            <button class="btn btn-primary" :disabled="aiIsRequesting" @click="submitAiPrompt">{{ aiIsRequesting ? '发送中...' : '发送' }}</button>
          </div>
        </div>
      </section>

      <section v-show="aiSidebarTab === 'settings'" class="assistant-panel assistant-settings-panel">
        <div class="ai-settings-card">
          <div class="ai-section-title">
            <strong>API 节点</strong>
            <div class="ai-inline-actions"><button class="btn btn-sm" @click="addAiEndpoint">新增</button><button class="btn btn-sm danger" :disabled="!activeAiEndpoint" @click="activeAiEndpoint && removeAiEndpoint(activeAiEndpoint.id)">删除</button></div>
          </div>
          <label class="ai-field-label">当前节点</label>
          <select class="input-base ai-select" :value="activeAiEndpointId" @change="selectAiEndpoint($event.target.value)">
            <option v-for="item in aiEndpoints" :key="item.id" :value="item.id">{{ item.name || item.baseUrl || '未命名节点' }}</option>
          </select>
          <template v-if="activeAiEndpoint">
            <input class="input-base" :value="activeAiEndpoint.name" placeholder="节点名称" @input="updateAiEndpointField(activeAiEndpoint.id, 'name', $event.target.value)" />
            <input class="input-base" :value="activeAiEndpoint.baseUrl" placeholder="API URL（OpenAI 兼容）" @input="updateAiEndpointField(activeAiEndpoint.id, 'baseUrl', $event.target.value)" />
            <input class="input-base" :value="activeAiEndpoint.model" placeholder="模型名" @input="updateAiEndpointField(activeAiEndpoint.id, 'model', $event.target.value)" />
            <input class="input-base" :value="activeAiEndpoint.apiKey" type="password" autocomplete="off" placeholder="API Key（可选）" @input="updateAiEndpointField(activeAiEndpoint.id, 'apiKey', $event.target.value)" />
            <textarea class="input-base ai-params-input" :value="activeAiEndpoint.customParams" rows="4" placeholder='OpenAI 自定义参数（JSON），例如 {"temperature":0.2}' @input="updateAiEndpointField(activeAiEndpoint.id, 'customParams', $event.target.value)" />
          </template>
        </div>

        <div class="ai-settings-card">
          <div class="ai-section-title">
            <strong>系统提示词</strong>
            <div class="ai-inline-actions"><button class="btn btn-sm" @click="createAiSystemPromptAction">新增</button><button class="btn btn-sm danger" :disabled="!activeAiSystemPrompt" @click="activeAiSystemPrompt && removeAiSystemPrompt(activeAiSystemPrompt.id)">删除</button></div>
          </div>
          <label class="ai-field-label">当前提示词</label>
          <select class="input-base ai-select" :value="activeAiSystemPromptId" @change="selectAiSystemPrompt($event.target.value)">
            <option v-for="item in aiSystemPrompts" :key="item.id" :value="item.id">{{ item.name || '未命名提示词' }}</option>
          </select>
          <template v-if="activeAiSystemPrompt">
            <input class="input-base" :value="activeAiSystemPrompt.name" placeholder="提示词名称" @input="updateAiSystemPromptField(activeAiSystemPrompt.id, 'name', $event.target.value)" />
            <textarea class="input-base ai-prompt-template-input" :value="activeAiSystemPrompt.content" rows="6" placeholder="系统提示词内容" @input="updateAiSystemPromptField(activeAiSystemPrompt.id, 'content', $event.target.value)" />
          </template>
        </div>

        <div class="ai-settings-card">
          <div class="ai-section-title"><strong>思考与上下文</strong></div>
          <label class="ai-field-label">思考模式</label>
          <select class="input-base ai-select" :value="aiThinkingMode" @change="setAiThinkingMode($event.target.value)">
            <option v-for="item in aiThinkingOptions" :key="item.value" :value="item.value">{{ item.label }}</option>
          </select>
          <label class="ai-field-label">上下文来源</label>
          <select class="input-base ai-select" :value="aiContextMode" @change="setAiContextMode($event.target.value)">
            <option v-for="item in aiContextOptions" :key="item.value" :value="item.value">{{ item.label }}</option>
          </select>
          <p class="ai-context-summary">{{ aiContextSummary }}</p>
        </div>

        <div class="ai-settings-card">
          <div class="ai-section-title">
            <strong>坚果云同步</strong>
            <div class="ai-inline-actions">
              <button class="btn btn-sm" :disabled="nutstoreIsSyncing" @click="handleNutstoreManualSync">{{ nutstoreIsSyncing ? '同步中...' : '手动同步' }}</button>
              <button class="btn btn-sm" :disabled="nutstoreIsSyncing" @click="handleNutstoreRefresh">刷新历史</button>
            </div>
          </div>

          <label class="ai-field-label">WebDAV 地址</label>
          <input class="input-base" :value="nutstoreSyncSettings.baseUrl" placeholder="https://dav.jianguoyun.com/dav/" @input="handleNutstoreTextField('baseUrl', $event)" />
          <label class="ai-field-label">用户名</label>
          <input class="input-base" :value="nutstoreSyncSettings.username" placeholder="坚果云账号" @input="handleNutstoreTextField('username', $event)" />
          <label class="ai-field-label">应用密码</label>
          <input class="input-base" :value="nutstoreSyncSettings.password" type="password" autocomplete="off" placeholder="建议使用坚果云应用密码" @input="handleNutstoreTextField('password', $event)" />
          <label class="ai-field-label">远程目录</label>
          <input class="input-base" :value="nutstoreSyncSettings.backupDir" placeholder="MathScratchBackups" @input="handleNutstoreTextField('backupDir', $event)" />

          <div class="nutstore-switches">
            <label class="toolbar-toggle">
              <input :checked="nutstoreSyncSettings.autoSyncEnabled" type="checkbox" @change="handleNutstoreToggle('autoSyncEnabled', $event)" />
              <span>启用自动同步</span>
            </label>
            <label class="toolbar-toggle">
              <input :checked="nutstoreSyncSettings.unlimitedBackups" type="checkbox" @change="handleNutstoreToggle('unlimitedBackups', $event)" />
              <span>备份数不设上限</span>
            </label>
            <label class="toolbar-toggle">
              <input :checked="includeAiOnExport" type="checkbox" @change="handleToggleIncludeAiOnExport" />
              <span>导出/同步时包含 AI 会话记录</span>
            </label>
            <label class="toolbar-toggle">
              <input :checked="includeAiOnImport" type="checkbox" @change="handleToggleIncludeAiOnImport" />
              <span>导入/恢复时应用 AI 会话记录</span>
            </label>
          </div>

          <div class="nutstore-number-fields">
            <label class="ai-field-label">自动同步频率（分钟）</label>
            <input class="input-base" type="number" min="1" max="1440" :value="nutstoreSyncSettings.autoSyncMinutes" @input="handleNutstoreNumberField('autoSyncMinutes', $event)" />
            <label class="ai-field-label">最大备份数</label>
            <input
              class="input-base"
              type="number"
              min="1"
              :disabled="nutstoreSyncSettings.unlimitedBackups"
              :value="nutstoreSyncSettings.maxBackups"
              @input="handleNutstoreNumberField('maxBackups', $event)"
            />
          </div>

          <p class="ai-context-summary">
            状态：{{ nutstoreConnectionReady ? '配置已就绪' : '请补全地址/用户名/密码' }}
            <template v-if="nutstoreSyncSettings.lastSyncAt">；上次成功同步：{{ formatTime(nutstoreSyncSettings.lastSyncAt) }}</template>
          </p>
          <p v-if="nutstoreLastError" class="ai-error" style="margin:0;">{{ nutstoreLastError }}</p>

          <div class="nutstore-history">
            <label class="ai-field-label">历史版本（{{ nutstoreBackupHistory.length }}）</label>
            <ul class="nutstore-history-list">
              <li v-for="item in nutstoreBackupHistory" :key="item.id" class="nutstore-history-item">
                <div class="nutstore-history-main">
                  <strong>{{ item.name }}</strong>
                  <span>{{ item.modifiedAt ? formatTime(item.modifiedAt) : '时间未知' }} · {{ formatBackupSize(item.size) }}</span>
                </div>
                <button class="btn btn-sm" :disabled="nutstoreIsSyncing" @click="handleNutstoreRestore(item)">恢复</button>
              </li>
              <li v-if="nutstoreBackupHistory.length === 0" class="empty-state">
                <div class="empty-text">暂无远程备份，请先手动同步或刷新历史</div>
              </li>
            </ul>
          </div>
        </div>

        <div class="ai-settings-card">
          <div class="ai-section-title"><strong>编辑器设置</strong></div>
          <div class="ai-settings-actions">
            <button class="btn" @click="exportCurrentNotebook">导出本册</button>
            <button class="btn" @click="exportNotebookBundle">组合导出</button>
            <button class="btn" @click="exportAiStore">导出 AI 会话</button>
            <button class="btn" @click="triggerAiImport">导入 AI 会话</button>
            <button class="btn danger-outline" @click="clearDraft">清空当前页</button>
          </div>
          <label class="toolbar-toggle" title="开启后按 Enter 时，新行将以 '=' 开始">
            <input :checked="enterCreatesEquationLine" type="checkbox" @change="handleToggleEnterCreatesEquationLine" />
            <span>新行首字符为等号（默认开）</span>
          </label>
        </div>
      </section>
    </template>
  </aside>
</template>
