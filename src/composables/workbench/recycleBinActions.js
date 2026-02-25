export function createRecycleBinActions(ctx) {
  const {
    recycleBinItems,
    showRecycleBin,
    notebooks,
    activeNotebookId,
    activeNotebook,
    selectNotebook,
    createNotebook,
    uid,
    nowIso,
    deepClone,
    sanitizeSnapshotArray,
    rehydrateNotebook,
    makeUniqueNotebookName,
    makeUniqueSnapshotName,
    RECYCLE_BIN_LIMIT,
  } = ctx;

  function pushToRecycleBin(item) {
    recycleBinItems.value.unshift({
      ...item,
      recycleId: uid(),
      deletedAt: nowIso(),
    });
    if (recycleBinItems.value.length > RECYCLE_BIN_LIMIT) {
      recycleBinItems.value.splice(RECYCLE_BIN_LIMIT);
    }
  }

  function removeRecycleBinItem(recycleId) {
    recycleBinItems.value = recycleBinItems.value.filter((item) => item.recycleId !== recycleId);
  }

  function moveNotebookToRecycleBin(notebook) {
    if (!notebook) return;
    pushToRecycleBin({
      type: 'notebook',
      notebookName: notebook.name,
      notebook: deepClone(notebook),
    });
  }

  function moveSnapshotToRecycleBin(snapshot, notebook) {
    if (!snapshot || !notebook) return;
    pushToRecycleBin({
      type: 'snapshot',
      notebookId: notebook.id,
      notebookName: notebook.name,
      snapshotName: snapshot.name,
      snapshot: deepClone(snapshot),
    });
  }

  function openRecycleBin() {
    showRecycleBin.value = true;
  }

  function closeRecycleBin() {
    showRecycleBin.value = false;
  }

  function restoreNotebookFromRecycleItem(item, { selectRestored = true } = {}) {
    const nameSet = new Set(notebooks.value.map((entry) => entry.name));
    const restoredNotebook = rehydrateNotebook(item.notebook, nameSet, '恢复');
    if (!restoredNotebook) return false;

    notebooks.value.unshift(restoredNotebook);
    if (selectRestored) selectNotebook(restoredNotebook.id);
    return true;
  }

  function restoreSnapshotFromRecycleItem(item, { selectRestored = true } = {}) {
    let notebook = notebooks.value.find((entry) => entry.id === item.notebookId);
    if (!notebook) {
      const nameSet = new Set(notebooks.value.map((entry) => entry.name));
      const fallbackName = makeUniqueNotebookName(item.notebookName || '恢复草稿本', nameSet, '恢复');
      notebook = createNotebook(fallbackName);
      notebooks.value.unshift(notebook);
    }

    const normalized = sanitizeSnapshotArray([item.snapshot])[0];
    if (!normalized) return false;

    const restoredSnapshot = {
      ...normalized,
      id: uid(),
      name: makeUniqueSnapshotName(normalized.name, notebook.snapshots, '恢复'),
      createdAt: typeof item.snapshot?.createdAt === 'string' ? item.snapshot.createdAt : nowIso(),
      lines: normalized.lines,
      tags: Array.isArray(normalized.tags) ? normalized.tags : [],
    };

    notebook.snapshots.unshift(restoredSnapshot);
    notebook.updatedAt = nowIso();

    if (selectRestored) {
      activeNotebookId.value = notebook.id;
      selectNotebook(notebook.id);
    }
    return true;
  }

  function restoreRecycleBinItem(recycleId, options = {}) {
    const item = recycleBinItems.value.find((entry) => entry.recycleId === recycleId);
    if (!item) return false;

    let restored = false;
    if (item.type === 'notebook') {
      restored = restoreNotebookFromRecycleItem(item, options);
    }
    if (item.type === 'snapshot') {
      restored = restoreSnapshotFromRecycleItem(item, options);
    }

    if (restored) removeRecycleBinItem(recycleId);
    return restored;
  }

  function restoreAllRecycleBinItems() {
    if (recycleBinItems.value.length === 0) return;

    const ids = recycleBinItems.value.map((item) => item.recycleId);
    ids.reverse().forEach((recycleId) => {
      restoreRecycleBinItem(recycleId, { selectRestored: false });
    });
  }

  function clearRecycleBin() {
    if (recycleBinItems.value.length === 0) return;
    if (!window.confirm(`确认清空回收站中的 ${recycleBinItems.value.length} 条记录吗？`)) return;
    recycleBinItems.value = [];
  }

  return {
    pushToRecycleBin,
    moveNotebookToRecycleBin,
    moveSnapshotToRecycleBin,
    openRecycleBin,
    closeRecycleBin,
    restoreRecycleBinItem,
    restoreAllRecycleBinItems,
    clearRecycleBin,
  };
}
