import { nextTick } from 'vue';

export function createLineNotebookActions(ctx) {
  const {
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
    createLine,
    createPage,
    createNotebook,
    nowIso,
    moveNotebookToRecycleBin,
  } = ctx;

  function setMathFieldRef(id, element) {
    if (element) mathFieldRefs.set(id, element);
    else mathFieldRefs.delete(id);
  }

  function getScrollContainer(element) {
    if (!element || typeof window === 'undefined') return null;
    let current = element.parentElement;
    while (current) {
      const style = window.getComputedStyle(current);
      const canScrollY = /(auto|scroll|overlay)/.test(style.overflowY || '');
      if (canScrollY && current.scrollHeight > current.clientHeight) return current;
      current = current.parentElement;
    }
    return document.scrollingElement || document.documentElement || null;
  }

  function findLineIndex(lineId) {
    return draftLines.value.findIndex((line) => line.id === lineId);
  }

  function setActiveLine(lineId) {
    activeLineId.value = lineId;
  }

  function clearLineSelection() {
    selectedLineIds.value = [];
    lastSelectedLineId.value = '';
  }

  function resolveTargetLineIds() {
    const existingIds = new Set(draftLines.value.map((line) => line.id));
    const selected = selectedLineIds.value.filter((id) => existingIds.has(id));
    if (selected.length > 0) return selected;
    if (activeLineId.value && existingIds.has(activeLineId.value)) return [activeLineId.value];
    return [];
  }

  function isLineSelected(lineId) {
    return selectedLineIds.value.includes(lineId);
  }

  function toggleLineSelection(lineId, lineIndex, event) {
    if (!lineId) return;
    if (typeof lineIndex !== 'number' || lineIndex < 0) lineIndex = findLineIndex(lineId);
    if (lineIndex < 0) return;

    const orderedLineIds = draftLines.value.map((line) => line.id);
    const current = new Set(selectedLineIds.value);
    const anchorId = lastSelectedLineId.value || lineId;
    const anchorIndex = orderedLineIds.indexOf(anchorId);

    if (event?.shiftKey && anchorIndex >= 0) {
      const start = Math.min(anchorIndex, lineIndex);
      const end = Math.max(anchorIndex, lineIndex);
      selectedLineIds.value = orderedLineIds.slice(start, end + 1);
      activeLineId.value = lineId;
      return;
    }

    if (current.has(lineId)) current.delete(lineId);
    else current.add(lineId);

    selectedLineIds.value = orderedLineIds.filter((id) => current.has(id));
    lastSelectedLineId.value = lineId;
    activeLineId.value = lineId;
  }

  function focusLine(lineId, options = {}) {
    const { preventScroll = false, preserveScroll = false } = options;
    activeLineId.value = lineId;
    nextTick(() => {
      const field = mathFieldRefs.get(lineId);
      if (!field || typeof field.focus !== 'function') return;

      const scrollContainer = preserveScroll ? getScrollContainer(field) : null;
      const previousScrollTop = scrollContainer?.scrollTop ?? 0;
      const previousScrollLeft = scrollContainer?.scrollLeft ?? 0;

      try {
        if (preventScroll) field.focus({ preventScroll: true });
        else field.focus();
      } catch {
        field.focus();
      }

      if (!scrollContainer) return;

      const restoreScroll = () => {
        scrollContainer.scrollTop = previousScrollTop;
        scrollContainer.scrollLeft = previousScrollLeft;
      };

      restoreScroll();
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(restoreScroll);
    });
  }

  function deleteSelectedLines() {
    const targetIds = resolveTargetLineIds();
    if (targetIds.length === 0) return;

    const targetSet = new Set(targetIds);
    const firstTargetIndex = draftLines.value.findIndex((line) => targetSet.has(line.id));
    const nextLines = draftLines.value.filter((line) => !targetSet.has(line.id));

    if (nextLines.length === 0) {
      const fallbackLine = createLine('');
      draftLines.value = [fallbackLine];
      clearLineSelection();
      focusLine(fallbackLine.id);
      return;
    }

    draftLines.value = nextLines;
    clearLineSelection();
    const focusIndex = Math.min(Math.max(firstTargetIndex, 0), draftLines.value.length - 1);
    focusLine(draftLines.value[focusIndex].id);
  }

  function loadDraftFromPage(page) {
    const plainLines = ctx.sanitizeLineArray(page?.lines || ['']);
    draftLines.value = plainLines.map((latex) => createLine(latex));
    clearLineSelection();
    if (draftLines.value[0]) {
      focusLine(draftLines.value[0].id, { preventScroll: true, preserveScroll: true });
    }
  }

  function syncDraftToActivePage() {
    const page = activePage.value;
    if (!page) return;
    page.lines = draftLines.value.map((line) => line.latex);
  }

  function touchActiveNotebook() {
    if (activeNotebook.value) activeNotebook.value.updatedAt = nowIso();
  }

  function selectNotebook(notebookId) {
    const target = notebooks.value.find((item) => item.id === notebookId);
    if (!target) return;
    activeNotebookId.value = target.id;
    activePageId.value = target.pages[0]?.id || '';
  }

  function selectPage(pageId) {
    activePageId.value = pageId;
  }

  function addPage() {
    const notebook = activeNotebook.value;
    if (!notebook) return;
    const newPage = createPage(`页面 ${notebook.pages.length + 1}`);
    notebook.pages.push(newPage);
    activePageId.value = newPage.id;
  }

  function removePage(pageId) {
    const notebook = activeNotebook.value;
    if (!notebook || !pageId) return;
    if (!Array.isArray(notebook.pages) || notebook.pages.length <= 1) return;

    const pageIndex = notebook.pages.findIndex((page) => page.id === pageId);
    if (pageIndex < 0) return;

    const removingActivePage = activePageId.value === pageId;
    notebook.pages.splice(pageIndex, 1);

    if (removingActivePage) {
      const fallbackPage = notebook.pages[pageIndex] || notebook.pages[pageIndex - 1] || notebook.pages[0];
      activePageId.value = fallbackPage?.id || '';
    }

    notebook.updatedAt = nowIso();
  }

  function createNotebookAction() {
    const fallbackName = `草稿本 ${notebooks.value.length + 1}`;
    const notebook = createNotebook(newNotebookName.value.trim() || fallbackName);
    notebooks.value.unshift(notebook);
    newNotebookName.value = '';
    selectNotebook(notebook.id);
  }

  function renameActiveNotebook() {
    const notebook = activeNotebook.value;
    if (!notebook) return;
    const name = notebookNameDraft.value.trim();
    if (!name) {
      notebookNameDraft.value = notebook.name;
      return;
    }
    notebook.name = name;
    notebook.updatedAt = nowIso();
  }

  function deleteNotebook(notebookId) {
    const target = notebooks.value.find((item) => item.id === notebookId);
    if (!target) return;
    if (!window.confirm(`确认删除草稿本「${target.name}」吗？`)) return;

    moveNotebookToRecycleBin(target);

    const index = notebooks.value.findIndex((item) => item.id === notebookId);
    notebooks.value.splice(index, 1);

    if (notebooks.value.length === 0) {
      const fallback = createNotebook('默认草稿本');
      notebooks.value.push(fallback);
    }

    if (activeNotebookId.value === notebookId) {
      const nextNotebook = notebooks.value[index] || notebooks.value[index - 1] || notebooks.value[0];
      selectNotebook(nextNotebook.id);
    }
  }

  function onLineInput(lineId, event) {
    const lineIndex = findLineIndex(lineId);
    if (lineIndex < 0) return;
    draftLines.value[lineIndex].latex = event.target.value ?? '';
  }

  function insertLineAfter(lineId, initialLatex = '') {
    const lineIndex = findLineIndex(lineId);
    const newLine = createLine(initialLatex);
    if (lineIndex < 0) draftLines.value.push(newLine);
    else draftLines.value.splice(lineIndex + 1, 0, newLine);
    focusLine(newLine.id);
    return newLine.id;
  }

  function addLineToEnd(initialLatex = '') {
    const newLine = createLine(initialLatex);
    draftLines.value.push(newLine);
    focusLine(newLine.id);
  }

  function insertEquationLineAfter(lineId) {
    insertLineAfter(lineId, '=');
  }

  function deleteLine(lineId) {
    const lineIndex = findLineIndex(lineId);
    if (lineIndex < 0) return;
    if (draftLines.value.length === 1) {
      draftLines.value[0].latex = '';
      clearLineSelection();
      focusLine(draftLines.value[0].id);
      return;
    }
    const nextFocus = draftLines.value[lineIndex + 1]?.id || draftLines.value[lineIndex - 1]?.id;
    draftLines.value.splice(lineIndex, 1);
    selectedLineIds.value = selectedLineIds.value.filter((id) => id !== lineId);
    if (lastSelectedLineId.value === lineId) lastSelectedLineId.value = selectedLineIds.value[selectedLineIds.value.length - 1] || '';
    if (nextFocus) focusLine(nextFocus);
  }

  function clearDraft() {
    if (!window.confirm('确认清空当前页面的草稿吗？')) return;
    draftLines.value = [createLine('')];
    clearLineSelection();
    touchActiveNotebook();
    focusLine(draftLines.value[0].id);
  }

  function insertTemplate(latex) {
    const targetId = activeLineId.value || draftLines.value[draftLines.value.length - 1]?.id;
    if (!targetId) return addLineToEnd(latex);

    const field = mathFieldRefs.get(targetId);
    if (field && typeof field.insert === 'function') {
      field.focus();
      field.insert(latex);
      const lineIndex = findLineIndex(targetId);
      if (lineIndex >= 0) draftLines.value[lineIndex].latex = field.value ?? draftLines.value[lineIndex].latex;
      return;
    }
    const lineIndex = findLineIndex(targetId);
    if (lineIndex >= 0) draftLines.value[lineIndex].latex += latex;
  }

  return {
    setMathFieldRef,
    setActiveLine,
    findLineIndex,
    clearLineSelection,
    resolveTargetLineIds,
    isLineSelected,
    toggleLineSelection,
    deleteSelectedLines,
    focusLine,
    loadDraftFromPage,
    syncDraftToActivePage,
    touchActiveNotebook,
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
    clearDraft,
    insertTemplate,
  };
}
