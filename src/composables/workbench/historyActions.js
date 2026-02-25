export function createHistoryActions(ctx) {
  const {
    draftLines,
    snapshotNameDraft,
    activeNotebook,
    selectedSnapshotIds,
    renamingSnapshotId,
    filteredSnapshots,
    copiedSnapshotId,
    SNAPSHOT_LIMIT,
    nowIso,
    sanitizeLineArray,
    writeTextToClipboard,
    resolveTargetLineIds,
    clearLineSelection,
    focusLine,
    touchActiveNotebook,
    moveSnapshotToRecycleBin,
  } = ctx;

  let copyStateTimer = null;

  function saveSnapshot() {
    const hasContent = draftLines.value.some((line) => line.latex.trim().length > 0);
    if (!hasContent) return window.alert('当前草稿为空，无法保存推导流。');

    const now = new Date();
    const fallbackName = `推导 ${now.toLocaleString('zh-CN', { hour12: false })}`;
    const snapshotName = snapshotNameDraft.value.trim() || fallbackName;
    const notebook = activeNotebook.value;

    if (notebook) {
      notebook.snapshots.unshift({
        id: ctx.uid(),
        name: snapshotName,
        createdAt: now.toISOString(),
        lines: draftLines.value.map((line) => line.latex),
        tags: [],
      });
      if (notebook.snapshots.length > SNAPSHOT_LIMIT) notebook.snapshots.splice(SNAPSHOT_LIMIT);
      notebook.updatedAt = now.toISOString();
    }
    snapshotNameDraft.value = '';
  }

  function restoreSnapshot(snapshot) {
    if (!snapshot || !Array.isArray(snapshot.lines)) return;
    draftLines.value = sanitizeLineArray(snapshot.lines).map((latex) => ctx.createLine(latex));
    clearLineSelection();
    selectedSnapshotIds.value = [];
    touchActiveNotebook();
    focusLine(draftLines.value[0].id);
  }

  function startRenameSnapshot(snapshot) {
    renamingSnapshotId.value = snapshot.id;
  }

  function finishRenameSnapshot(snapshot, event) {
    const value = event.target.value.trim();
    if (value) snapshot.name = value;
    renamingSnapshotId.value = null;
    if (activeNotebook.value) activeNotebook.value.updatedAt = nowIso();
  }

  function deleteSnapshot(snapshotId) {
    const notebook = activeNotebook.value;
    if (!notebook) return;
    const snapshot = notebook.snapshots.find((item) => item.id === snapshotId);
    if (!snapshot) return;
    if (!window.confirm(`确认删除记录「${snapshot.name}」吗？`)) return;
    moveSnapshotToRecycleBin(snapshot, notebook);
    notebook.snapshots = notebook.snapshots.filter((item) => item.id !== snapshotId);
    notebook.updatedAt = nowIso();
    selectedSnapshotIds.value = selectedSnapshotIds.value.filter((id) => id !== snapshotId);
  }

  function toggleSelectAllSnapshots() {
    if (filteredSnapshots.value.length === 0) return;
    if (ctx.allSnapshotsSelected.value) {
      selectedSnapshotIds.value = [];
    } else {
      selectedSnapshotIds.value = filteredSnapshots.value.map((item) => item.id);
    }
  }

  function deleteSelectedSnapshots() {
    const notebook = activeNotebook.value;
    if (!notebook || selectedSnapshotIds.value.length === 0) return;
    if (!window.confirm(`确认删除选中的 ${selectedSnapshotIds.value.length} 条记录吗？`)) return;
    const selectedSet = new Set(selectedSnapshotIds.value);
    notebook.snapshots
      .filter((item) => selectedSet.has(item.id))
      .forEach((item) => moveSnapshotToRecycleBin(item, notebook));
    notebook.snapshots = notebook.snapshots.filter((item) => !selectedSet.has(item.id));
    notebook.updatedAt = nowIso();
    selectedSnapshotIds.value = [];
  }

  function markSnapshotCopied(snapshotId) {
    copiedSnapshotId.value = snapshotId;
    clearTimeout(copyStateTimer);
    copyStateTimer = setTimeout(() => {
      copiedSnapshotId.value = null;
    }, 1200);
  }

  async function copyLineText(latex) {
    const text = typeof latex === 'string' ? latex : '';
    if (!text.trim()) return;
    try {
      const copied = await writeTextToClipboard(text);
      if (!copied) throw new Error('复制失败');
    } catch {
      window.alert('复制失败，请检查浏览器权限。');
    }
  }

  async function copySelectedLinesAs(format = 'raw') {
    const targetIds = resolveTargetLineIds();
    if (targetIds.length === 0) {
      window.alert('请先选择要复制的行。');
      return;
    }

    const selectedSet = new Set(targetIds);
    const linesToCopy = draftLines.value
      .filter((line) => selectedSet.has(line.id))
      .map((line) => line.latex)
      .filter((line) => line.trim().length > 0);

    if (linesToCopy.length === 0) {
      window.alert('选中行没有可复制的内容。');
      return;
    }

    let resultText = '';
    if (format === 'aligned') {
      resultText = `\\begin{aligned}\n${linesToCopy.join(' \\\\\n')}\n\\end{aligned}`;
    } else if (format === 'markdown') {
      resultText = `$$\n\\begin{aligned}\n${linesToCopy.join(' \\\\\n')}\n\\end{aligned}\n$$`;
    } else {
      resultText = linesToCopy.join('\n');
    }

    try {
      const copied = await writeTextToClipboard(resultText);
      if (!copied) throw new Error('复制失败');
    } catch {
      window.alert('复制失败，请检查浏览器权限。');
    }
  }

  async function copySnapshotData(snapshot, format = 'aligned') {
    const lines = sanitizeLineArray(snapshot?.lines).filter((line) => line.trim().length > 0);
    if (lines.length === 0) {
      window.alert('该记录没有可复制内容。');
      return;
    }

    let text = '';
    if (format === 'aligned') {
      text = `\\begin{aligned}\n${lines.join(' \\\\\n')}\n\\end{aligned}`;
    } else if (format === 'markdown') {
      text = `$$\n\\begin{aligned}\n${lines.join(' \\\\\n')}\n\\end{aligned}\n$$`;
    } else {
      text = lines.join('\n');
    }

    try {
      const copied = await writeTextToClipboard(text);
      if (!copied) throw new Error('复制失败');
      markSnapshotCopied(snapshot.id);
    } catch {
      window.alert('复制失败，请检查浏览器权限。');
    }
  }

  function disposeHistoryActions() {
    clearTimeout(copyStateTimer);
  }

  return {
    saveSnapshot,
    restoreSnapshot,
    startRenameSnapshot,
    finishRenameSnapshot,
    deleteSnapshot,
    toggleSelectAllSnapshots,
    deleteSelectedSnapshots,
    copyLineText,
    copySelectedLinesAs,
    copySnapshotData,
    disposeHistoryActions,
  };
}
