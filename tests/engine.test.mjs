import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { shuffle, blankProgress, createSession, evaluate, recordAnswer, finishSession, statistics, validateProgress } from '../assets/engine.js';
const { questions } = JSON.parse(await readFile(new URL('../assets/questions.json', import.meta.url), 'utf8'));
test('complete source: 100 AI + 89 Go, distinct IDs, only final question has 3 options', () => {
  assert.equal(questions.length, 189);
  assert.equal(new Set(questions.map(q => q.id)).size, 189);
  for (const [section, total] of [['ai', 100], ['go', 89]]) {
    assert.deepEqual(questions.filter(q => q.section === section).map(q => q.number), Array.from({ length: total }, (_, i) => i + 1));
  }
  for (const q of questions) {
    assert.equal(q.options.length, q.id === 'go-89' ? 3 : 4);
    assert.ok(q.options.every(o => typeof o === 'string' && o.length));
    assert.ok(q.question.endsWith('?'));
    assert.ok(q.options[q.correctIndex]);
    assert.equal(q.correctIndex, 0);
  }
  assert.match(questions.find(q => q.id === 'go-53').note, /байтов/);
});
test('shuffle preserves all items, does not mutate input and supports different answer positions', () => {
  const input = [0, 1, 2, 3];
  const result = shuffle(input, () => 0);
  assert.deepEqual(input, [0, 1, 2, 3]);
  assert.deepEqual(result, [1, 2, 3, 0]);
});
test('session filtering, full count and three-option questions', () => {
  const s = createSession(questions, { section: 'go', count: 189 });
  assert.equal(s.items.length, 89);
  assert.ok(s.items.every(item => item.id.startsWith('go-')));
  assert.deepEqual([...s.items.find(it => it.id === 'go-89').order].sort(), [0, 1, 2]);
  assert.equal(createSession([], {}), null);
});
test('grading follows original option index after shuffling; unchecked practice choices are skipped', () => {
  const s = createSession(questions.slice(0, 3), { count: 3 });
  const [a, b, c] = s.items;
  s.answers = { [a.id]: 0, [b.id]: 1, [c.id]: 0 };
  s.checked = [a.id, b.id];
  assert.deepEqual(evaluate(s, questions), { total: 3, correct: 1, wrong: 1, skipped: 1, percent: 33 });
});
test('practice records once on check, not again on finishing or reload', () => {
  const p = blankProgress(); p.session = createSession(questions.slice(0, 1), { count: 1 });
  p.session.answers['ai-1'] = 0; p.session.checked.push('ai-1');
  recordAnswer(p, questions[0], 0, 100);
  finishSession(p, questions, 200); finishSession(p, questions, 300);
  assert.equal(p.records['ai-1'].attempts, 1); assert.equal(p.history.length, 1);
  assert.equal(validateProgress(JSON.parse(JSON.stringify(p)), questions).session.finishedAt, 200);
});
test('exam with changed answers, skips, durable deadline and idempotent completion', () => {
  const p = blankProgress(); p.session = createSession(questions.slice(0, 3), { mode: 'exam', count: 3, minutes: 10 }, 1000);
  p.session.answers['ai-1'] = 1; p.session.answers['ai-1'] = 0; p.session.answers['ai-2'] = 1;
  assert.deepEqual(p.records, {});
  const restored = validateProgress(JSON.parse(JSON.stringify(p)), questions);
  assert.equal(restored.session.deadline, 601000);
  finishSession(restored, questions, 601001); finishSession(restored, questions, 601002);
  assert.equal(restored.records['ai-1'].attempts, 1);
  assert.equal(restored.records['ai-3'], undefined);
  assert.deepEqual(evaluate(restored.session, questions), { total: 3, correct: 1, wrong: 1, skipped: 1, percent: 33 });
  assert.equal(restored.history.length, 1);
});
test('correcting a mistake updates mastered count and keeps cumulative accuracy', () => {
  const p = blankProgress(); recordAnswer(p, questions[0], 1); recordAnswer(p, questions[0], 0);
  assert.deepEqual(statistics(p, questions), { seen: 1, learned: 1, mistakes: 0, attempts: 2, accuracy: 50 });
});
test('corrupted storage cannot inject unknown questions, impossible choices, duplicate choices or bookmarks', () => {
  assert.deepEqual(validateProgress(null, questions), blankProgress());
  const p = blankProgress(); p.session = createSession(questions, { count: 10 });
  p.session.items[0].order = [0, 0, 0, 0];
  p.bookmarks = ['ai-1', 'ai-1', 'fake']; p.records = { unknown: { attempts: 1, correct: 1, lastCorrect: true } };
  const restored = validateProgress(p, questions);
  assert.equal(restored.session, null); assert.deepEqual(restored.bookmarks, ['ai-1']); assert.deepEqual(restored.records, {});
});
test('active practice resume preserves selection, displayed option order, checked status and position', () => {
  const p = blankProgress(); p.session = createSession(questions, { count: 10 });
  p.session.position = 4; const id = p.session.items[4].id;
  p.session.answers[id] = 2; p.session.checked.push(id);
  const restored = validateProgress(JSON.parse(JSON.stringify(p)), questions);
  assert.deepEqual(restored.session, p.session);
});
