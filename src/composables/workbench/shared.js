import { isProxy, toRaw } from 'vue';

export function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function nowIso() {
  return new Date().toISOString();
}

export function createLine(latex = '') {
  return { id: uid(), latex };
}

export function safeParse(raw, fallback) {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function parseBooleanSetting(raw, fallback = false) {
  if (raw === '1' || raw === 'true') return true;
  if (raw === '0' || raw === 'false') return false;
  return fallback;
}

function unwrapReactive(value, seen = new WeakMap()) {
  if (value === null || typeof value !== 'object') return value;

  const maybeRaw = isProxy(value) ? toRaw(value) : value;
  if (seen.has(maybeRaw)) return seen.get(maybeRaw);

  if (Array.isArray(maybeRaw)) {
    const nextArray = [];
    seen.set(maybeRaw, nextArray);
    maybeRaw.forEach((item) => {
      nextArray.push(unwrapReactive(item, seen));
    });
    return nextArray;
  }

  const nextObject = {};
  seen.set(maybeRaw, nextObject);
  Object.entries(maybeRaw).forEach(([key, item]) => {
    nextObject[key] = unwrapReactive(item, seen);
  });
  return nextObject;
}

export function deepClone(value) {
  const normalized = unwrapReactive(value);

  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(normalized);
    } catch {
      // Fallback to JSON clone for environments/value shapes not supported by structuredClone.
    }
  }

  try {
    return JSON.parse(JSON.stringify(normalized));
  } catch {
    if (Array.isArray(normalized)) return [...normalized];
    if (normalized && typeof normalized === 'object') return { ...normalized };
    return normalized;
  }
}

export function sanitizeLineArray(value) {
  if (!Array.isArray(value)) return [''];
  const lines = value.map((item) => (typeof item === 'string' ? item : '')).filter((item) => typeof item === 'string');
  return lines.length > 0 ? lines : [''];
}

export function sanitizeSnapshotArray(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && typeof item === 'object' && Array.isArray(item.lines))
    .map((item) => ({
      id: typeof item.id === 'string' && item.id.length > 0 ? item.id : uid(),
      name: typeof item.name === 'string' && item.name.trim().length > 0 ? item.name.trim() : '未命名推导流',
      createdAt: typeof item.createdAt === 'string' ? item.createdAt : nowIso(),
      lines: sanitizeLineArray(item.lines),
      tags: Array.isArray(item.tags) ? item.tags : [],
    }));
}

export function sanitizeRecycleBinArray(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && typeof item === 'object')
    .map((item) => {
      if (item.type === 'notebook' && item.notebook && typeof item.notebook === 'object') {
        return {
          recycleId: typeof item.recycleId === 'string' ? item.recycleId : uid(),
          type: 'notebook',
          deletedAt: typeof item.deletedAt === 'string' ? item.deletedAt : nowIso(),
          notebookName: typeof item.notebookName === 'string' ? item.notebookName : '未命名草稿本',
          notebook: item.notebook,
        };
      }

      if (item.type === 'snapshot' && item.snapshot && typeof item.snapshot === 'object') {
        return {
          recycleId: typeof item.recycleId === 'string' ? item.recycleId : uid(),
          type: 'snapshot',
          deletedAt: typeof item.deletedAt === 'string' ? item.deletedAt : nowIso(),
          notebookId: typeof item.notebookId === 'string' ? item.notebookId : '',
          notebookName: typeof item.notebookName === 'string' ? item.notebookName : '未命名草稿本',
          snapshotName: typeof item.snapshotName === 'string' ? item.snapshotName : '未命名推导流',
          snapshot: item.snapshot,
        };
      }

      return null;
    })
    .filter(Boolean);
}

export function createPage(name = '页面 1', lines = ['']) {
  return { id: uid(), name, lines: sanitizeLineArray(lines) };
}

export function createNotebook(name, payload = {}) {
  const notebookName = typeof name === 'string' && name.trim().length > 0 ? name.trim() : '未命名草稿本';
  const createdAt = nowIso();
  return {
    id: uid(),
    name: notebookName,
    createdAt,
    updatedAt: createdAt,
    pages: payload.pages ? payload.pages : [createPage('主草稿', payload.currentLines || [''])],
    snapshots: sanitizeSnapshotArray(payload.snapshots),
  };
}

