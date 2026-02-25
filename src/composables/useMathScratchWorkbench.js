import { computed, ref } from 'vue';
import {
  ACTIVE_NOTEBOOK_KEY,
  AI_ASSISTANT_KEY,
  ENTER_EQUATION_LINE_ON_ENTER_KEY,
  LEGACY_V2_KEY,
  NOTEBOOKS_KEY,
  RECYCLE_BIN_KEY,
  RECYCLE_BIN_LIMIT,
  SNAPSHOT_LIMIT,
  quickTemplates,
} from './workbench/constants';
import {
  createLine,
  createNotebook,
  createPage,
  deepClone,
  downloadFile,
  formatTime,
  makePreview,
  makeUniqueNotebookName,
  makeUniqueSnapshotName,
  migrateNotebooksToV3,
  normalizeImportData,
  nowIso,
  parseBooleanSetting,
  rehydrateNotebook,
  safeParse,
  sanitizeFileName,
  sanitizeLineArray,
  sanitizeRecycleBinArray,
  sanitizeSnapshotArray,
  uid,
  writeTextToClipboard,
} from './workbench/shared';
import { createLineNotebookActions } from './workbench/lineNotebookActions';
import { createRecycleBinActions } from './workbench/recycleBinActions';
import { createHistoryActions } from './workbench/historyActions';
import { createExportImportActions } from './workbench/exportImportActions';
import { createAiAssistantActions } from './workbench/aiAssistantActions';
import { createAiStoreNormalizer } from './workbench/aiStore';
import { resolveAiContextPayloadForState, summarizeAiContextPayload } from './workbench/aiContext';
import { setupWorkbenchLifecycle } from './workbench/workbenchLifecycle';

