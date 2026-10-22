import { isGradable } from './exam-format.js';
export const STORAGE_KEY = 'qadam-progress-v1';
export const sections = { ai: 'Основы AI', go: 'Go и AI' };
export function shuffle(items, random = Math.random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
export function blankProgress() {
  return { version: 1, records: {}, bookmarks: [], history: [], session: null };
}
export function createSession(questions, { mode = 'practice', count = 20, section = 'all', minutes = 30, randomOrder = true, randomOptions = true, classic = false } = {}, now = Date.now()) {
  const pool = questions.filter(q => isGradable(q) && (section === 'all' || q.section === section));
  const size = count === 'all' ? pool.length : Math.min(pool.length, Math.max(1, Number(count) || 20));
  const selected = (randomOrder ? shuffle(pool) : pool).slice(0, size);
  if (!selected.length) return null;
  return { id: `${now}-${Math.random().toString(36).slice(2)}`, mode, section, ...(classic ? { classic: true } : {}),
    items: selected.map(q => ({ id: q.id, order: randomOptions ? shuffle(q.options.map((_, i) => i)) : q.options.map((_, i) => i) })),
    answers: {}, checked: [], position: 0, startedAt: now,
    deadline: mode === 'exam' ? now + Math.max(1, Math.min(240, Number(minutes) || 30)) * 60000 : null, finishedAt: null };
}
export function selectAnswer(progress, question, answer, now = Date.now()) {
  const s = progress.session;
  if (!s || s.finishedAt || !isGradable(question) || !Number.isInteger(answer) || answer < 0 || answer >= question.options.length || !s.items.some(i => i.id === question.id) || (s.mode === 'exam' && now >= s.deadline) || (s.mode === 'practice' && s.checked.includes(question.id))) return false;
  s.answers[question.id] = answer;
  if (s.mode === 'practice') { s.checked.push(question.id); recordAnswer(progress, question, answer, now); }
  return true;
}
export function evaluate(session, questions) {
  const byId = new Map(questions.map(q => [q.id, q]));
  let correct = 0, wrong = 0, skipped = 0;
  for (const item of session.items) {
    const answer = session.answers[item.id];
    if (answer === undefined || (session.mode === 'practice' && !session.checked.includes(item.id))) skipped++;
    else if (answer === byId.get(item.id).correctIndex) correct++;
    else wrong++;
  }
  return { total: session.items.length, correct, wrong, skipped, percent: Math.round(correct / session.items.length * 100) };
}
export function recordAnswer(progress, question, answer, now = Date.now()) {
  const prior = progress.records[question.id] || { attempts: 0, correct: 0 };
  progress.records[question.id] = { attempts: prior.attempts + 1,
    correct: prior.correct + Number(answer === question.correctIndex),
    lastCorrect: answer === question.correctIndex, updatedAt: now };
}
export function finishSession(progress, questions, now = Date.now()) {
  const session = progress.session;
  if (!session || session.finishedAt) return;
  if (session.mode === 'exam') {
    for (const item of session.items) {
      if (session.answers[item.id] !== undefined) recordAnswer(progress, questions.find(q => q.id === item.id), session.answers[item.id], now);
    }
  }
  session.finishedAt = now;
  progress.history.unshift({ id: session.id, mode: session.mode, section: session.section, date: now, ...evaluate(session, questions) });
  progress.history = progress.history.slice(0, 30);
}
export function statistics(progress, questions) {
  const records = questions.map(q => progress.records[q.id]).filter(Boolean);
  const attempts = records.reduce((n, r) => n + r.attempts, 0);
  const correct = records.reduce((n, r) => n + r.correct, 0);
  return { seen: records.length, learned: records.filter(r => r.lastCorrect).length,
    mistakes: records.filter(r => !r.lastCorrect).length, attempts,
    accuracy: attempts ? Math.round(correct / attempts * 100) : null };
}
export function validateProgress(raw, questions) {
  const clean = blankProgress();
  if (!raw || raw.version !== 1) return clean;
  const byId = new Map(questions.map(q => [q.id, q]));
  const validSections = new Set(['all', ...questions.map(q => q.section)]);
  for (const [id, r] of Object.entries(raw.records || {})) {
    if (byId.has(id) && Number.isSafeInteger(r?.attempts) && r.attempts > 0 && Number.isSafeInteger(r.correct) && r.correct >= 0 && r.correct <= r.attempts && typeof r.lastCorrect === 'boolean') clean.records[id] = r;
  }
  if (Array.isArray(raw.bookmarks)) clean.bookmarks = [...new Set(raw.bookmarks.filter(id => byId.has(id)))];
  if (Array.isArray(raw.history)) clean.history = raw.history.filter(h => h && ['practice', 'exam'].includes(h.mode) && validSections.has(h.section) && Number.isFinite(h.date) && Number.isInteger(h.total) && h.total > 0 && Number.isInteger(h.correct) && h.correct >= 0 && h.correct <= h.total && h.percent === Math.round(h.correct / h.total * 100)).slice(0, 30);
  const s = raw.session;
  if (s && ['practice', 'exam'].includes(s.mode) && validSections.has(s.section) && Array.isArray(s.items) && s.items.length && s.items.length <= questions.length && new Set(s.items.map(i => i?.id)).size === s.items.length && s.items.every(item => {
    const q = byId.get(item?.id);
    return q && isGradable(q) && Array.isArray(item.order) && item.order.length === q.options.length && new Set(item.order).size === q.options.length && item.order.every(i => Number.isInteger(i) && i >= 0 && i < q.options.length);
  }) && Number.isInteger(s.position) && s.position >= 0 && s.position < s.items.length && Number.isFinite(s.startedAt) && (s.finishedAt === null || Number.isFinite(s.finishedAt)) && (s.mode !== 'exam' || Number.isFinite(s.deadline))) {
    clean.session = { ...s, answers: {}, checked: [] };
    for (const item of s.items) {
      const value = s.answers?.[item.id];
      if (Number.isInteger(value) && value >= 0 && value < byId.get(item.id).options.length) clean.session.answers[item.id] = value;
    }
    if (Array.isArray(s.checked)) clean.session.checked = [...new Set(s.checked.filter(id => clean.session.answers[id] !== undefined))];
  }
  const cards = raw.cards;
  if (cards && Array.isArray(cards.ids) && cards.ids.length <= questions.length && new Set(cards.ids).size === cards.ids.length && cards.ids.every(id => isGradable(byId.get(id) || { options: [] })) && Number.isInteger(cards.position) && cards.position >= 0 && cards.position <= cards.ids.length) {
    clean.cards = { ids: cards.ids, position: cards.position, revealed: cards.revealed === true, again: [...new Set((Array.isArray(cards.again) ? cards.again : []).filter(id => cards.ids.includes(id)))] };
  }
  return clean;
}
