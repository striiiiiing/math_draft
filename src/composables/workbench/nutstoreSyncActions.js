const BACKUP_SCHEMA = 'math-scratch.nutstore-backup.v1';
const BACKUP_FILE_PREFIX = 'math-scratch-backup-';
const DEFAULT_BASE_URL = 'https://dav.jianguoyun.com/dav/';
const DEFAULT_BACKUP_DIR = 'MathScratchBackups';
const DEFAULT_AUTO_SYNC_MINUTES = 30;
const DEFAULT_MAX_BACKUPS = 50;
const MAX_INTERVAL_MINUTES = 24 * 60;

function sanitizePositiveInt(value, fallback, min = 1, max = Number.MAX_SAFE_INTEGER) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  const normalized = Math.floor(numeric);
  if (normalized < min) return fallback;
  if (normalized > max) return max;
  return normalized;
}

function ensureTrailingSlash(url) {
  const raw = typeof url === 'string' ? url.trim() : '';
  if (!raw) return '';
  return raw.endsWith('/') ? raw : `${raw}/`;
}

function normalizeBaseUrlInput(url, fallback = '') {
  if (typeof url !== 'string') return fallback;
  return url.trim();
}

function normalizeBackupDir(dir) {
  const raw = typeof dir === 'string' ? dir.trim() : '';
  const normalized = raw.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  return normalized || DEFAULT_BACKUP_DIR;
}

function toIsoFromMaybeDate(input) {
  if (typeof input !== 'string' || !input.trim()) return '';
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString();
}

function createDefaultNutstoreSyncSettings() {
  return {
    baseUrl: DEFAULT_BASE_URL,
    username: '',
    password: '',
    backupDir: DEFAULT_BACKUP_DIR,
    autoSyncEnabled: false,
    autoSyncMinutes: DEFAULT_AUTO_SYNC_MINUTES,
    maxBackups: DEFAULT_MAX_BACKUPS,
    unlimitedBackups: false,
    lastSyncAt: '',
  };
}

export function normalizeNutstoreSyncSettings(rawValue) {
  const defaults = createDefaultNutstoreSyncSettings();
  const source = rawValue && typeof rawValue === 'object' ? rawValue : {};
  const baseUrl = normalizeBaseUrlInput(
    typeof source.baseUrl === 'string' ? source.baseUrl : defaults.baseUrl,
    defaults.baseUrl,
  );
  return {
    baseUrl,
    username: typeof source.username === 'string' ? source.username.trim() : defaults.username,
    password: typeof source.password === 'string' ? source.password : defaults.password,
    backupDir: normalizeBackupDir(typeof source.backupDir === 'string' ? source.backupDir : defaults.backupDir),
    autoSyncEnabled: Boolean(source.autoSyncEnabled),
    autoSyncMinutes: sanitizePositiveInt(source.autoSyncMinutes, defaults.autoSyncMinutes, 1, MAX_INTERVAL_MINUTES),
    maxBackups: sanitizePositiveInt(source.maxBackups, defaults.maxBackups, 1, Number.MAX_SAFE_INTEGER),
    unlimitedBackups: Boolean(source.unlimitedBackups),
    lastSyncAt: toIsoFromMaybeDate(source.lastSyncAt),
  };
}

function encodeBasicAuth(username, password) {
  const text = `${username}:${password}`;
  if (typeof TextEncoder !== 'undefined') {
    const bytes = new TextEncoder().encode(text);
    let binary = '';
    bytes.forEach((item) => {
      binary += String.fromCharCode(item);
    });
    return btoa(binary);
  }
  return btoa(text);
}

function isCollectionNode(node) {
  if (!node) return false;
  const children = Array.from(node.children || []);
  return children.some((child) => (child.localName || '').toLowerCase() === 'collection');
}

