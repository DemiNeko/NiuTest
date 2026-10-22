import { blankProgress, validateProgress } from './engine.js';
import { parseExam, questionSignature } from './exam-format.js';
export const LIBRARY_KEY = 'niutest-library-v2';
export const progressKey = id => `niutest-progress-v2:${id}`;
const fingerprintsCache = new WeakMap();
function fingerprints(exam) {
  if (!fingerprintsCache.has(exam)) fingerprintsCache.set(exam, Object.fromEntries(exam.questions.map(q => {
    const value = questionSignature(q); let a = 2166136261, b = 5381;
    for (let i = 0; i < value.length; i++) { const c = value.charCodeAt(i); a = Math.imul(a ^ c, 16777619); b = Math.imul(b, 33) ^ c; }
    return [q.id, `${value.length}:${a >>> 0}:${b >>> 0}`];
  })));
  return fingerprintsCache.get(exam);
}
export function snapshotProgress(progress, exam) { return { ...progress, fingerprints: fingerprints(exam) }; }
export function loadExamProgress(raw, exam) {
  const clean = validateProgress(raw, exam.questions), next = fingerprints(exam);
  if (raw?.fingerprints && typeof raw.fingerprints === 'object') {
    const same = new Set(Object.keys(next).filter(id => next[id] === raw.fingerprints[id]));
    clean.records = Object.fromEntries(Object.entries(clean.records).filter(([id]) => same.has(id)));
    if (same.size !== exam.questions.length || Object.keys(raw.fingerprints).length !== exam.questions.length) { clean.session = null; clean.history = []; delete clean.cards; }
  }
  return clean;
}
export function readCatalog(raw) {
  if (!raw || raw.version !== 2 || !Array.isArray(raw.exams)) throw new Error('Неверный формат библиотеки.');
  const exams = raw.exams.map(item => {
    const result = parseExam(item);
    if (!result.exam) throw new Error(result.errors.join('\n'));
    return result.exam;
  });
  if (new Set(exams.map(e => e.id)).size !== exams.length) throw new Error('В библиотеке повторяются id экзаменов.');
  return { version: 2, exams };
}
export function reconcileProgress(raw, previous, next) {
  const clean = validateProgress(raw, next.questions);
  if (!previous) return clean;
  const before = new Map(previous.questions.map(q => [q.id, questionSignature(q)]));
  const unchanged = new Set(next.questions.filter(q => before.get(q.id) === questionSignature(q)).map(q => q.id));
  clean.records = Object.fromEntries(Object.entries(clean.records).filter(([id]) => unchanged.has(id)));
  // Any changed answer invalidates the old score and in-flight attempt, not unrelated records.
  if (next.questions.length !== previous.questions.length || unchanged.size !== next.questions.length) { clean.history = []; clean.session = null; delete clean.cards; }
  return clean;
}
export function parseBackup(input, bundled = []) {
  const raw = typeof input === 'string' ? JSON.parse(input.replace(/^\uFEFF/, '')) : input;
  if (raw?.type !== 'niutest-backup' || raw.version !== 1 || !Array.isArray(raw.exams)) throw new Error('Это не резервная копия NiuTest версии 1.');
  const { exams } = readCatalog({ version: 2, exams: raw.exams });
  if (exams.some(e => bundled.some(b => b.id === e.id))) throw new Error('Копия содержит пользовательский экзамен с id встроенного.');
  const progress = {};
  for (const exam of [...bundled, ...exams]) progress[exam.id] = loadExamProgress(raw.progress?.[exam.id], exam);
  return { exams, progress };
}
// localStorage has no transaction API. Keep a journal so interrupted multi-key writes roll back on reload.
const JOURNAL_KEY = 'niutest-pending-write-v1';
export function recoverStorage(storage) {
  const journal = storage.getItem(JOURNAL_KEY);
  if (!journal) return;
  const entries = JSON.parse(journal);
  if (!Array.isArray(entries) || entries.some(x => !Array.isArray(x) || !(x[0] === LIBRARY_KEY || x[0].startsWith('niutest-progress-v2:')) || !(x[1] === null || typeof x[1] === 'string'))) throw new Error('Не удалось восстановить незавершённое сохранение. Экспортируйте данные браузера.');
  for (const [key, value] of entries) value === null ? storage.removeItem(key) : storage.setItem(key, value);
  storage.removeItem(JOURNAL_KEY);
}
export function commitStorage(storage, entries) {
  recoverStorage(storage);
  const before = entries.map(([key]) => [key, storage.getItem(key)]);
  storage.setItem(JOURNAL_KEY, JSON.stringify(before));
  try {
    for (const [key, value] of entries) value === null ? storage.removeItem(key) : storage.setItem(key, value);
    storage.removeItem(JOURNAL_KEY);
  } catch (error) {
    try { recoverStorage(storage); } catch { /* Journal retained for recovery on reload. */ }
    throw error;
  }
}
export function emptyProgress() { return blankProgress(); }
