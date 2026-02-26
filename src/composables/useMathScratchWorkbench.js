import { computed, ref } from 'vue';
import {
  ACTIVE_NOTEBOOK_KEY,
  AI_ASSISTANT_KEY,
  ENTER_EQUATION_LINE_ON_ENTER_KEY,
  IMPORT_EXPORT_OPTIONS_KEY,
  LEGACY_V2_KEY,
  NOTEBOOKS_KEY,
  NUTSTORE_SYNC_KEY,
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
import { createNutstoreSyncActions, normalizeNutstoreSyncSettings } from './workbench/nutstoreSyncActions';
import { resolveAiContextPayloadForState, summarizeAiContextPayload } from './workbench/aiContext';
import {
  decryptAiStoreSecretsFromStorage,
  decryptNutstoreSettingsSecretsFromStorage,
} from './workbench/secureStorage';
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
  const aiFileInputRef = ref(null);
  const copiedSnapshotId = ref(null);
  const recycleBinItems = ref([]);
  const showRecycleBin = ref(false);
  const enterCreatesEquationLine = ref(true);
  const includeAiOnExport = ref(true);
  const includeAiOnImport = ref(true);

  const aiSessions = ref([]);
  const activeAiSessionId = ref('');
  const aiPromptDraft = ref('');
  const aiEndpoints = ref([]);
  const activeAiEndpointId = ref('');
  const aiSystemPrompts = ref([]);
  const activeAiSystemPromptId = ref('');
  const aiContextMode = ref('current-flow');
  const aiThinkingMode = ref('off');
  const autoSnapshotNamingEnabled = ref(false);
  const autoSnapshotNamingEndpointId = ref('');
  const autoSnapshotNamingSystemPromptId = ref('');
  const autoSnapshotNamingThinkingMode = ref('off');
  const aiIsRequesting = ref(false);
  const aiLastError = ref('');
  const nutstoreSyncSettings = ref(normalizeNutstoreSyncSettings({}));
  const nutstoreBackupHistory = ref([]);
  const nutstoreIsSyncing = ref(false);
  const nutstoreLastError = ref('');

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
  const nutstoreConnectionReady = computed(() => {
    const settings = normalizeNutstoreSyncSettings(nutstoreSyncSettings.value);
    return Boolean(settings.baseUrl && settings.username && settings.password);
  });

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
  let generateSnapshotAutoName = async () => '';

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
    activePage,
    autoSnapshotNamingEnabled,
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
    generateSnapshotAutoName: (...args) => generateSnapshotAutoName(...args),
  });

  const exportImportActions = createExportImportActions({
    activeNotebook,
    notebooks,
    selectedSnapshotIds,
    fileInputRef,
    aiFileInputRef,
    includeAiOnExport,
    includeAiOnImport,
    aiSessions,
    activeAiSessionId,
    aiEndpoints,
    activeAiEndpointId,
    aiSystemPrompts,
    activeAiSystemPromptId,
    aiContextMode,
    aiThinkingMode,
    autoSnapshotNamingEnabled,
    autoSnapshotNamingEndpointId,
    autoSnapshotNamingSystemPromptId,
    autoSnapshotNamingThinkingMode,
    normalizeAiStore,
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
    autoSnapshotNamingEnabled,
    autoSnapshotNamingEndpointId,
    autoSnapshotNamingSystemPromptId,
    autoSnapshotNamingThinkingMode,
    aiIsRequesting,
    aiLastError,
    resolveAiContextPayload,
  });

  generateSnapshotAutoName = aiActions.generateSnapshotAutoName;

  const nutstoreActions = createNutstoreSyncActions({
    notebooks,
    activeNotebookId,
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
    autoSnapshotNamingEnabled,
    autoSnapshotNamingEndpointId,
    autoSnapshotNamingSystemPromptId,
    autoSnapshotNamingThinkingMode,
    includeAiOnExport,
    includeAiOnImport,
    nutstoreSyncSettings,
    nutstoreBackupHistory,
    nutstoreIsSyncing,
    nutstoreLastError,
    deepClone,
    nowIso,
    migrateNotebooksToV3,
    sanitizeRecycleBinArray,
    createNotebook,
    normalizeAiStore,
    selectNotebook: lineActions.selectNotebook,
  });

  async function initializeState() {
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

    const rawAiStore = safeParse(localStorage.getItem(AI_ASSISTANT_KEY), {});
    const decryptedAiStore = await decryptAiStoreSecretsFromStorage(rawAiStore);
    const aiStore = normalizeAiStore(decryptedAiStore);
    aiSessions.value = aiStore.sessions;
    activeAiSessionId.value = aiStore.activeSessionId;
    aiEndpoints.value = aiStore.endpoints;
    activeAiEndpointId.value = aiStore.activeEndpointId;
    aiSystemPrompts.value = aiStore.systemPrompts;
    activeAiSystemPromptId.value = aiStore.activeSystemPromptId;
    aiContextMode.value = aiStore.contextMode;
    aiThinkingMode.value = aiStore.thinkingMode;
    autoSnapshotNamingEnabled.value = aiStore.autoSnapshotNamingEnabled;
    autoSnapshotNamingEndpointId.value = aiStore.autoSnapshotNamingEndpointId;
    autoSnapshotNamingSystemPromptId.value = aiStore.autoSnapshotNamingSystemPromptId;
    autoSnapshotNamingThinkingMode.value = aiStore.autoSnapshotNamingThinkingMode;

    const rawNutstoreSettings = safeParse(localStorage.getItem(NUTSTORE_SYNC_KEY), {});
    const decryptedNutstoreSettings = await decryptNutstoreSettingsSecretsFromStorage(rawNutstoreSettings);
    nutstoreSyncSettings.value = normalizeNutstoreSyncSettings(decryptedNutstoreSettings);
    const importExportOptions = safeParse(localStorage.getItem(IMPORT_EXPORT_OPTIONS_KEY), {});
    includeAiOnExport.value = importExportOptions?.includeAiOnExport !== false;
    includeAiOnImport.value = importExportOptions?.includeAiOnImport !== false;
    nutstoreBackupHistory.value = [];
    nutstoreLastError.value = '';

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
    autoSnapshotNamingEnabled,
    autoSnapshotNamingEndpointId,
    autoSnapshotNamingSystemPromptId,
    autoSnapshotNamingThinkingMode,
    includeAiOnExport,
    includeAiOnImport,
    nutstoreSyncSettings,
    nutstoreConnectionReady,
    ACTIVE_NOTEBOOK_KEY,
    NOTEBOOKS_KEY,
    RECYCLE_BIN_KEY,
    ENTER_EQUATION_LINE_ON_ENTER_KEY,
    AI_ASSISTANT_KEY,
    IMPORT_EXPORT_OPTIONS_KEY,
    NUTSTORE_SYNC_KEY,
    runNutstoreAutoSync: () => nutstoreActions.syncToNutstore('auto'),
  });

  function setIncludeAiOnExport(value) {
    includeAiOnExport.value = Boolean(value);
  }

  function setIncludeAiOnImport(value) {
    includeAiOnImport.value = Boolean(value);
  }

  function setAutoSnapshotNamingEnabled(value) {
    autoSnapshotNamingEnabled.value = Boolean(value);
  }

  function setAutoSnapshotNamingEndpointId(value) {
    const target = aiEndpoints.value.find((item) => item.id === value);
    if (!target) return;
    autoSnapshotNamingEndpointId.value = target.id;
  }

  function setAutoSnapshotNamingSystemPromptId(value) {
    const target = aiSystemPrompts.value.find((item) => item.id === value);
    if (!target) return;
    autoSnapshotNamingSystemPromptId.value = target.id;
  }

  function setAutoSnapshotNamingThinkingMode(value) {
    autoSnapshotNamingThinkingMode.value = value === 'on' ? 'on' : 'off';
  }

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
    aiFileInputRef,
    copiedSnapshotId,
    recycleBinItems,
    showRecycleBin,
    enterCreatesEquationLine,
    includeAiOnExport,
    includeAiOnImport,
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
    autoSnapshotNamingEnabled,
    autoSnapshotNamingEndpointId,
    autoSnapshotNamingSystemPromptId,
    autoSnapshotNamingThinkingMode,
    aiIsRequesting,
    aiLastError,
    nutstoreSyncSettings,
    nutstoreBackupHistory,
    nutstoreIsSyncing,
    nutstoreLastError,
    nutstoreConnectionReady,
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
    exportAiStore: exportImportActions.exportAiStore,
    exportSnapshot: exportImportActions.exportSnapshot,
    triggerImport: exportImportActions.triggerImport,
    handleFileImport: exportImportActions.handleFileImport,
    triggerAiImport: exportImportActions.triggerAiImport,
    handleAiFileImport: exportImportActions.handleAiFileImport,
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
    setIncludeAiOnExport,
    setIncludeAiOnImport,
    setAutoSnapshotNamingEnabled,
    setAutoSnapshotNamingEndpointId,
    setAutoSnapshotNamingSystemPromptId,
    setAutoSnapshotNamingThinkingMode,
    updateNutstoreSyncField: nutstoreActions.updateNutstoreSyncField,
    syncToNutstore: () => nutstoreActions.syncToNutstore('manual'),
    refreshNutstoreBackups: nutstoreActions.refreshNutstoreBackups,
    restoreNutstoreBackup: nutstoreActions.restoreNutstoreBackup,
  };
}
