import { t } from './i18n.js';
// The browser, CLI and build use the same importer. No guessing of answer keys.
export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_QUESTIONS = 5000;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const safeId = value => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(value) && !Object.hasOwn(Object.prototype, value) && value !== 'prototype';
const text = (value, max = 20000) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
export const isGradable = q => Number.isInteger(q.correctIndex) && q.correctIndex >= 0 && q.correctIndex < q.options.length && q.answerStatus !== 'needs-review';
export const sectionNames = exam => Object.fromEntries([...new Set(exam.questions.map(q => q.section))].map(id => [id, exam.sections?.[id] || id]));
export function safeUrl(value) {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : ''; } catch { return ''; }
}
export function parseExam(input, defaults = {}) {
  const errors = [], warnings = [];
  let data = input;
  if (typeof input === 'string') {
    if (new TextEncoder().encode(input).length > MAX_FILE_BYTES) return { errors: [t("Файл больше 5 МБ. Разделите его на несколько экзаменов.")], warnings, exam: null };
    let source = input.replace(/^\uFEFF/, '').trim();
    const fenced = source.match(/^```(?:json)?\s*\n([\s\S]*?)\n```$/i);
    if (fenced) { source = fenced[1]; warnings.push(t("Убрана Markdown-обёртка из ответа модели.")); }
    try { data = JSON.parse(source); } catch (error) { return { errors: [`${t("Не удалось прочитать JSON:")} ${error.message}${t(". Проверьте запятые, кавычки и завершённость файла.")}`], warnings, exam: null }; }
  }
  const legacy = Array.isArray(data);
  if (legacy) { data = { ...defaults, questions: data }; warnings.push(t("Формат FQuiz преобразован в формат NiuTest.")); }
  if (!object(data)) return { errors: [t("Ожидается объект экзамена или массив вопросов FQuiz.")], warnings, exam: null };
  if (data.schemaVersion !== undefined && data.schemaVersion !== 1) errors.push(t("Неизвестная schemaVersion. Поддерживается версия 1."));
  const id = data.id ?? defaults.id, title = data.title ?? defaults.title;
  if (!safeId(id) || id === 'index') errors.push(t("id экзамена: 1–80 латинских букв, цифр, дефисов или подчёркиваний; первый символ — буква или цифра. Имя index зарезервировано."));
  if (!text(title, 200)) errors.push(t("Укажите название экзамена (title), до 200 символов."));
  if (!Array.isArray(data.questions) || !data.questions.length || data.questions.length > MAX_QUESTIONS) errors.push(`${t("Нужно от 1 до")} ${MAX_QUESTIONS} ${t("вопросов в массиве questions.")}`);
  const sections = {};
  if (data.sections !== undefined && !object(data.sections)) errors.push(t("sections должен быть объектом: код раздела → название."));
  for (const [key, value] of Object.entries(object(data.sections) ? data.sections : {})) {
    if (!safeId(key) || key === 'all' || !text(value, 200)) errors.push(`${t("Некорректный раздел:")} ${key}${t(". Код all зарезервирован.")}`);
    else sections[key] = value.trim();
  }
  const ids = new Set(), seenText = new Map(), questions = [];
  for (const [i, q] of (Array.isArray(data.questions) ? data.questions.slice(0, MAX_QUESTIONS) : []).entries()) {
    const prefix = `${t("Вопрос")} ${i + 1}`;
    if (!object(q)) { errors.push(`${prefix}${t(": ожидается объект.")}`); continue; }
    const qid = q.id ?? `q-${i + 1}`, section = q.section ?? 'general';
    if (!safeId(qid) || ids.has(qid)) errors.push(`${prefix}${t(": недопустимый или повторяющийся id «")}${String(qid)}».`);
    ids.add(qid);
    if (!safeId(section) || section === 'all') errors.push(`${prefix}${t(": некорректный section.")}`);
    if (!text(q.question)) errors.push(`${prefix}${t(": отсутствует текст question или он длиннее 20 000 символов.")}`);
    const opts = q.options;
    if (!Array.isArray(opts) || opts.length < 2 || opts.length > 12) { errors.push(`${prefix}${t(": нужно 2–12 вариантов ответа.")}`); continue; }
    const isFQuiz = opts.every(object);
    const options = isFQuiz ? opts.map(o => o.text) : opts;
    if (!options.every(o => text(o))) errors.push(`${prefix}${t(": каждый вариант должен быть непустой строкой до 20 000 символов.")}`);
    if (options.every(o => typeof o === 'string') && new Set(options.map(o => o.trim().toLocaleLowerCase())).size !== options.length) errors.push(`${prefix}${t(": одинаковые варианты ответа — сначала устраните неоднозначность.")}`);
    let correctIndex = q.correctIndex;
    if (isFQuiz) {
      if (!opts.every(o => typeof o.isCorrect === 'boolean')) errors.push(`${prefix}${t(": в FQuiz у каждого варианта нужен isCorrect: true или false.")}`);
      const keys = opts.flatMap((o, j) => o.isCorrect === true ? [j] : []);
      if (keys.length > 1) errors.push(`${prefix}${t(": несколько верных вариантов. Поддерживается один правильный ответ.")}`);
      const inferred = keys.length === 1 ? keys[0] : null;
      if (correctIndex !== undefined && correctIndex !== inferred) errors.push(`${prefix}${t(": correctIndex противоречит isCorrect.")}`);
      correctIndex = inferred;
    }
    if (correctIndex === undefined) correctIndex = null;
    if (correctIndex !== null && (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= options.length)) errors.push(`${prefix}${t(": correctIndex должен быть индексом от 0 до")} ${options.length - 1} ${t("или null.")}`);
    const answerStatus = q.answerStatus ?? (correctIndex === null ? 'needs-review' : data.answerKey === 'inferred-from-content' ? 'inferred' : 'provided');
    if (!['provided', 'verified', 'inferred', 'needs-review'].includes(answerStatus)) errors.push(`${prefix}${t(": неизвестный answerStatus.")}`);
    if (correctIndex === null && answerStatus !== 'needs-review') errors.push(`${prefix}${t(": без ключа нужен answerStatus: needs-review.")}`);
    if (answerStatus === 'verified' && !safeUrl(q.sourceUrl)) errors.push(`${prefix}${t(": для verified нужна ссылка sourceUrl на источник.")}`);
    for (const field of ['explanation', 'note']) if (q[field] !== undefined && (typeof q[field] !== 'string' || q[field].length > 20000)) errors.push(`${prefix}: ${field} ${t("должен быть строкой до 20 000 символов.")}`);
    if (q.sourceUrl && !safeUrl(q.sourceUrl)) errors.push(`${prefix}${t(": sourceUrl должен быть ссылкой http или https.")}`);
    const normalizedText = String(q.question).trim().toLocaleLowerCase();
    if (seenText.has(normalizedText)) warnings.push(`${prefix}${t(": текст совпадает с вопросом")} ${seenText.get(normalizedText)}${t(". Проверьте дубликат.")}`);
    seenText.set(normalizedText, i + 1);
    if (safeId(section) && section !== 'all' && !sections[section]) sections[section] = section === 'general' ? 'Общие вопросы' : section;
    questions.push({ id: qid, section, number: Number.isSafeInteger(q.number) && q.number > 0 ? q.number : i + 1,
      question: typeof q.question === 'string' ? q.question.trim() : '', options: options.map(o => typeof o === 'string' ? o.trim() : ''), correctIndex, answerStatus,
      ...(q.explanation ? { explanation: q.explanation } : {}), ...(q.note ? { note: q.note } : {}), ...(q.sourceUrl ? { sourceUrl: safeUrl(q.sourceUrl) } : {}) });
  }
  const pending = questions.filter(q => !isGradable(q)).length;
  if (pending) warnings.push(`${pending} ${t("вопросов требуют проверки ключа. Они доступны в списке, но исключены из тренировок и экзаменов.")}`);
  const inferred = questions.filter(q => q.answerStatus === 'inferred').length;
  if (inferred) warnings.push(`${inferred} ${t("ответов определены по содержанию и не являются официальным ключом.")}`);
  for (const field of ['description', 'sourceName', 'answerKey', 'language']) if (data[field] !== undefined && (typeof data[field] !== 'string' || data[field].length > (field === 'description' ? 2000 : 200))) errors.push(`${t("Некорректное поле")} ${field}.`);
  const exam = errors.length ? null : { schemaVersion: 1, id, title: title.trim(), description: data.description || '', language: data.language || '', sections,
    sourceName: data.sourceName || '', answerKey: data.answerKey || '', questions };
  return { exam, errors, warnings };
}
export function questionSignature(q) {
  return JSON.stringify([q.question, q.options, q.correctIndex, q.answerStatus]);
}
