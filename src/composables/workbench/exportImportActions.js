export function createExportImportActions(ctx) {
  const {
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
    selectNotebook,
    nowIso,
    sanitizeFileName,
    downloadFile,
    normalizeImportData,
    rehydrateNotebook,
  } = ctx;

  function getSnapshotsForBundleExport(notebook) {
    if (!notebook) return [];
    if (selectedSnapshotIds.value.length === 0) return notebook.snapshots;

    const selectedSet = new Set(selectedSnapshotIds.value);
    const selected = notebook.snapshots.filter((item) => selectedSet.has(item.id));
    return selected.length > 0 ? selected : notebook.snapshots;
  }

  function createAiStorePayload() {
    return {
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
  }

  function attachAiStoreIfEnabled(payload) {
    if (!includeAiOnExport.value) return payload;
    return {
      ...payload,
      aiStore: createAiStorePayload(),
    };
  }

  function extractAiStoreFromPayload(data) {
    if (!data || typeof data !== 'object') return null;
    if (data.aiStore && typeof data.aiStore === 'object') return data.aiStore;
    if (data.appState?.aiStore && typeof data.appState.aiStore === 'object') return data.appState.aiStore;

    const hasAiStoreShape = Array.isArray(data.sessions)
      || Array.isArray(data.endpoints)
      || Array.isArray(data.systemPrompts)
      || typeof data.contextMode === 'string'
      || typeof data.thinkingMode === 'string';

    if (hasAiStoreShape) return data;
    return null;
  }

  function applyAiStore(rawAiStore) {
    const normalized = normalizeAiStore(rawAiStore || {});
    aiSessions.value = normalized.sessions;
    activeAiSessionId.value = normalized.activeSessionId;
    aiEndpoints.value = normalized.endpoints;
    activeAiEndpointId.value = normalized.activeEndpointId;
    aiSystemPrompts.value = normalized.systemPrompts;
    activeAiSystemPromptId.value = normalized.activeSystemPromptId;
    aiContextMode.value = normalized.contextMode;
    aiThinkingMode.value = normalized.thinkingMode;
    autoSnapshotNamingEnabled.value = normalized.autoSnapshotNamingEnabled;
    autoSnapshotNamingEndpointId.value = normalized.autoSnapshotNamingEndpointId;
    autoSnapshotNamingSystemPromptId.value = normalized.autoSnapshotNamingSystemPromptId;
    autoSnapshotNamingThinkingMode.value = normalized.autoSnapshotNamingThinkingMode;
  }

  function importNotebooksFromData(data) {
    const importedNotebooks = normalizeImportData(data);
    if (importedNotebooks.length === 0) return 0;

    const nameSet = new Set(notebooks.value.map((item) => item.name));
    const preparedNotebooks = importedNotebooks
      .map((item) => rehydrateNotebook(item, nameSet, '导入'))
      .filter(Boolean);

    if (preparedNotebooks.length === 0) return 0;

    notebooks.value = [...preparedNotebooks, ...notebooks.value];
    selectNotebook(preparedNotebooks[0].id);
    return preparedNotebooks.length;
  }

  function exportCurrentNotebook() {
    const notebook = activeNotebook.value;
    if (!notebook) return;
    const payload = attachAiStoreIfEnabled({ version: 3, exportedAt: nowIso(), notebook });
    const filename = `${sanitizeFileName(notebook.name)}.json`;
    downloadFile(filename, JSON.stringify(payload, null, 2), 'application/json;charset=utf-8');
  }

  function exportNotebookBundle() {
    const notebook = activeNotebook.value;
    if (!notebook) return;

    const snapshotsForExport = getSnapshotsForBundleExport(notebook);
    const payload = attachAiStoreIfEnabled({
      version: 3,
      exportedAt: nowIso(),
      notebook: {
        ...notebook,
        snapshots: snapshotsForExport,
      },
    });

    const selectionSuffix = selectedSnapshotIds.value.length > 0 ? `selected-${snapshotsForExport.length}` : `all-${snapshotsForExport.length}`;
    const filename = `${sanitizeFileName(notebook.name)}-bundle-${selectionSuffix}.json`;
    downloadFile(filename, JSON.stringify(payload, null, 2), 'application/json;charset=utf-8');
  }

  function exportAllNotebooks() {
    const payload = attachAiStoreIfEnabled({ version: 3, exportedAt: nowIso(), notebooks: notebooks.value });
    downloadFile('math-scratch-all.json', JSON.stringify(payload, null, 2), 'application/json;charset=utf-8');
  }

  function exportAiStore() {
    const payload = {
      version: 3,
      exportedAt: nowIso(),
      aiStore: createAiStorePayload(),
    };
    downloadFile('math-scratch-ai.json', JSON.stringify(payload, null, 2), 'application/json;charset=utf-8');
  }

  function exportSnapshot(snapshot) {
    const notebook = activeNotebook.value;
    if (!notebook) return;
    const filename = `${sanitizeFileName(notebook.name)}-${sanitizeFileName(snapshot.name)}.txt`;
    downloadFile(filename, (snapshot.lines || []).join('\n'));
  }

  function triggerImport() {
    fileInputRef.value?.click();
  }

  function triggerAiImport() {
    aiFileInputRef.value?.click();
  }

  function handleFileImport(event) {
    const file = event.target?.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const rawText = typeof e.target?.result === 'string' ? e.target.result : '';
        const data = JSON.parse(rawText);

        const importedNotebookCount = importNotebooksFromData(data);

        let aiImported = false;
        const aiStore = extractAiStoreFromPayload(data);
        if (includeAiOnImport.value && aiStore) {
          applyAiStore(aiStore);
          aiImported = true;
        }

        if (importedNotebookCount === 0 && !aiImported) {
          if (!includeAiOnImport.value && aiStore) {
            throw new Error('检测到 AI 会话记录，但当前“导入时应用 AI 会话记录”未勾选。');
          }
          throw new Error('无效的数据格式。');
        }
      } catch (error) {
        window.alert(`导入失败：${error.message || '未知错误'}`);
      } finally {
        if (event.target) event.target.value = '';
      }
    };
    reader.readAsText(file, 'utf-8');
  }

  function handleAiFileImport(event) {
    const file = event.target?.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        if (!includeAiOnImport.value) {
          throw new Error('当前“导入时应用 AI 会话记录”未勾选。');
        }

        const rawText = typeof e.target?.result === 'string' ? e.target.result : '';
        const data = JSON.parse(rawText);
        const aiStore = extractAiStoreFromPayload(data);
        if (!aiStore) throw new Error('文件中没有可导入的 AI 会话记录。');

        applyAiStore(aiStore);
      } catch (error) {
        window.alert(`导入 AI 会话失败：${error.message || '未知错误'}`);
      } finally {
        if (event.target) event.target.value = '';
      }
    };
    reader.readAsText(file, 'utf-8');
  }

  return {
    exportCurrentNotebook,
    exportNotebookBundle,
    exportAllNotebooks,
    exportAiStore,
    exportSnapshot,
    triggerImport,
    triggerAiImport,
    handleFileImport,
    handleAiFileImport,
  };
}