export function migrateNotebooksToV3(notebooksArray) {
  if (!Array.isArray(notebooksArray)) return [];
  return notebooksArray
    .filter((item) => item && typeof item === 'object')
    .map((item) => {
      const createdAt = typeof item.createdAt === 'string' ? item.createdAt : nowIso();
      return {
        id: typeof item.id === 'string' && item.id.length > 0 ? item.id : uid(),
        name: typeof item.name === 'string' && item.name.trim().length > 0 ? item.name.trim() : '未命名草稿本',
        createdAt,
        updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : createdAt,
        pages: Array.isArray(item.pages)
          ? item.pages
          : [createPage('主草稿', item.currentLines || [''])],
        snapshots: sanitizeSnapshotArray(item.snapshots),
      };
    });
}

export function makePreview(lines) {
  const merged = sanitizeLineArray(lines).filter((line) => line.trim().length > 0).slice(0, 2).join(' ; ');
  return merged || '(空内容)';
}

export function formatTime(isoDate) {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return '时间未知';
  return date.toLocaleString('zh-CN', { hour12: false });
}

export function sanitizeFileName(name) {
  return (name || 'math-scratch').replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_').slice(0, 80) || 'math-scratch';
}

export function downloadFile(filename, content, mimeType = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function writeTextToClipboard(text) {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  let copied = false;
  try {
    copied = document.execCommand('copy');
  } catch {
    copied = false;
  }
  document.body.removeChild(textarea);
  return copied;
}

export function normalizeImportData(data) {
  if (Array.isArray(data)) return migrateNotebooksToV3(data);

  if (data && typeof data === 'object') {
    if (Array.isArray(data.notebooks)) return migrateNotebooksToV3(data.notebooks);
    if (data.notebook && typeof data.notebook === 'object') return migrateNotebooksToV3([data.notebook]);
    if (Array.isArray(data.pages) || Array.isArray(data.snapshots) || Array.isArray(data.currentLines)) {
      return migrateNotebooksToV3([data]);
    }
  }

  return [];
}

export function makeUniqueNotebookName(baseName, nameSet, suffix = '导入') {
  const normalizedBase = typeof baseName === 'string' && baseName.trim().length > 0 ? baseName.trim() : '未命名草稿本';
  let candidate = `${normalizedBase} (${suffix})`;
  if (!nameSet.has(candidate)) return candidate;

  let index = 2;
  while (nameSet.has(candidate)) {
    index += 1;
    candidate = `${normalizedBase} (${suffix} ${index})`;
  }
  return candidate;
}

export function rehydrateNotebook(notebook, nameSet, suffix = '导入') {
  const migrated = migrateNotebooksToV3([notebook])[0];
  if (!migrated) return null;

  const notebookName = makeUniqueNotebookName(migrated.name, nameSet, suffix);
  nameSet.add(notebookName);

  const pages = Array.isArray(migrated.pages) && migrated.pages.length > 0
    ? migrated.pages.map((page, index) => ({
      id: uid(),
      name: typeof page?.name === 'string' && page.name.trim().length > 0 ? page.name.trim() : `页面 ${index + 1}`,
      lines: sanitizeLineArray(page?.lines || ['']),
    }))
    : [createPage('主草稿', [''])];

  const snapshots = sanitizeSnapshotArray(migrated.snapshots).map((item) => ({
    ...item,
    id: uid(),
  }));

  return {
    id: uid(),
    name: notebookName,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    pages,
    snapshots,
  };
}

export function makeUniqueSnapshotName(baseName, snapshots, suffix = '恢复') {
  const normalizedBase = typeof baseName === 'string' && baseName.trim().length > 0 ? baseName.trim() : '未命名推导流';
  const existingNames = new Set((snapshots || []).map((item) => item.name));
  if (!existingNames.has(normalizedBase)) return normalizedBase;

  let candidate = `${normalizedBase} (${suffix})`;
  if (!existingNames.has(candidate)) return candidate;

  let index = 2;
  while (existingNames.has(candidate)) {
    index += 1;
    candidate = `${normalizedBase} (${suffix} ${index})`;
  }
  return candidate;
}
