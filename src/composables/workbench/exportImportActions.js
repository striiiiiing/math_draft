export function createExportImportActions(ctx) {
  const {
    activeNotebook,
    notebooks,
    selectedSnapshotIds,
    fileInputRef,
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

  function exportCurrentNotebook() {
    const notebook = activeNotebook.value;
    if (!notebook) return;
    const payload = { version: 3, exportedAt: nowIso(), notebook };
    const filename = `${sanitizeFileName(notebook.name)}.json`;
    downloadFile(filename, JSON.stringify(payload, null, 2), 'application/json;charset=utf-8');
  }

  function exportNotebookBundle() {
    const notebook = activeNotebook.value;
    if (!notebook) return;

    const snapshotsForExport = getSnapshotsForBundleExport(notebook);
    const payload = {
      version: 3,
      exportedAt: nowIso(),
      notebook: {
        ...notebook,
        snapshots: snapshotsForExport,
      },
    };

    const selectionSuffix = selectedSnapshotIds.value.length > 0 ? `selected-${snapshotsForExport.length}` : `all-${snapshotsForExport.length}`;
    const filename = `${sanitizeFileName(notebook.name)}-bundle-${selectionSuffix}.json`;
    downloadFile(filename, JSON.stringify(payload, null, 2), 'application/json;charset=utf-8');
  }

  function exportAllNotebooks() {
    const payload = { version: 3, exportedAt: nowIso(), notebooks: notebooks.value };
    downloadFile('math-scratch-all.json', JSON.stringify(payload, null, 2), 'application/json;charset=utf-8');
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

  function handleFileImport(event) {
    const file = event.target?.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const rawText = typeof e.target?.result === 'string' ? e.target.result : '';
        const data = JSON.parse(rawText);
        const importedNotebooks = normalizeImportData(data);
        if (importedNotebooks.length === 0) throw new Error('无效的数据格式');

        const nameSet = new Set(notebooks.value.map((item) => item.name));
        const preparedNotebooks = importedNotebooks
          .map((item) => rehydrateNotebook(item, nameSet, '导入'))
          .filter(Boolean);

        if (preparedNotebooks.length === 0) throw new Error('导入数据为空');

        notebooks.value = [...preparedNotebooks, ...notebooks.value];
        selectNotebook(preparedNotebooks[0].id);
      } catch (error) {
        window.alert(`导入失败：${error.message || '未知错误'}`);
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
    exportSnapshot,
    triggerImport,
    handleFileImport,
  };
}