function pickNodeText(responseNode, localName) {
  if (!responseNode) return '';
  const normalized = localName.toLowerCase();
  const queue = [responseNode];
  while (queue.length > 0) {
    const current = queue.shift();
    if ((current.localName || '').toLowerCase() === normalized) {
      return current.textContent?.trim() || '';
    }
    queue.push(...Array.from(current.children || []));
  }
  return '';
}

function pickNodeByLocalName(responseNode, localName) {
  if (!responseNode) return null;
  const normalized = localName.toLowerCase();
  const queue = [responseNode];
  while (queue.length > 0) {
    const current = queue.shift();
    if ((current.localName || '').toLowerCase() === normalized) return current;
    queue.push(...Array.from(current.children || []));
  }
  return null;
}

function decodeFileNameFromUrl(rawUrl) {
  try {
    const pathname = new URL(rawUrl).pathname;
    const parts = pathname.split('/').filter(Boolean);
    return decodeURIComponent(parts[parts.length - 1] || '');
  } catch {
    return '';
  }
}

function mapRemoteHrefToProxyUrl(resourceUrl, directoryUrl, sourceHost = '') {
  try {
    if (typeof window === 'undefined') return resourceUrl;

    const dir = new URL(directoryUrl);
    const target = new URL(resourceUrl);
    const isLocalDev = dir.hostname === 'localhost' || dir.hostname === '127.0.0.1';
    const usesNutstoreProxyPath = dir.pathname.includes('/nutstore-dav/');
    const fromConfiguredHost = Boolean(sourceHost) && target.hostname === sourceHost;
    const fromLocalOriginDavPath = target.origin === dir.origin && target.pathname.startsWith('/dav/');

    if (isLocalDev && usesNutstoreProxyPath && fromConfiguredHost) {
      return new URL(buildNutstoreProxyPath(target.pathname, target.search), dir.origin).toString();
    }

    // WebDAV servers often return href like "/dav/xxx", which loses proxy prefix after URL resolution.
    if (isLocalDev && usesNutstoreProxyPath && fromLocalOriginDavPath) {
      return new URL(buildNutstoreProxyPath(target.pathname, target.search), dir.origin).toString();
    }

    return resourceUrl;
  } catch {
    return resourceUrl;
  }
}

function parseWebDavListing(xmlText, directoryUrl, sourceHost = '') {
  if (!xmlText) return [];
  if (typeof DOMParser === 'undefined') return [];

  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) return [];

  const responses = Array.from(doc.getElementsByTagNameNS('*', 'response'));
  const records = responses.map((responseNode) => {
    const href = pickNodeText(responseNode, 'href');
    if (!href) return null;

    let rawResourceUrl = '';
    try {
      rawResourceUrl = new URL(href, directoryUrl).toString();
    } catch {
      return null;
    }

    const url = mapRemoteHrefToProxyUrl(rawResourceUrl, directoryUrl, sourceHost);

    if (url === directoryUrl) return null;
    const fileName = decodeFileNameFromUrl(url);
    if (!fileName.startsWith(BACKUP_FILE_PREFIX) || !fileName.endsWith('.json')) return null;

    const resourceTypeNode = pickNodeByLocalName(responseNode, 'resourcetype');
    if (isCollectionNode(resourceTypeNode)) return null;

    const contentLengthRaw = pickNodeText(responseNode, 'getcontentlength');
    const modifiedRaw = pickNodeText(responseNode, 'getlastmodified');
    const modifiedAt = toIsoFromMaybeDate(modifiedRaw);
    const size = Number.parseInt(contentLengthRaw, 10);

    return {
      id: url,
      name: fileName,
      url,
      modifiedAt,
      size: Number.isFinite(size) && size >= 0 ? size : 0,
    };
  }).filter(Boolean);

  return records.sort((left, right) => {
    const leftTs = Date.parse(left.modifiedAt || '') || 0;
    const rightTs = Date.parse(right.modifiedAt || '') || 0;
    if (rightTs !== leftTs) return rightTs - leftTs;
    return right.name.localeCompare(left.name);
  });
}

