import { onMounted, onUnmounted, watch } from 'vue';

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
    ACTIVE_NOTEBOOK_KEY,
    NOTEBOOKS_KEY,
    RECYCLE_BIN_KEY,
    ENTER_EQUATION_LINE_ON_ENTER_KEY,
    AI_ASSISTANT_KEY,
  } = ctx;

  let saveTimer = null;
  let recycleSaveTimer = null;
  let aiSaveTimer = null;

  function handleGlobalShortcuts(event) {
    const withMeta = event.ctrlKey || event.metaKey;
    if (!withMeta) return;
    if (event.key.toLowerCase() === 's') {
      event.preventDefault();
      historyActions.saveSnapshot();
    }
  }

  onMounted(() => {
    initializeState();
    window.addEventListener('keydown', handleGlobalShortcuts);
  });

  onUnmounted(() => {
    window.removeEventListener('keydown', handleGlobalShortcuts);
    clearTimeout(saveTimer);
    clearTimeout(recycleSaveTimer);
    clearTimeout(aiSaveTimer);
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
        };
        localStorage.setItem(AI_ASSISTANT_KEY, JSON.stringify(payload));
      }, 400);
    },
    { deep: true },
  );
}
