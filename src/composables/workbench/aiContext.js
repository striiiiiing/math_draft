function normalizeTextLines(lines) {
  if (!Array.isArray(lines)) return [];
  return lines
    .map((line) => (typeof line === 'string' ? line : ''))
    .filter((line) => line.trim().length > 0);
}

function toAlignedBlock(lines) {
  const normalized = normalizeTextLines(lines);
  if (normalized.length === 0) return { text: '', lineCount: 0 };
  return {
    text: `\\begin{aligned}\n${normalized.join(' \\\\\n')}\n\\end{aligned}`,
    lineCount: normalized.length,
  };
}

function buildCurrentFlowContext(draftLines) {
  const lines = draftLines.map((line) => line?.latex || '');
  const aligned = toAlignedBlock(lines);
  return {
    ok: true,
    label: '当前推导流（Aligned）',
    text: aligned.text,
    lineCount: aligned.lineCount,
  };
}

function buildSelectedLinesContext(draftLines, selectedLineIds) {
  const selectedSet = new Set(selectedLineIds);
  const selectedLines = draftLines
    .filter((line) => selectedSet.has(line.id))
    .map((line) => line?.latex || '');

  const aligned = toAlignedBlock(selectedLines);
  if (aligned.lineCount === 0) {
    return {
      ok: false,
      label: '多行选择（Aligned）',
      text: '',
      lineCount: 0,
      error: '已选择“读取多行选择”，但当前没有选中行。',
    };
  }

  return {
    ok: true,
    label: '多行选择（Aligned）',
    text: aligned.text,
    lineCount: aligned.lineCount,
  };
}

function buildNotebookContext(activeNotebook) {
  if (!activeNotebook) {
    return {
      ok: false,
      label: '整个草稿本（分页 Aligned）',
      text: '',
      lineCount: 0,
      error: '当前没有可用草稿本。',
    };
  }

  const pageBlocks = [];
  let totalLineCount = 0;

  (activeNotebook.pages || []).forEach((page, index) => {
    const aligned = toAlignedBlock(page?.lines || []);
    if (aligned.lineCount === 0) return;
    const pageName = typeof page?.name === 'string' && page.name.trim() ? page.name.trim() : `页面 ${index + 1}`;
    totalLineCount += aligned.lineCount;
    pageBlocks.push(`页面：${pageName}\n${aligned.text}`);
  });

  return {
    ok: true,
    label: '整个草稿本（分页 Aligned）',
    text: pageBlocks.join('\n\n'),
    lineCount: totalLineCount,
  };
}

export function resolveAiContextPayloadForState({ mode = 'current-flow', draftLines = [], selectedLineIds = [], activeNotebook = null }) {
  if (mode === 'none') {
    return { ok: true, label: '不读取上下文', text: '', lineCount: 0 };
  }
  if (mode === 'selected-lines') {
    return buildSelectedLinesContext(draftLines, selectedLineIds);
  }
  if (mode === 'whole-notebook') {
    return buildNotebookContext(activeNotebook);
  }

  return buildCurrentFlowContext(draftLines);
}

export function summarizeAiContextPayload(payload) {
  if (!payload?.ok) return payload?.error || '上下文读取失败';
  if (!payload?.text) return `${payload.label}：当前为空`;
  return `${payload.label}:${payload.lineCount} 行`;
}