async function safeReadText(response) {
  try {
    return await response.text();
  } catch {
    return '';
  }
}

async function throwIfRequestFailed(response, actionLabel) {
  if (response.ok) return;
  if (response.status === 401) {
    throw new Error(
      `${actionLabel}失败（HTTP 401）。请检查用户名/密码是否正确，并确认 WebDAV 地址可访问。`,
    );
  }
  const details = (await safeReadText(response)).slice(0, 180).trim();
  const suffix = details ? `，详情：${details}` : '';
  throw new Error(`${actionLabel}失败（HTTP ${response.status}）${suffix}`);
}

function buildBackupFilename(timestampIso) {
  const safeTimestamp = timestampIso.replace(/:/g, '-');
  return `${BACKUP_FILE_PREFIX}${safeTimestamp}.json`;
}

function formatError(error, fallback) {
  if (error instanceof TypeError) {
    const message = typeof error.message === 'string' ? error.message.toLowerCase() : '';
    if (message.includes('fetch') || message.includes('network') || message.includes('load failed')) {
      return '浏览器拦截了 WebDAV 跨域请求。请在本地开发环境使用 /nutstore-dav 代理，或在生产环境使用服务端中转。';
    }
  }

  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string' && error.message.trim()) {
    return error.message.trim();
  }
  return fallback;
}

function isLocalDevelopment() {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1';
}

function resolveViteBasePrefix() {
  const rawBase = (typeof import.meta !== 'undefined' && import.meta?.env?.BASE_URL) || '/';
  const normalizedBase = String(rawBase).trim() || '/';
  let withLeadingSlash = normalizedBase.startsWith('/') ? normalizedBase : `/${normalizedBase}`;
  if (!withLeadingSlash.endsWith('/')) withLeadingSlash += '/';
  return withLeadingSlash;
}

function buildNutstoreProxyPath(pathname = '', search = '') {
  const basePrefix = resolveViteBasePrefix();
  const proxyPrefix = basePrefix === '/' ? '/nutstore-dav' : `${basePrefix.replace(/\/$/, '')}/nutstore-dav`;
  return `${proxyPrefix}${pathname}${search}`;
}

function resolveBaseUrlForRuntime(baseUrl) {
  if (typeof window === 'undefined') return ensureTrailingSlash(baseUrl);

  const currentOrigin = window.location.origin;
  const parsed = new URL(baseUrl, currentOrigin);

  if (!isLocalDevelopment()) return ensureTrailingSlash(parsed.toString());

  const isCrossOrigin = parsed.origin !== currentOrigin;
  if (isCrossOrigin) {
    return ensureTrailingSlash(`${currentOrigin}${buildNutstoreProxyPath(parsed.pathname, parsed.search)}`);
  }

  return ensureTrailingSlash(parsed.toString());
}

async function ensureRemoteDirectory(baseUrl, backupDir, headers) {
  const segments = backupDir.split('/').map((item) => item.trim()).filter(Boolean);
  let currentUrl = baseUrl;
  for (const segment of segments) {
    currentUrl = new URL(`${encodeURIComponent(segment)}/`, currentUrl).toString();
    const response = await fetch(currentUrl, {
      method: 'MKCOL',
      headers,
    });
    if ([200, 201, 204, 301, 302, 405].includes(response.status)) continue;
    await throwIfRequestFailed(response, `创建目录 ${segment}`);
  }
  return currentUrl;
}

async function listBackups(directoryUrl, headers, sourceHost = '') {
  const response = await fetch(directoryUrl, {
    method: 'PROPFIND',
    headers: {
      ...headers,
      Depth: '1',
      'Content-Type': 'application/xml; charset=utf-8',
    },
    body: `<?xml version="1.0" encoding="utf-8"?>
<d:propfind xmlns:d="DAV:">
  <d:prop>
    <d:resourcetype />
    <d:getlastmodified />
    <d:getcontentlength />
  </d:prop>
</d:propfind>`,
  });

  await throwIfRequestFailed(response, '获取备份列表');
  const xml = await safeReadText(response);
  return parseWebDavListing(xml, directoryUrl, sourceHost);
}