export function useMathScratchWorkbench() {
  const notebooks = ref([]);
  const activeNotebookId = ref('');
  const activePageId = ref('');
  const draftLines = ref([]);
  const selectedLineIds = ref([]);
  const selectedSnapshotIds = ref([]);
  const activeLineId = ref('');
  const lastSelectedLineId = ref('');

  const newNotebookName = ref('');
  const notebookNameDraft = ref('');
  const snapshotNameDraft = ref('');
  const searchQuery = ref('');
  const renamingSnapshotId = ref(null);
  const fileInputRef = ref(null);
  const copiedSnapshotId = ref(null);
  const recycleBinItems = ref([]);
  const showRecycleBin = ref(false);
  const enterCreatesEquationLine = ref(true);

  const aiSessions = ref([]);
  const activeAiSessionId = ref('');
  const aiPromptDraft = ref('');
  const aiEndpoints = ref([]);
  const activeAiEndpointId = ref('');
  const aiSystemPrompts = ref([]);
  const activeAiSystemPromptId = ref('');
  const aiContextMode = ref('current-flow');
  const aiThinkingMode = ref('off');
  const aiIsRequesting = ref(false);
  const aiLastError = ref('');

  const mathFieldRefs = new Map();

  const activeNotebook = computed(() => notebooks.value.find((item) => item.id === activeNotebookId.value) || null);
  const activePage = computed(() => activeNotebook.value?.pages?.find((p) => p.id === activePageId.value) || null);
  const snapshots = computed(() => activeNotebook.value?.snapshots || []);
  const filteredSnapshots = computed(() => {
    let list = snapshots.value;
    const q = searchQuery.value.trim().toLowerCase();
    if (q) {
      list = list.filter((s) => s.name.toLowerCase().includes(q) || s.lines.some((l) => l.toLowerCase().includes(q)));
    }
    return list;
  });
  const allSnapshotsSelected = computed(() => {
    return filteredSnapshots.value.length > 0 && selectedSnapshotIds.value.length === filteredSnapshots.value.length;
  });
  const recycleBinCount = computed(() => recycleBinItems.value.length);
  const activeAiSession = computed(() => aiSessions.value.find((item) => item.id === activeAiSessionId.value) || null);
  const activeAiEndpoint = computed(() => aiEndpoints.value.find((item) => item.id === activeAiEndpointId.value) || null);
  const activeAiSystemPrompt = computed(() => aiSystemPrompts.value.find((item) => item.id === activeAiSystemPromptId.value) || null);

  const { normalizeAiStore } = createAiStoreNormalizer({ uid, nowIso });

  function resolveAiContextPayload(mode = aiContextMode.value) {
    return resolveAiContextPayloadForState({
      mode,
      draftLines: draftLines.value,
      selectedLineIds: selectedLineIds.value,
      activeNotebook: activeNotebook.value,
    });
  }

  const aiContextSummary = computed(() => {
    const payload = resolveAiContextPayload(aiContextMode.value);
    return summarizeAiContextPayload(payload);
  });

  let moveNotebookToRecycleBin = () => {};
  let moveSnapshotToRecycleBin = () => {};

  const lineActions = createLineNotebookActions({
    notebooks,
    activeNotebookId,
    activePageId,
    draftLines,
    selectedLineIds,
    activeLineId,
    lastSelectedLineId,
    newNotebookName,
    notebookNameDraft,
    mathFieldRefs,
    activeNotebook,
    activePage,
    sanitizeLineArray,
    createLine,
    createPage,
    createNotebook,
    nowIso,
    moveNotebookToRecycleBin: (...args) => moveNotebookToRecycleBin(...args),
  });

  const recycleActions = createRecycleBinActions({
    recycleBinItems,
    showRecycleBin,
    notebooks,
    activeNotebookId,
    activeNotebook,
    selectNotebook: lineActions.selectNotebook,
    createNotebook,
    uid,
    nowIso,
    deepClone,
    sanitizeSnapshotArray,
    rehydrateNotebook,
    makeUniqueNotebookName,
    makeUniqueSnapshotName,
    RECYCLE_BIN_LIMIT,
  });

  moveNotebookToRecycleBin = recycleActions.moveNotebookToRecycleBin;
  moveSnapshotToRecycleBin = recycleActions.moveSnapshotToRecycleBin;

  const historyActions = createHistoryActions({
    draftLines,
    snapshotNameDraft,
    activeNotebook,
    selectedSnapshotIds,
    renamingSnapshotId,
    filteredSnapshots,
    copiedSnapshotId,
    allSnapshotsSelected,
    SNAPSHOT_LIMIT,
    uid,
    nowIso,
    createLine,
    sanitizeLineArray,
    writeTextToClipboard,
    resolveTargetLineIds: lineActions.resolveTargetLineIds,
    clearLineSelection: lineActions.clearLineSelection,
    focusLine: lineActions.focusLine,
    touchActiveNotebook: lineActions.touchActiveNotebook,
    moveSnapshotToRecycleBin: (...args) => moveSnapshotToRecycleBin(...args),
  });

  const exportImportActions = createExportImportActions({
    activeNotebook,
    notebooks,
    selectedSnapshotIds,
    fileInputRef,
    selectNotebook: lineActions.selectNotebook,
    nowIso,
    sanitizeFileName,
    downloadFile,
    normalizeImportData,
    rehydrateNotebook,
  });

  const aiActions = createAiAssistantActions({
    uid,
    nowIso,
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
    resolveAiContextPayload,
  });

  function initializeState() {
    let loaded = safeParse(localStorage.getItem(NOTEBOOKS_KEY), null);

    if (!loaded) {
      const v2Data = safeParse(localStorage.getItem(LEGACY_V2_KEY), []);
      if (v2Data && v2Data.length > 0) {
        loaded = migrateNotebooksToV3(v2Data);
      }
    }

    if (!loaded || loaded.length === 0) {
      loaded = [createNotebook('默认草稿本')];
    } else {
      loaded = migrateNotebooksToV3(loaded);
    }

    notebooks.value = loaded;
    recycleBinItems.value = sanitizeRecycleBinArray(safeParse(localStorage.getItem(RECYCLE_BIN_KEY), []));
    enterCreatesEquationLine.value = parseBooleanSetting(localStorage.getItem(ENTER_EQUATION_LINE_ON_ENTER_KEY), true);

    const aiStore = normalizeAiStore(safeParse(localStorage.getItem(AI_ASSISTANT_KEY), {}));
    aiSessions.value = aiStore.sessions;
    activeAiSessionId.value = aiStore.activeSessionId;
    aiEndpoints.value = aiStore.endpoints;
    activeAiEndpointId.value = aiStore.activeEndpointId;
    aiSystemPrompts.value = aiStore.systemPrompts;
    activeAiSystemPromptId.value = aiStore.activeSystemPromptId;
    aiContextMode.value = aiStore.contextMode;
    aiThinkingMode.value = aiStore.thinkingMode;

    const storedActiveId = localStorage.getItem(ACTIVE_NOTEBOOK_KEY);
    const targetNotebook = notebooks.value.find((item) => item.id === storedActiveId) || notebooks.value[0];
    lineActions.selectNotebook(targetNotebook.id);
  }

  setupWorkbenchLifecycle({
    initializeState,
    lineActions,
    historyActions,
    notebooks,
    activeNotebookId,
    activeNotebook,
    activePageId,
    activePage,
    draftLines,
    selectedLineIds,
    selectedSnapshotIds,
    lastSelectedLineId,
    notebookNameDraft,
    searchQuery,
    filteredSnapshots,
    recycleBinItems,
    enterCreatesEquationLine,
    aiSessions,
    activeAiSessionId,
    aiEndpoints,
    activeAiEndpointId,
    aiSystemPrompts,
    activeAiSystemPromptId,
    aiContextMode,
    aiThinkingMode,
    ACTIVE_NOTEBOOK_KEY,
    NOTEBOOKS_KEY,
    RECYCLE_BIN_KEY,
    ENTER_EQUATION_LINE_ON_ENTER_KEY,
    AI_ASSISTANT_KEY,
  });

  return {
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
    activePage,
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
    setMathFieldRef: lineActions.setMathFieldRef,
    setActiveLine: lineActions.setActiveLine,
    selectNotebook: lineActions.selectNotebook,
    selectPage: lineActions.selectPage,
    addPage: lineActions.addPage,
    removePage: lineActions.removePage,
    createNotebookAction: lineActions.createNotebookAction,
    renameActiveNotebook: lineActions.renameActiveNotebook,
    deleteNotebook: lineActions.deleteNotebook,
    onLineInput: lineActions.onLineInput,
    isLineSelected: lineActions.isLineSelected,
    toggleLineSelection: lineActions.toggleLineSelection,
    insertLineAfter: lineActions.insertLineAfter,
    addLineToEnd: lineActions.addLineToEnd,
    insertEquationLineAfter: lineActions.insertEquationLineAfter,
    deleteLine: lineActions.deleteLine,
    deleteSelectedLines: lineActions.deleteSelectedLines,
    clearDraft: lineActions.clearDraft,
    insertTemplate: lineActions.insertTemplate,
    saveSnapshot: historyActions.saveSnapshot,
    restoreSnapshot: historyActions.restoreSnapshot,
    startRenameSnapshot: historyActions.startRenameSnapshot,
    finishRenameSnapshot: historyActions.finishRenameSnapshot,
    deleteSnapshot: historyActions.deleteSnapshot,
    toggleSelectAllSnapshots: historyActions.toggleSelectAllSnapshots,
    deleteSelectedSnapshots: historyActions.deleteSelectedSnapshots,
    makePreview,
    formatTime,
    exportCurrentNotebook: exportImportActions.exportCurrentNotebook,
    exportNotebookBundle: exportImportActions.exportNotebookBundle,
    exportAllNotebooks: exportImportActions.exportAllNotebooks,
    exportSnapshot: exportImportActions.exportSnapshot,
    triggerImport: exportImportActions.triggerImport,
    handleFileImport: exportImportActions.handleFileImport,
    copyLineText: historyActions.copyLineText,
    copySelectedLinesAs: historyActions.copySelectedLinesAs,
    copySnapshotData: historyActions.copySnapshotData,
    openRecycleBin: recycleActions.openRecycleBin,
    closeRecycleBin: recycleActions.closeRecycleBin,
    restoreRecycleBinItem: recycleActions.restoreRecycleBinItem,
    restoreAllRecycleBinItems: recycleActions.restoreAllRecycleBinItems,
    clearRecycleBin: recycleActions.clearRecycleBin,
    createAiSessionAction: aiActions.createAiSessionAction,
    deleteAiSession: aiActions.deleteAiSession,
    selectAiSession: aiActions.selectAiSession,
    updateAiMessage: aiActions.updateAiMessage,
    deleteAiMessage: aiActions.deleteAiMessage,
    sendAiPrompt: aiActions.sendAiPrompt,
    retryAiMessage: aiActions.retryAiMessage,
    setAiContextMode: aiActions.setAiContextMode,
    setAiThinkingMode: aiActions.setAiThinkingMode,
    selectAiEndpoint: aiActions.selectAiEndpoint,
    addAiEndpoint: aiActions.addAiEndpoint,
    removeAiEndpoint: aiActions.removeAiEndpoint,
    updateAiEndpointField: aiActions.updateAiEndpointField,
    selectAiSystemPrompt: aiActions.selectAiSystemPrompt,
    createAiSystemPromptAction: aiActions.createAiSystemPromptAction,
    removeAiSystemPrompt: aiActions.removeAiSystemPrompt,
    updateAiSystemPromptField: aiActions.updateAiSystemPromptField,
  };
}
