const ENCRYPTED_PREFIX = 'enc:v1:';
const DB_NAME = 'math-scratch.secure-storage.v1';
const STORE_NAME = 'keys';
const KEY_ID = 'local-secrets';
const AES_IV_BYTES = 12;

let cachedKeyPromise = null;

function canUseWebCrypto() {
  return typeof crypto !== 'undefined'
    && typeof crypto.subtle !== 'undefined'
    && typeof crypto.getRandomValues === 'function';
}

function canUseIndexedDb() {
  return typeof indexedDB !== 'undefined';
}

function bytesToBase64(bytes) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function base64ToBytes(base64Text) {
  const binary = atob(base64Text);
  const output = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    output[i] = binary.charCodeAt(i);
  }
  return output;
}

function openKeyDb() {
  if (!canUseIndexedDb()) return Promise.resolve(null);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB.'));
  });
}

async function readStoredCryptoKey() {
  const db = await openKeyDb();
  if (!db) return null;

  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(KEY_ID);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error || new Error('Failed to read key.'));
    });
  } finally {
    db.close();
  }
}

async function writeStoredCryptoKey(key) {
  const db = await openKeyDb();
  if (!db) return false;

  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(key, KEY_ID);

      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error || new Error('Failed to write key.'));
    });
  } finally {
    db.close();
  }
}

async function getOrCreateCryptoKey() {
  if (!canUseWebCrypto() || !canUseIndexedDb()) return null;
  if (cachedKeyPromise) return cachedKeyPromise;

  cachedKeyPromise = (async () => {
    try {
      const existingKey = await readStoredCryptoKey();
      if (existingKey) return existingKey;

      const generatedKey = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt'],
      );

      const persisted = await writeStoredCryptoKey(generatedKey);
      if (!persisted) return null;
      return generatedKey;
    } catch {
      return null;
    }
  })();

  return cachedKeyPromise;
}

function isEncryptedText(value) {
  return typeof value === 'string' && value.startsWith(ENCRYPTED_PREFIX);
}

async function encryptText(text) {
  const key = await getOrCreateCryptoKey();
  if (!key || !text) return text;

  const iv = crypto.getRandomValues(new Uint8Array(AES_IV_BYTES));
  const encodedText = new TextEncoder().encode(text);
  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encodedText,
  );

  const encryptedBytes = new Uint8Array(encryptedBuffer);
  return `${ENCRYPTED_PREFIX}${bytesToBase64(iv)}:${bytesToBase64(encryptedBytes)}`;
}

async function decryptText(text) {
  const key = await getOrCreateCryptoKey();
  if (!key) return '';
  if (!isEncryptedText(text)) return text;

  const payload = text.slice(ENCRYPTED_PREFIX.length);
  const splitIndex = payload.indexOf(':');
  if (splitIndex < 0) return '';

  const ivText = payload.slice(0, splitIndex);
  const encryptedText = payload.slice(splitIndex + 1);
  if (!ivText || !encryptedText) return '';

  const iv = base64ToBytes(ivText);
  const encryptedBytes = base64ToBytes(encryptedText);
  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    encryptedBytes,
  );

  return new TextDecoder().decode(decryptedBuffer);
}

export async function encryptSecretForStorage(value) {
  const text = typeof value === 'string' ? value : '';
  if (!text) return '';
  if (isEncryptedText(text)) return text;

  try {
    return await encryptText(text);
  } catch {
    return text;
  }
}

export async function decryptSecretFromStorage(value) {
  const text = typeof value === 'string' ? value : '';
  if (!text) return '';
  if (!isEncryptedText(text)) return text;

  try {
    return await decryptText(text);
  } catch {
    return '';
  }
}

export async function encryptAiStoreSecretsForStorage(rawStore) {
  const source = rawStore && typeof rawStore === 'object' ? rawStore : {};
  const endpoints = Array.isArray(source.endpoints) ? source.endpoints : [];

  const encryptedEndpoints = await Promise.all(
    endpoints.map(async (item) => {
      if (!item || typeof item !== 'object') return item;
      const apiKey = await encryptSecretForStorage(typeof item.apiKey === 'string' ? item.apiKey : '');
      return { ...item, apiKey };
    }),
  );

  return {
    ...source,
    endpoints: encryptedEndpoints,
  };
}

export async function decryptAiStoreSecretsFromStorage(rawStore) {
  const source = rawStore && typeof rawStore === 'object' ? rawStore : {};
  const endpoints = Array.isArray(source.endpoints) ? source.endpoints : [];

  const decryptedEndpoints = await Promise.all(
    endpoints.map(async (item) => {
      if (!item || typeof item !== 'object') return item;
      const apiKey = await decryptSecretFromStorage(typeof item.apiKey === 'string' ? item.apiKey : '');
      return { ...item, apiKey };
    }),
  );

  return {
    ...source,
    endpoints: decryptedEndpoints,
  };
}

export async function encryptNutstoreSettingsSecretsForStorage(rawSettings) {
  const source = rawSettings && typeof rawSettings === 'object' ? rawSettings : {};
  const password = await encryptSecretForStorage(typeof source.password === 'string' ? source.password : '');
  return {
    ...source,
    password,
  };
}

export async function decryptNutstoreSettingsSecretsFromStorage(rawSettings) {
  const source = rawSettings && typeof rawSettings === 'object' ? rawSettings : {};
  const password = await decryptSecretFromStorage(typeof source.password === 'string' ? source.password : '');
  return {
    ...source,
    password,
  };
}