function createAiStoreSnapshot(ctx) {
  return {
    sessions: ctx.deepClone(ctx.aiSessions.value),
    activeSessionId: ctx.activeAiSessionId.value,
    endpoints: ctx.deepClone(ctx.aiEndpoints.value),
    activeEndpointId: ctx.activeAiEndpointId.value,
    systemPrompts: ctx.deepClone(ctx.aiSystemPrompts.value),
    activeSystemPromptId: ctx.activeAiSystemPromptId.value,
    contextMode: ctx.aiContextMode.value,
    thinkingMode: ctx.aiThinkingMode.value,
    autoSnapshotNamingEnabled: Boolean(ctx.autoSnapshotNamingEnabled?.value),
    autoSnapshotNamingEndpointId: ctx.autoSnapshotNamingEndpointId?.value || '',
    autoSnapshotNamingSystemPromptId: ctx.autoSnapshotNamingSystemPromptId?.value || '',
    autoSnapshotNamingThinkingMode: ctx.autoSnapshotNamingThinkingMode?.value || 'off',
  };
}

function buildBackupPayload(ctx, trigger) {
  const createdAt = ctx.nowIso();
  const appState = {
    notebooks: ctx.deepClone(ctx.notebooks.value),
    activeNotebookId: ctx.activeNotebookId.value,
    recycleBinItems: ctx.deepClone(ctx.recycleBinItems.value),
    enterCreatesEquationLine: Boolean(ctx.enterCreatesEquationLine.value),
  };

  if (ctx.includeAiOnExport?.value) {
    appState.aiStore = createAiStoreSnapshot(ctx);
  }

  return {
    schema: BACKUP_SCHEMA,
    createdAt,
    trigger,
    appState,
  };
}

function parseBackupToAppState(rawPayload) {
  if (Array.isArray(rawPayload)) {
    return {
      notebooks: rawPayload,
    };
  }

  if (!rawPayload || typeof rawPayload !== 'object') return null;
  if (rawPayload.appState && typeof rawPayload.appState === 'object') return rawPayload.appState;
  return rawPayload;
}

function applyBackupToRuntime(appState, ctx) {
  const notebookSource = appState?.notebooks;
  const migratedNotebooks = Array.isArray(notebookSource) ? ctx.migrateNotebooksToV3(notebookSource) : [];
  const nextNotebooks = migratedNotebooks.length > 0 ? migratedNotebooks : [ctx.createNotebook('默认草稿本')];
  ctx.notebooks.value = nextNotebooks;
  ctx.recycleBinItems.value = ctx.sanitizeRecycleBinArray(appState?.recycleBinItems || []);
  ctx.enterCreatesEquationLine.value = typeof appState?.enterCreatesEquationLine === 'boolean'
    ? appState.enterCreatesEquationLine
    : true;

  if (ctx.includeAiOnImport?.value && appState?.aiStore) {
    const aiStore = ctx.normalizeAiStore(appState.aiStore);
    ctx.aiSessions.value = aiStore.sessions;
    ctx.activeAiSessionId.value = aiStore.activeSessionId;
    ctx.aiEndpoints.value = aiStore.endpoints;
    ctx.activeAiEndpointId.value = aiStore.activeEndpointId;
    ctx.aiSystemPrompts.value = aiStore.systemPrompts;
    ctx.activeAiSystemPromptId.value = aiStore.activeSystemPromptId;
    ctx.aiContextMode.value = aiStore.contextMode;
    ctx.aiThinkingMode.value = aiStore.thinkingMode;
    if (ctx.autoSnapshotNamingEnabled) ctx.autoSnapshotNamingEnabled.value = aiStore.autoSnapshotNamingEnabled;
    if (ctx.autoSnapshotNamingEndpointId) ctx.autoSnapshotNamingEndpointId.value = aiStore.autoSnapshotNamingEndpointId;
    if (ctx.autoSnapshotNamingSystemPromptId) ctx.autoSnapshotNamingSystemPromptId.value = aiStore.autoSnapshotNamingSystemPromptId;
    if (ctx.autoSnapshotNamingThinkingMode) ctx.autoSnapshotNamingThinkingMode.value = aiStore.autoSnapshotNamingThinkingMode;
  }

  const requestedNotebookId = typeof appState?.activeNotebookId === 'string' ? appState.activeNotebookId : '';
  const fallbackNotebookId = nextNotebooks.some((item) => item.id === requestedNotebookId)
    ? requestedNotebookId
    : nextNotebooks[0].id;
  ctx.selectNotebook(fallbackNotebookId);
}

