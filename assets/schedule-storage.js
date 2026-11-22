import { validateSchedule, validatePublicSchedule } from './schedule-model.js';

const contentsUrl = 'https://api.github.com/repos/DemiNeko/NiuTest/contents/src/december-schedule.json';
const branch = 'main';
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });
const maxFile = 900_000;
const maxPlan = 320_000;
const maxToken = 2048;
const shaPattern = /^(?:[a-f\d]{40}|[a-f\d]{64})$/;

function error(code, status) {
  const result = new Error('Schedule storage: ' + code);
  result.code = code;
  if (status !== undefined) result.status = status;
  return result;
}

function exactFields(obj, fields) {
  return obj && typeof obj === 'object' && !Array.isArray(obj) &&
    Object.keys(obj).length === fields.length && fields.every(field => Object.hasOwn(obj, field));
}

function toBase64(bytes) {
  let text = '';
  for (let start = 0; start < bytes.length; start += 8192) {
    text += String.fromCharCode(...bytes.subarray(start, start + 8192));
  }
  return btoa(text);
}

function fromBase64(text, maxBytes) {
  if (typeof text !== 'string' || !text.length || text.length > Math.ceil(maxBytes / 3) * 4 ||
      text.length % 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(text)) throw error('invalid');
  let decoded;
  try { decoded = atob(text); } catch { throw error('invalid'); }
  if (decoded.length > maxBytes) throw error('invalid');
  return Uint8Array.from(decoded, char => char.charCodeAt(0));
}

function parseVault(vault, limit) {
  if (!exactFields(vault, ['version', 'salt', 'iv', 'ciphertext']) || vault.version !== 1) throw error('invalid');
  const salt = fromBase64(vault.salt, 16);
  const iv = fromBase64(vault.iv, 12);
  const ciphertext = fromBase64(vault.ciphertext, limit + 16);
  if (salt.length !== 16 || iv.length !== 12 || ciphertext.length <= 16) throw error('invalid');
  return { salt, iv, ciphertext };
}

function checkedToken(token) {
  if (typeof token !== 'string' || !token || token.length > maxToken || !/^[\x21-\x7e]+$/.test(token)) {
    throw error('auth');
  }
  return token;
}

function cryptoApi() {
  if (!globalThis.crypto?.subtle) throw error('crypto');
  return globalThis.crypto;
}

async function derive(password, salt, usage) {
  if (typeof password !== 'string' || !password.length || password.length > 1024) throw error('password');
  const { subtle } = cryptoApi();
  const material = await subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey']);
  return subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 600_000 }, material,
    { name: 'AES-GCM', length: 256 }, false, [usage]);
}

function algorithm(iv, purpose) {
  return { name: 'AES-GCM', iv, additionalData: encoder.encode('NiuTest/december-schedule/v1/' + purpose), tagLength: 128 };
}

async function seal(text, password, purpose, limit) {
  const data = encoder.encode(text);
  if (data.byteLength > limit) throw error('invalid');
  const api = cryptoApi();
  const salt = api.getRandomValues(new Uint8Array(16));
  const iv = api.getRandomValues(new Uint8Array(12));
  const key = await derive(password, salt, 'encrypt');
  const encrypted = await api.subtle.encrypt(algorithm(iv, purpose), key, data);
  return { version: 1, salt: toBase64(salt), iv: toBase64(iv), ciphertext: toBase64(new Uint8Array(encrypted)) };
}

async function open(vault, password, purpose, limit) {
  const { salt, iv, ciphertext } = parseVault(vault, limit);
  const key = await derive(password, salt, 'decrypt');
  let bytes;
  try { bytes = await cryptoApi().subtle.decrypt(algorithm(iv, purpose), key, ciphertext); }
  catch { throw error('password'); }
  try { return decoder.decode(bytes); }
  catch { throw error('invalid'); }
}

export async function sealPlan(plan, password) {
  let clean;
  try { clean = validateSchedule(plan); } catch { throw error('invalid'); }
  return seal(JSON.stringify(clean), password, 'plan', maxPlan);
}

export async function openPlan(vault, password) {
  const text = await open(vault, password, 'plan', maxPlan);
  try { return validateSchedule(JSON.parse(text)); } catch { throw error('invalid'); }
}

export async function sealCredential(token, password) {
  return seal(checkedToken(token), password, 'device-credential', maxToken);
}

export async function openCredential(vault, password) {
  return checkedToken(await open(vault, password, 'device-credential', maxToken));
}

export function checkedRecord(record) {
  if (!exactFields(record, ['version', 'public', 'vault']) || record.version !== 1) throw error('invalid');
  let projection;
  try { projection = validatePublicSchedule(record.public); } catch { throw error('invalid'); }
  if (record.vault !== null) parseVault(record.vault, maxPlan);
  else if (projection.visible || projection.exams.length) throw error('invalid');
  return { version: 1, public: projection, vault: record.vault };
}

async function request(method, token, body) {
  const headers = { Accept: 'application/vnd.github+json' };
  if (token) headers.Authorization = 'Bearer ' + checkedToken(token);
  if (body) headers['Content-Type'] = 'application/json';
  const url = method === 'GET' ? contentsUrl + '?ref=' + branch : contentsUrl;
  let response;
  try {
    response = await fetch(url, {
      method, headers, body, cache: 'no-store', credentials: 'omit', redirect: 'error',
      signal: AbortSignal.timeout(25_000)
    });
  } catch { throw error('unavailable'); }
  if (!response.ok) {
    const status = response.status;
    if (status === 403 && response.headers.get('x-ratelimit-remaining') === '0') throw error('unavailable', status);
    if (status === 401 || status === 403) throw error('auth', status);
    if (method === 'PUT' && (status === 409 || status === 422)) throw error('conflict', status);
    throw error('unavailable', status);
  }
  let text;
  try { text = await response.text(); } catch { throw error('unavailable'); }
  if (text.length > maxFile * 2) throw error('invalid');
  try { return JSON.parse(text); } catch { throw error('invalid'); }
}

export async function readRemote(token) {
  const entry = await request('GET', token);
  if (!entry || typeof entry.sha !== 'string' || !shaPattern.test(entry.sha) || entry.encoding !== 'base64' ||
      typeof entry.content !== 'string' || entry.content.length > maxFile * 2) throw error('invalid');
  const bytes = fromBase64(entry.content.replace(/[\r\n]/g, ''), maxFile);
  let record;
  try { record = JSON.parse(decoder.decode(bytes)); } catch { throw error('invalid'); }
  return { sha: entry.sha, record: checkedRecord(record) };
}

export async function writeRemote(token, sha, record) {
  checkedToken(token);
  if (typeof sha !== 'string' || !shaPattern.test(sha)) throw error('invalid');
  const clean = checkedRecord(record);
  if (!clean.vault) throw error('invalid');
  const bytes = encoder.encode(JSON.stringify(clean) + '\n');
  if (bytes.byteLength > maxFile) throw error('invalid');
  const result = await request('PUT', token, JSON.stringify({
    branch, sha, message: 'Update December exam schedule', content: toBase64(bytes)
  }));
  if (typeof result?.content?.sha !== 'string' || !shaPattern.test(result.content.sha)) throw error('invalid');
  return { sha: result.content.sha, record: clean };
}
