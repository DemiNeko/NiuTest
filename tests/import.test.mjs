import test from 'node:test';
import assert from 'node:assert/strict';
import { parseExam, isGradable, MAX_FILE_BYTES } from '../assets/exam-format.js';
import { blankProgress, createSession, selectAnswer, finishSession, validateProgress } from '../assets/engine.js';
import { LIBRARY_KEY, progressKey, readCatalog, reconcileProgress, parseBackup, commitStorage, recoverStorage, loadExamProgress, snapshotProgress } from '../assets/library-store.js';
import { readFile } from 'node:fs/promises';
import { prompts } from '../assets/prompts.js';
import { validateSiteConfig } from '../assets/site-config.js';
import { catalogFiles, zipFiles, crc32 } from '../assets/catalog-export.js';
import { validateCatalog } from '../scripts/catalog.mjs';
const example = () => ({ schemaVersion: 1, id: 'biology', title: 'Биология', sections: { cells: 'Клетки' }, questions: [
  { id: 'q-1', section: 'cells', question: 'Первый вопрос?', options: ['Нет', 'Да', 'Возможно'], correctIndex: 1 },
  { id: 'q-2', section: 'cells', question: 'Без ключа?', options: ['Один', 'Два'], correctIndex: null },
] });
const parsed = () => parseExam(example()).exam;
test('canonical, BOM, JSON fences, Cyrillic and unknown keys round trip', () => {
  const { exam } = parseExam('\uFEFF```json\n' + JSON.stringify(example()) + '\n```');
  assert.equal(exam.title, 'Биология'); assert.equal(exam.questions[1].answerStatus, 'needs-review');
  assert.deepEqual(parseExam(JSON.stringify(exam)).exam, exam);
});
test('FQuiz preserves original index of the sole isCorrect option; no guessed A', () => {
  const { exam, errors } = parseExam([{ question: '2 + 2?', options: [{ text: '5', isCorrect: false }, { text: '4', isCorrect: true }] }], { id: 'math', title: 'Математика' });
  assert.deepEqual(errors, []); assert.equal(exam.questions[0].correctIndex, 1);
  assert.equal(exam.questions[0].section, 'general');
});
test('rejects malformed, truncated, too large, empty and duplicate-ID imports', () => {
  for (const input of ['{"questions":', '{}', '[]', 'x'.repeat(MAX_FILE_BYTES + 1)]) assert.equal(parseExam(input).exam, null);
  const e = example(); e.questions[1].id = 'q-1'; assert.match(parseExam(e).errors.join(' '), /повторяющийся/);
});
test('rejects out-of-range keys, duplicates, mixed options, unsafe URLs and unsupported schema', () => {
  const cases = [e => e.questions[0].correctIndex = 3, e => e.questions[0].correctIndex = '1', e => e.questions[0].options = [' A ', 'a'], e => e.questions[0].options[1] = {}, e => e.questions[0].sourceUrl = 'javascript:alert(1)', e => e.schemaVersion = 2, e => e.questions[0].answerStatus = 'verified'];
  for (const mutate of cases) { const e = example(); mutate(e); assert.equal(parseExam(e).exam, null); }
});
test('prototype keys and catalog filename index are rejected before persistence', () => {
  for (const id of ['__proto__', 'constructor', 'prototype', 'toString', '../secret', 'index']) { const e = example(); e.id = id; assert.equal(parseExam(e).exam, null); }
});
test('multiple FQuiz correct flags or conflicting correctIndex fail; no flags remain ungraded', () => {
  const q = { question: 'Q?', options: [{ text: 'A', isCorrect: true }, { text: 'B', isCorrect: true }] };
  assert.equal(parseExam([q], { id: 'exam', title: 'Exam' }).exam, null);
  q.options[1].isCorrect = false; q.correctIndex = 1;
  assert.equal(parseExam([q], { id: 'exam', title: 'Exam' }).exam, null);
  delete q.correctIndex; q.options[0].isCorrect = false;
  assert.equal(isGradable(parseExam([q], { id: 'exam', title: 'Exam' }).exam.questions[0]), false);
});
test('unknown and needs-review keys are excluded from all graded sessions', () => {
  const e = parsed(); const p = blankProgress(); p.session = createSession(e.questions, { count: 'all' });
  assert.equal(p.session.items.length, 1); assert.equal(selectAnswer(p, e.questions[1], 0), false);
  e.questions[0].answerStatus = 'needs-review'; assert.equal(createSession(e.questions, { count: 'all' }), null);
});
test('classic mode has all gradable questions, instant checking, shuffled-index integrity and double-click guard', () => {
  const e = parsed(), p = blankProgress(); p.session = createSession(e.questions, { count: 'all', classic: true, randomOrder: false });
  assert.ok(p.session.classic); assert.equal(p.session.items.length, 1);
  assert.ok(selectAnswer(p, e.questions[0], 1)); assert.equal(p.records['q-1'].lastCorrect, true);
  assert.equal(selectAnswer(p, e.questions[0], 0), false); assert.equal(p.records['q-1'].attempts, 1);
  const restored = validateProgress(JSON.parse(JSON.stringify(p)), e.questions);
  assert.equal(restored.session.answers['q-1'], 1); assert.deepEqual(restored.session.items, p.session.items);
  finishSession(restored, e.questions); assert.equal(restored.records['q-1'].attempts, 1);
});
test('arbitrary sections resume and question order can be retained', () => {
  const e = parsed(), p = blankProgress(); p.session = createSession(e.questions, { section: 'cells', count: 'all', randomOrder: false, randomOptions: false });
  assert.deepEqual(p.session.items[0].order, [0, 1, 2]);
  assert.deepEqual(validateProgress(p, e.questions).session, p.session);
});
test('timed mode allows changing answers, with no results until finish, and rejects expired input', () => {
  const e = parsed(), p = blankProgress(); p.session = createSession(e.questions, { mode: 'exam', count: 'all', minutes: 1 }, 100);
  selectAnswer(p, e.questions[0], 0, 200); selectAnswer(p, e.questions[0], 1, 300);
  assert.deepEqual(p.records, {}); assert.equal(selectAnswer(p, e.questions[0], 0, 60101), false);
  finishSession(p, e.questions, 60101); assert.equal(p.history[0].percent, 100);
});
test('updates keep unchanged answers, discard changed answers, history, cards and active attempt', () => {
  const previous = parsed(), p = blankProgress(); p.session = createSession(previous.questions, { count: 'all' });
  selectAnswer(p, previous.questions[0], 1); p.bookmarks = ['q-1']; p.cards = { ids: ['q-1'], position: 0, revealed: true, again: [] };
  assert.equal(reconcileProgress(p, previous, parsed()).records['q-1'].attempts, 1);
  const next = parsed(); next.questions[0].correctIndex = 0;
  const result = reconcileProgress(p, previous, next);
  assert.deepEqual(result.records, {}); assert.equal(result.session, null); assert.equal(result.cards, undefined); assert.deepEqual(result.bookmarks, ['q-1']);
});
test('backups isolate same question IDs by exam and validate before restore', () => {
  const a = parsed(), b = parsed(); b.id = 'physics'; b.title = 'Физика';
  const p = blankProgress(); p.session = createSession(a.questions); selectAnswer(p, a.questions[0], 1);
  const restored = parseBackup({ type: 'niutest-backup', version: 1, exams: [a, b], progress: { biology: p } });
  assert.equal(restored.progress.biology.records['q-1'].attempts, 1); assert.deepEqual(restored.progress.physics.records, {});
  assert.throws(() => parseBackup({ type: 'niutest-backup', version: 1, exams: [a, a] }));
  assert.throws(() => parseBackup({ type: 'niutest-backup', version: 1, exams: [a] }, [a]));
  assert.throws(() => readCatalog({ version: 2, exams: [{ id: 'broken' }] }));
});
class MemoryStorage {
  data = new Map(); failKey = null;
  getItem(k) { return this.data.get(k) ?? null; }
  removeItem(k) { this.data.delete(k); }
  setItem(k, v) { if (this.failKey === k) { this.failKey = null; throw new Error('QuotaExceededError'); } this.data.set(k, v); }
}
test('a failed library write rolls back previous writes; retry succeeds', () => {
  const storage = new MemoryStorage(), key = progressKey('biology'); storage.setItem(LIBRARY_KEY, 'old library'); storage.setItem(key, 'old progress');
  storage.failKey = LIBRARY_KEY;
  assert.throws(() => commitStorage(storage, [[key, 'new progress'], [LIBRARY_KEY, 'new library']]));
  assert.equal(storage.getItem(key), 'old progress'); assert.equal(storage.getItem(LIBRARY_KEY), 'old library');
  commitStorage(storage, [[key, 'new progress'], [LIBRARY_KEY, 'new library']]); assert.equal(storage.getItem(key), 'new progress');
});
test('interrupted transaction is recovered on startup; journal cannot target unrelated browser keys', () => {
  const storage = new MemoryStorage(), key = progressKey('biology'); storage.setItem(key, 'partial write'); storage.setItem('niutest-pending-write-v1', JSON.stringify([[key, 'before']]));
  recoverStorage(storage); assert.equal(storage.getItem(key), 'before');
  storage.setItem('niutest-pending-write-v1', JSON.stringify([['unrelated-service', null]])); assert.throws(() => recoverStorage(storage));
});
test('site settings validate text, image protocols, relative src paths and opacity', () => {
  const config = validateSiteConfig({ version: 1, name: 'Мой сайт', logo: './src/images/logo.svg', background: './src/images/background.svg', showTopbarText: false, backgroundOpacity: 40 });
  assert.equal(config.name, 'Мой сайт'); assert.equal(config.showTopbarText, false);
  for (const value of [{ name: '' }, { logo: 'javascript:alert(1)' }, { background: './src/images/../../secret.png' }, { backgroundOpacity: 101 }, { showTopbarText: 'no' }]) assert.throws(() => validateSiteConfig({ version: 1, ...value }));
});
test('site catalog export contains only portable exam files, no learner data, and a valid ZIP structure', () => {
  const files = catalogFiles([parsed()]);
  assert.deepEqual(files.map(f => f.name), ['src/exams/index.json', 'src/exams/biology.json']);
  assert.equal(JSON.parse(files[1].content).title, 'Биология'); assert.ok(!files[1].content.includes('bookmarks'));
  const zip = zipFiles(files), v = new DataView(zip.buffer); assert.equal(v.getUint32(0, true), 0x04034b50); assert.equal(v.getUint32(zip.length - 22, true), 0x06054b50);
  assert.equal(v.getUint16(zip.length - 14, true), 2); assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
});
test('published catalog loads all source questions and notes', async () => {
  const { exams } = await validateCatalog(); const original = exams.find(e => e.id === 'ai-go');
  assert.equal(original.questions.length, 189); assert.equal(original.questions[0].answerStatus, 'inferred');
  assert.match(original.questions.find(q => q.id === 'go-53').note, /байтов/);
});
test('a published key change invalidates stale progress on reload and backup restore', () => {
  const exam = parsed(), p = blankProgress(); p.session = createSession(exam.questions); selectAnswer(p, exam.questions[0], 1);
  const raw = snapshotProgress(p, exam), next = parsed(); next.questions[0].correctIndex = 2;
  assert.equal(loadExamProgress(raw, exam).records['q-1'].lastCorrect, true);
  assert.deepEqual(loadExamProgress(raw, next).records, {}); assert.equal(loadExamProgress(raw, next).session, null);
  const restored = parseBackup({ type: 'niutest-backup', version: 1, exams: [], progress: { biology: raw } }, [next]);
  assert.deepEqual(restored.progress.biology.records, {});
});
test('downloadable model prompts exactly match documented text files', async () => {
  for (const prompt of prompts) assert.equal(await readFile(new URL(`../docs/prompts/${prompt.id}.txt`, import.meta.url), 'utf8'), prompt.text + '\n');
});