function resolveConnectionConfig(settings) {
  const inputBaseUrl = ensureTrailingSlash(settings.baseUrl);
  if (!inputBaseUrl) throw new Error('请先填写 WebDAV 地址。');
  if (!settings.username.trim()) throw new Error('请先填写坚果云用户名。');
  if (!settings.password) throw new Error('请先填写坚果云应用密码。');
  if (!/^https?:\/\//i.test(inputBaseUrl) && !inputBaseUrl.startsWith('/')) {
    throw new Error('WebDAV 地址格式不正确。');
  }

  const runtimeBaseUrl = resolveBaseUrlForRuntime(inputBaseUrl);
  let sourceHost = '';
  try {
    const fallbackOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
    sourceHost = new URL(inputBaseUrl, fallbackOrigin).hostname;
  } catch {
    sourceHost = '';
  }

  return {
    baseUrl: runtimeBaseUrl,
    sourceHost,
    backupDir: normalizeBackupDir(settings.backupDir),
    headers: {
      Authorization: `Basic ${encodeBasicAuth(settings.username, settings.password)}`,
    },
  };
}

async function pruneBackups(records, headers, settings) {
  if (settings.unlimitedBackups) return records;
  const limit = sanitizePositiveInt(settings.maxBackups, DEFAULT_MAX_BACKUPS, 1, Number.MAX_SAFE_INTEGER);
  if (records.length <= limit) return records;

  const removeTargets = records.slice(limit);
  for (const item of removeTargets) {
    const response = await fetch(item.url, {
      method: 'DELETE',
      headers,
    });
    if (response.ok || response.status === 404) continue;
    await throwIfRequestFailed(response, `删除旧备份 ${item.name}`);
  }
  return records.slice(0, limit);
}

