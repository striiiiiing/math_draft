import { onMounted, onUnmounted, watch } from 'vue';
import {
  encryptAiStoreSecretsForStorage,
  encryptNutstoreSettingsSecretsForStorage,
} from './secureStorage';

export function setupWorkbenchLifecycle(ctx) {
  const {
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
    runNutstoreAutoSync,
  } = ctx;

  let saveTimer = null;
  let recycleSaveTimer = null;
  let aiSaveTimer = null;
  let importExportOptionsSaveTimer = null;
  let nutstoreSaveTimer = null;
  let nutstoreAutoSyncTimer = null;

  function clearNutstoreAutoSyncTimer() {
    if (nutstoreAutoSyncTimer) {
      clearInterval(nutstoreAutoSyncTimer);
      nutstoreAutoSyncTimer = null;
    }
  }

  function resetNutstoreAutoSyncTimer() {
    clearNutstoreAutoSyncTimer();
    const settings = nutstoreSyncSettings?.value || {};
    if (!settings.autoSyncEnabled) return;
    if (!nutstoreConnectionReady?.value) return;

    const intervalMinutesRaw = Number(settings.autoSyncMinutes);
    const intervalMinutes = Number.isFinite(intervalMinutesRaw) && intervalMinutesRaw > 0
      ? intervalMinutesRaw
      : 30;
    const intervalMs = Math.max(60 * 1000, Math.floor(intervalMinutes * 60 * 1000));

    nutstoreAutoSyncTimer = setInterval(() => {
      if (typeof runNutstoreAutoSync === 'function') {
        void runNutstoreAutoSync();
      }
    }, intervalMs);
  }

  function handleGlobalShortcuts(event) {
    const withMeta = event.ctrlKey || event.metaKey;
    if (!withMeta) return;
    if (event.key.toLowerCase() === 's') {
      event.preventDefault();
      historyActions.saveSnapshot();
    }
  }

  onMounted(() => {
    void initializeState();
    window.addEventListener('keydown', handleGlobalShortcuts);
    resetNutstoreAutoSyncTimer();
  });

  onUnmounted(() => {
    window.removeEventListener('keydown', handleGlobalShortcuts);
    clearTimeout(saveTimer);
    clearTimeout(recycleSaveTimer);
    clearTimeout(aiSaveTimer);
    clearTimeout(importExportOptionsSaveTimer);
    clearTimeout(nutstoreSaveTimer);
    clearNutstoreAutoSyncTimer();
    historyActions.disposeHistoryActions();
  });

  watch(activeNotebookId, (nextId) => {
    if (!nextId) return;
    localStorage.setItem(ACTIVE_NOTEBOOK_KEY, nextId);
    selectedSnapshotIds.value = [];
    lineActions.clearLineSelection();
    notebookNameDraft.value = activeNotebook.value?.name || '';
    searchQuery.value = '';
  });

  watch(activePageId, (nextPageId) => {
    if (nextPageId && activePage.value) {
      lineActions.loadDraftFromPage(activePage.value);
    }
  });

  watch(draftLines, () => {
    lineActions.syncDraftToActivePage();
    const existingLineIds = new Set(draftLines.value.map((line) => line.id));
    selectedLineIds.value = selectedLineIds.value.filter((id) => existingLineIds.has(id));
    if (lastSelectedLineId.value && !existingLineIds.has(lastSelectedLineId.value)) {
      lastSelectedLineId.value = selectedLineIds.value[selectedLineIds.value.length - 1] || '';
    }
  }, { deep: true });

  watch(notebooks, (currentNotebooks) => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      localStorage.setItem(NOTEBOOKS_KEY, JSON.stringify(currentNotebooks));
    }, 500);

    const existingIds = new Set(filteredSnapshots.value.map((item) => item.id));
    selectedSnapshotIds.value = selectedSnapshotIds.value.filter((id) => existingIds.has(id));
  }, { deep: true });

  watch(recycleBinItems, (currentItems) => {
    clearTimeout(recycleSaveTimer);
    recycleSaveTimer = setTimeout(() => {
      localStorage.setItem(RECYCLE_BIN_KEY, JSON.stringify(currentItems));
    }, 300);
  }, { deep: true });

  watch(enterCreatesEquationLine, (enabled) => {
    localStorage.setItem(ENTER_EQUATION_LINE_ON_ENTER_KEY, enabled ? '1' : '0');
  });

  watch(
    [
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
    ],
    () => {
      clearTimeout(aiSaveTimer);
      aiSaveTimer = setTimeout(() => {
        const payload = {
          sessions: aiSessions.value,
          activeSessionId: activeAiSessionId.value,
          endpoints: aiEndpoints.value,
          activeEndpointId: activeAiEndpointId.value,
          systemPrompts: aiSystemPrompts.value,
          activeSystemPromptId: activeAiSystemPromptId.value,
          contextMode: aiContextMode.value,
          thinkingMode: aiThinkingMode.value,
          autoSnapshotNamingEnabled: Boolean(autoSnapshotNamingEnabled.value),
          autoSnapshotNamingEndpointId: autoSnapshotNamingEndpointId.value,
          autoSnapshotNamingSystemPromptId: autoSnapshotNamingSystemPromptId.value,
          autoSnapshotNamingThinkingMode: autoSnapshotNamingThinkingMode.value,
        };
        void encryptAiStoreSecretsForStorage(payload)
          .then((encryptedPayload) => {
            localStorage.setItem(AI_ASSISTANT_KEY, JSON.stringify(encryptedPayload));
          })
          .catch(() => {
            localStorage.setItem(AI_ASSISTANT_KEY, JSON.stringify(payload));
          });
      }, 400);
    },
    { deep: true },
  );

  watch([includeAiOnExport, includeAiOnImport], () => {
    clearTimeout(importExportOptionsSaveTimer);
    importExportOptionsSaveTimer = setTimeout(() => {
      localStorage.setItem(IMPORT_EXPORT_OPTIONS_KEY, JSON.stringify({
        includeAiOnExport: Boolean(includeAiOnExport.value),
        includeAiOnImport: Boolean(includeAiOnImport.value),
      }));
    }, 200);
  }, { deep: true });

  watch(nutstoreSyncSettings, (settings) => {
    clearTimeout(nutstoreSaveTimer);
    nutstoreSaveTimer = setTimeout(() => {
      void encryptNutstoreSettingsSecretsForStorage(settings)
        .then((encryptedSettings) => {
          localStorage.setItem(NUTSTORE_SYNC_KEY, JSON.stringify(encryptedSettings));
        })
        .catch(() => {
          localStorage.setItem(NUTSTORE_SYNC_KEY, JSON.stringify(settings));
        });
    }, 300);
    resetNutstoreAutoSyncTimer();
  }, { deep: true });

  watch(nutstoreConnectionReady, () => {
    resetNutstoreAutoSyncTimer();
  });
}