export function createNutstoreSyncActions(ctx) {
  const {
    nutstoreSyncSettings,
    nutstoreBackupHistory,
    nutstoreIsSyncing,
    nutstoreLastError,
  } = ctx;

  function updateNutstoreSyncField(field, value) {
    const current = normalizeNutstoreSyncSettings(nutstoreSyncSettings.value);
    const next = { ...current };

    if (field === 'baseUrl') next.baseUrl = String(value ?? '');
    if (field === 'username') next.username = String(value ?? '').trim();
    if (field === 'password') next.password = String(value ?? '');
    if (field === 'backupDir') next.backupDir = normalizeBackupDir(String(value ?? ''));
    if (field === 'autoSyncEnabled') next.autoSyncEnabled = Boolean(value);
    if (field === 'autoSyncMinutes') next.autoSyncMinutes = sanitizePositiveInt(value, current.autoSyncMinutes, 1, MAX_INTERVAL_MINUTES);
    if (field === 'maxBackups') next.maxBackups = sanitizePositiveInt(value, current.maxBackups, 1, Number.MAX_SAFE_INTEGER);
    if (field === 'unlimitedBackups') next.unlimitedBackups = Boolean(value);

    nutstoreSyncSettings.value = normalizeNutstoreSyncSettings(next);
  }

  async function refreshNutstoreBackups() {
    if (nutstoreIsSyncing.value) return false;

    try {
      nutstoreLastError.value = '';
      const settings = normalizeNutstoreSyncSettings(nutstoreSyncSettings.value);
      const connection = resolveConnectionConfig(settings);
      const directoryUrl = await ensureRemoteDirectory(connection.baseUrl, connection.backupDir, connection.headers);
      const records = await listBackups(directoryUrl, connection.headers, connection.sourceHost);
      nutstoreBackupHistory.value = records;
      return true;
    } catch (error) {
      const message = formatError(error, '读取坚果云历史版本失败。');
      nutstoreLastError.value = message;
      window.alert(message);
      return false;
    }
  }

  async function syncToNutstore(trigger = 'manual') {
    if (nutstoreIsSyncing.value) return false;
    nutstoreIsSyncing.value = true;

    try {
      nutstoreLastError.value = '';
      const settings = normalizeNutstoreSyncSettings(nutstoreSyncSettings.value);
      const connection = resolveConnectionConfig(settings);
      const directoryUrl = await ensureRemoteDirectory(connection.baseUrl, connection.backupDir, connection.headers);
      const payload = buildBackupPayload(ctx, trigger);
      const filename = buildBackupFilename(payload.createdAt);
      const targetUrl = new URL(encodeURIComponent(filename), directoryUrl).toString();

      const saveResponse = await fetch(targetUrl, {
        method: 'PUT',
        headers: {
          ...connection.headers,
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify(payload, null, 2),
      });
      await throwIfRequestFailed(saveResponse, '上传备份');

      const records = await listBackups(directoryUrl, connection.headers, connection.sourceHost);
      await pruneBackups(records, connection.headers, settings);
      const finalRecords = await listBackups(directoryUrl, connection.headers, connection.sourceHost);
      nutstoreBackupHistory.value = finalRecords;

      nutstoreSyncSettings.value = normalizeNutstoreSyncSettings({
        ...settings,
        lastSyncAt: payload.createdAt,
      });
      return true;
    } catch (error) {
      const message = formatError(error, '同步到坚果云失败。');
      nutstoreLastError.value = message;
      if (trigger === 'manual') window.alert(message);
      return false;
    } finally {
      nutstoreIsSyncing.value = false;
    }
  }

  async function restoreNutstoreBackup(record) {
    if (!record || !record.url) return false;
    if (nutstoreIsSyncing.value) return false;
    if (!window.confirm(`确认恢复历史版本「${record.name}」吗？当前本地内容将被覆盖。`)) return false;

    nutstoreIsSyncing.value = true;
    try {
      nutstoreLastError.value = '';
      const settings = normalizeNutstoreSyncSettings(nutstoreSyncSettings.value);
      const connection = resolveConnectionConfig(settings);
      const fetchUrl = mapRemoteHrefToProxyUrl(record.url, connection.baseUrl, connection.sourceHost);
      const response = await fetch(fetchUrl, {
        method: 'GET',
        headers: connection.headers,
      });
      await throwIfRequestFailed(response, `下载备份 ${record.name}`);

      const raw = await safeReadText(response);
      const payload = JSON.parse(raw);
      const appState = parseBackupToAppState(payload);
      if (!appState) throw new Error('备份文件内容不可用。');

      applyBackupToRuntime(appState, ctx);
      return true;
    } catch (error) {
      const message = formatError(error, '恢复历史版本失败。');
      nutstoreLastError.value = message;
      window.alert(message);
      return false;
    } finally {
      nutstoreIsSyncing.value = false;
    }
  }

  return {
    updateNutstoreSyncField,
    refreshNutstoreBackups,
    syncToNutstore,
    restoreNutstoreBackup,
  };
}
