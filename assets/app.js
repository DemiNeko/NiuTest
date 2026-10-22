import { STORAGE_KEY, blankProgress, createSession, evaluate, recordAnswer, selectAnswer, finishSession, statistics, validateProgress, shuffle } from './engine.js';
import { parseExam, isGradable, sectionNames, MAX_FILE_BYTES } from './exam-format.js';
import { LIBRARY_KEY, progressKey, readCatalog, reconcileProgress, parseBackup, commitStorage, recoverStorage, loadExamProgress, snapshotProgress } from './library-store.js';
import { prompts } from './prompts.js';
import { defaultConfig, validateSiteConfig, SITE_CONFIG_KEY, themeStyle } from './site-config.js';
import { t, getLanguage, setLanguage, locale, siteText, countText } from './i18n.js';
import { catalogFiles, zipFiles } from './catalog-export.js';

const app = document.querySelector('#app');
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const symbols = { exams: '▦', home: '⌂', practice: 'ϟ', exam: '◷', library: '☷', cards: '▤', mistakes: '↻', bookmarks: '☆', import: '+', about: '?' };
const btn = (action, label, cls = 'primary', attrs = '') => `<button class="button ${cls}" data-action="${action}" ${attrs}>${label}</button>`;
const link = (to, label, cls = 'secondary') => `<a class="button ${cls}" href="#${to}">${label}</a>`;
const heading = (eyebrow, title, description = '') => `<div class="page-heading"><p class="eyebrow">${eyebrow}</p><h1>${title}</h1>${description ? `<p class="muted">${description}</p>` : ''}</div>`;
const meter = (value, total) => `<div class="meter" role="progressbar" aria-label="${t("Прогресс")}" aria-valuenow="${value}" aria-valuemin="0" aria-valuemax="${total || 1}"><span style="width:${total ? value / total * 100 : 0}%"></span></div>`;
let bundled = [], imported = [], activeId = '', route = '', progress = blankProgress(), storageOK = true, catalogOK = true;
let search = '', filter = 'all', statusFilter = 'all', page = 1, reveal = false, toastTimer, pending = null, importMessages = [], importText = '', importTitle = '', importBusy = false;
let setup = { section: 'all', count: 'all', minutes: 30, randomOrder: false, randomOptions: true };
let siteConfig = { ...defaultConfig }, publishedConfig = { ...defaultConfig }, configDraft = null, menuOpen = false;
const progressCache = new Map(), inlineAnswers = new Map();
const exams = () => [...bundled, ...imported];
const current = () => exams().find(e => e.id === activeId);
const questions = () => current()?.questions || [];
const byId = id => questions().find(q => q.id === id);
const ready = () => questions().filter(isGradable);
const sections = () => current() ? sectionNames(current()) : {};
const safeRead = key => { try { return localStorage.getItem(key); } catch { storageOK = false; return null; } };
function getProgress(exam) {
  if (!progressCache.has(exam.id)) {
    try { progressCache.set(exam.id, loadExamProgress(JSON.parse(safeRead(progressKey(exam.id))), exam)); }
    catch { progressCache.set(exam.id, blankProgress()); toast(t("Сохранённый прогресс повреждён. Экспортируйте сырые данные в разделе добавления экзаменов.")); }
  }
  return progressCache.get(exam.id);
}
function save() {
  progressCache.set(activeId, progress);
  try { localStorage.setItem(progressKey(activeId), JSON.stringify(snapshotProgress(progress, current()))); storageOK = true; }
  catch { storageOK = false; toast(t("Не удалось сохранить прогресс. Освободите место или скачайте резервную копию — текущие ответы остаются в памяти.")); }
  const el = document.querySelector('#save-state'); if (el) el.textContent = storageOK ? t("● Прогресс сохранён в браузере") : t("○ Есть несохранённые изменения");
}
function toast(message) {
  const el = document.querySelector('#toast'); el.textContent = message; el.classList.add('visible');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('visible'), 6500);
}
function go(next) { if (location.hash === `#${next}`) render(); else location.hash = next; }
function selectExam(id, destination = 'home') {
  if (!exams().some(e => e.id === id)) return;
  activeId = id; progress = getProgress(current()); search = ''; filter = statusFilter = 'all'; page = 1; inlineAnswers.clear();
  setup.section = 'all';
  try { localStorage.setItem('niutest-active-exam', id); } catch { /* Selection itself is optional. */ }
  go(destination);
}
function confirmAction(title, description, label, action) {
  const dialog = document.querySelector('#confirm-dialog');
  dialog.innerHTML = `<form method="dialog"><h2 id="dialog-title">${esc(title)}</h2><p>${esc(description)}</p><div class="actions"><button class="button secondary" value="cancel" autofocus>${t("Отмена")}</button><button class="button primary" value="confirm">${esc(label)}</button></div></form>`;
  dialog.onclose = () => { if (dialog.returnValue === 'confirm') action(); }; dialog.returnValue = ''; dialog.showModal();
}
function download(name, content, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([content], { type: `${type};charset=utf-8` }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function bookmark(q) { return btn('bookmark', progress.bookmarks.includes(q.id) ? '★' : '☆', 'icon-button', `data-id="${q.id}" aria-label="${progress.bookmarks.includes(q.id) ? t("Убрать из избранного") : t("В избранное")}" aria-pressed="${progress.bookmarks.includes(q.id)}"`); }
function note(q) {
  const status = { inferred: t('Ответ определён по содержанию'), verified: t('Ответ проверен по источнику'), provided: t('Ответ из загруженного ключа'), 'needs-review': t('Ключ требует проверки') };
  return `<div class="explanation">${q.explanation ? `<p>${esc(q.explanation)}</p>` : ''}${q.note ? `<p>${esc(q.note)}</p>` : ''}<span class="muted">${status[q.answerStatus] || t("Ответ из ключа")}${q.sourceUrl ? ` · <a href="${esc(q.sourceUrl)}" target="_blank" rel="noopener noreferrer">${t("Источник ↗")}</a>` : ''}</span></div>`;
}
function shell(content) {
  const e = current(), count = statistics(progress, questions()).mistakes;
  const nav = [['classic', t("Экзамен")], ['library', t("Все вопросы")], ['cards', t("Карточки")], ['mistakes', t("Мои ошибки")], ['bookmarks', t("Избранное")], ['practice', t("Настроить практику")], ['exam', t("Проверка с таймером")], ['home', t("Мой прогресс")]];
  const selected = ['quiz', 'results'].includes(route) ? progress.session?.classic ? 'classic' : progress.session?.mode || 'practice' : route;
  return `<button class="menu-backdrop ${menuOpen ? 'visible' : ''}" data-action="close-menu" aria-label="${t("Закрыть меню")}" ${menuOpen ? '' : 'hidden'}></button><aside id="sidebar" class="sidebar ${menuOpen ? 'is-open' : ''}" ${menuOpen ? '' : 'inert'}><div class="sidebar-brand"><a class="brand" href="#exams">${siteConfig.logo ? `<img src="${esc(siteConfig.logo)}" width="34" height="34" alt="">` : ''}<span>${esc(siteConfig.name)}</span></a>${btn('close-menu', '×', 'menu-close', `aria-label="${t("Закрыть меню")}"`)}</div><p class="workspace-label">${esc(siteText(siteConfig, 'tagline'))}</p><a href="#exams" class="catalog-link ${route === 'exams' ? 'active' : ''}"><span>▦</span> ${t("Мои экзамены")} <span class="nav-badge">${exams().length}</span></a><details class="sidebar-extra"><summary>${t("Дополнительно")}</summary><div class="nav-caption">${esc(e?.title || t("ВАШЕ ОБУЧЕНИЕ"))}</div><nav aria-label="${t("Основная навигация")}">${nav.map(([id, label]) => `<a class="nav-item ${selected === id ? 'active' : ''}" href="#${id}" ${id === 'classic' ? 'data-action="classic"' : ''} ${selected === id ? 'aria-current="page"' : ''}><span class="nav-icon" aria-hidden="true">${symbols[id] || 'ϟ'}</span><span>${label}</span>${id === 'mistakes' && count ? `<b class="nav-badge">${count}</b>` : ''}</a>`).join('')}</nav><div class="sidebar-bottom"><p id="save-state">${storageOK ? t("● Прогресс сохранён в браузере") : t("○ Есть несохранённые изменения")}</p><a href="#admin">${t("⚙ Оформление сайта")}</a><a href="#about">${t("Как всё работает ↗")}</a></div></details></aside><div class="main-shell"><header class="topbar"><div class="topbar-brand">${btn('toggle-menu', '☰', 'menu-toggle', `aria-label="${t("Открыть меню")}" aria-controls="sidebar" aria-expanded="${menuOpen}"`)}<a class="header-brand" href="#exams">${siteConfig.logo ? `<img src="${esc(siteConfig.logo)}" alt="" width="30" height="30">` : ''}<strong>${esc(siteConfig.name)}</strong></a><div class="topbar-caption">${siteConfig.showTopbarText ? `<span class="eyebrow">${esc(siteText(siteConfig, 'topbarText'))}</span>` : ''}<span class="course-name">${esc(e?.title || siteConfig.name)}</span></div></div><div class="topbar-actions"><label class="sr-only" for="exam-switch">${t("Текущий экзамен")}</label><select id="exam-switch">${exams().map(x => `<option value="${x.id}" ${x.id === activeId ? 'selected' : ''}>${esc(x.title)}</option>`).join('')}</select><label class="sr-only" for="language-switch">${t("Язык интерфейса")}</label><select id="language-switch" aria-label="${t("Язык интерфейса")}">${[['ru', 'RU'], ['en', 'EN'], ['kk', 'ҚАЗ']].map(([id, label]) => `<option value="${id}" ${getLanguage() === id ? 'selected' : ''}>${label}</option>`).join('')}</select></div></header><main id="main" class="${route === 'exams' ? 'catalog-main' : ''}" tabindex="-1">${route === 'exams' && siteConfig.background ? `<img class="catalog-background" src="${esc(siteConfig.background)}" alt="" style="opacity:${siteConfig.backgroundOpacity / 100}">` : ''}<div class="page-content">${!catalogOK ? `<div class="notice error">${t("Библиотека браузера повреждена или недоступна. Импорт остановлен, чтобы не перезаписать данные. Скачайте сырые данные в разделе «Добавить экзамен».")}</div>` : ''}${content}</div></main>${route !== 'exams' ? `<footer><strong>${esc(siteConfig.name)}</strong><span>${t("Один вопрос ближе к цели.")}</span><a href="#import">${t("Импорт и резервная копия ↗")}</a></footer>` : ''}</div>`;
}
function catalogPage() {
  return `<div class="catalog-hero">${siteConfig.homeEyebrow ? `<p class="eyebrow">${esc(siteText(siteConfig, 'homeEyebrow'))}</p>` : ''}<h1>${esc(siteText(siteConfig, 'homeTitle'))}</h1><p>${esc(siteText(siteConfig, 'homeSubtitle'))}</p></div><div class="catalog-grid">${exams().map((e, i) => {
    const p = getProgress(e), stats = statistics(p, e.questions), usable = e.questions.filter(isGradable).length;
    return `<article class="exam-card"><div class="card-top"><span class="exam-monogram color-${i % 3}">${esc(e.title.slice(0, 2).toUpperCase())}</span><span class="tag">${bundled.some(b => b.id === e.id) ? t("Встроенный") : t("Твой экзамен")}</span></div><h2>${esc(e.title)}</h2><p class="muted">${esc(e.description || t("Все вопросы, тренировка и карточки в одном месте."))}</p><div class="exam-meta">${countText(e.questions.length, 'questions')} · ${countText(Object.keys(sectionNames(e)).length, 'sections')}</div>${usable < e.questions.length ? `<p class="pending-label">${e.questions.length - usable} ${t("требуют проверки ключа")}</p>` : ''}<div class="progress-label"><span>${t("Последний ответ верный")}</span><b>${stats.learned} / ${usable}</b></div>${meter(stats.learned, usable)}<div class="actions">${btn('open-exam', p.session?.classic && !p.session.finishedAt ? t("Продолжить экзамен →") : t("Начать экзамен →"), 'primary', `data-id="${e.id}"`)}</div></article>`;
  }).join('')}</div>`;
}
function homePage() {
  const e = current(), list = ready(), stats = statistics(progress, questions()), s = progress.session;
  return `${heading(t("МОЯ ПОДГОТОВКА"), esc(e.title), esc(e.description || t("Разбирайся, запоминай и проверяй себя в удобном темпе.")))}${s && !s.finishedAt ? `<div class="resume"><div><strong>${t("Продолжим с того же места?")}</strong><p>${s.mode === 'exam' ? t("Пробный экзамен · таймер продолжает идти") : t("Тренировка")} · ${Object.keys(s.answers).length} ${t("из")} ${s.items.length} ${t("ответов")}</p></div>${link('quiz', t("Продолжить →"), 'primary')}</div>` : ''}<section class="study-hero"><div><p class="eyebrow">${t("МАЛЕНЬКИЕ ШАГИ. БОЛЬШОЙ РЕЗУЛЬТАТ.")}</p><h2>${t("Разобраться.")}<br>${t("Запомнить. Сдать")}<span>.</span></h2><p>${t("Нажми на ответ — сразу увидишь результат.")}<br>${t("Все вопросы экзамена, без ограничения по времени.")}</p><div class="actions">${btn('learn-all', t("Учить все вопросы →"), 'primary', list.length ? '' : 'disabled')}${link('library', t("Посмотреть вопросы"), 'hero-secondary')}</div><p class="hero-caption">${list.length} ${t("вопросов с ключом · в исходном порядке")}</p></div><div class="hero-art" aria-hidden="true"><div class="art-orbit"></div><div class="art-card back"><span>${t("ПРАКТИКА")}</span><b>?</b></div><div class="art-card front"><span>${t("ЕЩЁ ОДИН ШАГ")}</span><b>✓</b><span>${t("Теперь ты это знаешь.")}</span></div><span class="art-star">✳</span></div></section><div class="stats-grid"><div class="stat"><span>${t("Последний ответ верный")}</span><b>${stats.learned}<small> / ${list.length}</small></b></div><div class="stat"><span>${t("Точность в тренировках")}</span><b>${stats.accuracy === null ? '—' : stats.accuracy + '%'}</b></div><a class="stat" href="#mistakes"><span>${t("Нужно повторить ↗")}</span><b>${stats.mistakes}<small> ${t("вопросов")}</small></b></a></div><div class="section-heading"><h2>${t("Как будем учить?")}</h2><span class="muted">${t("Выбери свой подход")}</span></div><div class="mode-grid">${[['library', '01', t("Все вопросы"), t("Просматривай весь материал и проверяй себя прямо в списке.")], ['cards', '02', t("Карточки"), t("Вспомни ответ сам. Сложные карточки повтори ещё раз.")], ['exam', '03', t("Пробный экзамен"), t("Проверь знания с таймером и разбором в конце.")]].map(([id, n, title, desc]) => `<a href="#${id}" class="mode-card"><span>${n} </span><h3>${title}</h3><p>${desc}</p></a>`).join('')}</div>${questions().length > list.length ? `<div class="notice">${questions().length - list.length} ${t("вопросов ждут проверки ответа. Найти их можно в «Все вопросы» → «Без ключа».")}</div>` : ''}${progress.history.length ? `<section class="history"><h2>${t("Последние попытки")}</h2>${progress.history.slice(0, 5).map(h => `<div class="history-row"><strong>${h.mode === 'exam' ? t("Экзамен") : t("Тренировка")}</strong><span>${new Date(h.date).toLocaleDateString(locale())}</span><span>${h.correct} / ${h.total}</span><b>${h.percent}%</b></div>`).join('')}</section>` : ''}`;
}
function setupPage(mode) {
  const exam = mode === 'exam';
  return `${heading(exam ? t("ПРОВЕРКА ЗНАНИЙ") : t("ПРАКТИКА БЕЗ СПЕШКИ"), exam ? t("Пробный экзамен") : t("Настроить тренировку"), exam ? t("Ответы можно менять. Результат и объяснения появятся после завершения.") : t("Каждый ответ проверяется сразу по нажатию. Переходи дальше, когда будешь готов."))}<div class="two-columns"><form id="setup-form" class="panel"><label class="field">${t("Раздел")}<select name="section">${[['all', t("Все разделы")], ...Object.entries(sections())].map(([id, title]) => `<option value="${id}" ${setup.section === id ? 'selected' : ''}>${esc(title)}</option>`).join('')}</select></label><label class="field">${t("Количество вопросов")}<select name="count">${['all', 10, 20, 40, 100].map(n => `<option value="${n}" ${String(setup.count) === String(n) ? 'selected' : ''}>${n === 'all' ? t("Все вопросы выбранного раздела") : `${t("До")} ${n} ${t("вопросов")}`}</option>`).join('')}</select></label>${exam ? `<label class="field">${t("Время, минут")}<input name="minutes" type="number" min="1" max="240" value="${setup.minutes}" required></label>` : ''}<label class="checkbox"><input name="randomOrder" type="checkbox" ${setup.randomOrder ? 'checked' : ''}>${t("Перемешать вопросы")}</label><label class="checkbox"><input name="randomOptions" type="checkbox" ${setup.randomOptions ? 'checked' : ''}>${t("Перемешать варианты ответов")}</label><p class="muted small-text">${t("Вопросы без подтверждённого ключа в попытку не включаются.")}</p><button class="button primary wide" type="submit">${exam ? t("Начать экзамен") : t("Начать тренировку")}</button></form><aside class="study-tip"><span>${exam ? '◷' : 'ϟ'}</span><h2>${exam ? t("Время работает как на экзамене") : t("Учи смысл, а не букву")}</h2><p>${exam ? t("Таймер продолжает идти после закрытия страницы и при смене экзамена. Уже выбранные ответы сохраняются.") : t("Варианты перемешиваются, но правильный ответ остаётся привязан к своему тексту. Ошибки собираются отдельно для повторения.")}</p><p>${t("Настройки и результат относятся только к «")}${esc(current().title)}».</p></aside></div>`;
}
function startClassic() {
  if (!current()) return go('exams');
  if (progress.session?.classic && !progress.session.finishedAt) return go('quiz');
  start({ mode: 'practice', classic: true, count: 'all', randomOrder: true, randomOptions: true });
}
function start(options, pool = questions()) {
  const session = createSession(pool, options);
  if (!session) { go('library'); return toast(t("В этой подборке пока нет вопросов с проверяемым ответом.")); }
  const begin = () => { progress.session = session; save(); go('quiz'); };
  if (progress.session && !progress.session.finishedAt) confirmAction(t("Начать новую попытку?"), t("Незавершённая попытка этого экзамена будет заменена. Уже проверенные ответы останутся в статистике."), t("Начать"), begin); else begin();
}
function answerButtons(q, order, answer, checked, action, attrs = '') {
  return `<div class="answers" role="group" aria-label="${t("Варианты ответа")}">${order.map((original, i) => {
    const correct = checked && original === q.correctIndex, wrong = checked && original === answer && !correct;
    return btn(action, `<span class="answer-letter">${String.fromCharCode(65 + i)}</span><span class="answer-text">${esc(q.options[original])}</span>${correct ? `<span class="answer-mark">${t("✓ Верно")}</span>` : wrong ? `<span class="answer-mark">${t("× Ошибка")}</span>` : ''}`, `answer ${correct ? 'correct' : wrong ? 'incorrect' : answer === original ? 'selected' : ''}`, `data-answer="${original}" ${attrs} aria-pressed="${answer === original}" ${checked ? 'disabled' : ''}`);
  }).join('')}</div>`;
}
function quizPage() {
  const s = progress.session;
  if (!s) return `${heading(t("ТРЕНИРОВКА"), t("Начнём?"))}${link('practice', t("Настроить тренировку"), 'primary')}`;
  if (s.finishedAt) return resultsPage();
  const item = s.items[s.position], q = byId(item.id), answer = s.answers[q.id], checked = s.mode === 'practice' && s.checked.includes(q.id);
  const answered = s.mode === 'practice' ? s.checked.length : Object.keys(s.answers).length;
  return `<div class="section-heading"><a class="text-link" href="#exams">${t("← Все экзамены")}</a><span class="tag">${s.mode === 'exam' ? '◷ <span id="timer">—:—</span>' : t("ϟ Мгновенная проверка")}</span></div><div class="section-heading"><h1>${s.mode === 'exam' ? t("Проверка с таймером") : s.classic ? t("Экзамен") : t("Тренировка")}</h1>${btn('finish', t("Завершить"), 'secondary small')}</div><div class="progress-label"><span>${t("Вопрос")} <strong>${s.position + 1}</strong> ${t("из")} ${s.items.length}</span><span>${t("Отвечено")} ${answered} / ${s.items.length}</span></div>${meter(answered, s.items.length)}<div class="quiz-layout"><section class="panel question-panel"><div class="question-meta"><span>${esc(sections()[q.section])} · № ${q.number}</span>${bookmark(q)}</div><h2 id="question-title">${esc(q.question)}</h2>${answerButtons(q, item.order, answer, checked, 'answer')}${checked ? `<div class="feedback ${answer === q.correctIndex ? 'success' : 'error'}" role="status"><strong>${answer === q.correctIndex ? t("✓ Верно!") : t("× Пока неверно. Правильный ответ выделен зелёным.")}</strong></div>${note(q)}` : `<p class="muted small-text">${s.mode === 'exam' ? t("Можно изменить ответ до завершения экзамена.") : t("Нажми на вариант — ответ проверится сразу.")}</p>`}<div class="question-controls">${btn('previous', t("← Назад"), 'secondary', !s.position ? 'disabled' : '')}${btn(s.position === s.items.length - 1 ? 'finish' : 'next', s.position === s.items.length - 1 ? t("Завершить") : checked || answer !== undefined ? t("Дальше →") : t("Пропустить →"))}</div><p class="keyboard-hint">${t("1–9 — ответ · Enter / → — дальше · ← — назад")}</p></section><aside class="panel question-map"><h3>${t("Вопросы попытки")}</h3><div class="question-grid">${s.items.map((it, i) => {
    const marked = s.mode === 'practice' ? s.checked.includes(it.id) : s.answers[it.id] !== undefined;
    const state = !marked ? '' : s.mode === 'exam' ? 'answered' : s.answers[it.id] === byId(it.id).correctIndex ? 'right' : 'wrong';
    return btn('jump', i + 1, `question-number ${state} ${i === s.position ? 'current' : ''}`, `data-index="${i}" aria-label="${t("Вопрос")} ${i + 1}${state === 'right' ? t(", верно") : state === 'wrong' ? t(", ошибка") : marked ? t(", отвечен") : t(", без ответа")}" ${i === s.position ? 'aria-current="step"' : ''}`);
  }).join('')}</div><p class="muted small-text">${s.mode === 'exam' ? t("Нажми на номер, чтобы вернуться к вопросу.") : t("Зелёный — верно. Красный — повторить.")}</p>${link('home', t("Продолжить позже"), 'text-link')}</aside></div>`;
}
function resultsPage() {
  const s = progress.session; if (!s?.finishedAt) return quizPage();
  const r = evaluate(s, questions());
  return `${heading(t("ПОПЫТКА ЗАВЕРШЕНА"), r.percent >= 80 ? t("Хорошая работа!") : t("Теперь понятно, что повторить."), t("Разбери ошибки и попробуй ещё раз."))}<div class="panel result-summary"><strong class="result-score">${r.percent}<small>%</small></strong><div><h2>${r.correct} ${t("из")} ${r.total} ${t("верно")}</h2><p class="muted">${r.wrong} ${t("ошибок ·")} ${r.skipped} ${t("без ответа")}</p></div><div class="actions">${r.wrong + r.skipped ? btn('retry', t("Повторить ошибки и пропуски →")) : link('home', t("К подготовке"), 'primary')}</div></div><h2 class="section-title">${t("Разбор ответов")}</h2>${s.items.map((it, i) => {
    const q = byId(it.id), answer = s.answers[it.id], skipped = answer === undefined || (s.mode === 'practice' && !s.checked.includes(it.id)), correct = !skipped && answer === q.correctIndex;
    return `<details class="review-card"><summary><span class="result-dot ${correct ? 'right' : 'wrong'}">${correct ? '✓' : '×'}</span><span>${i + 1}. ${esc(q.question)}</span><span class="review-status">${skipped ? t("Пропущен") : correct ? t("Верно") : t("Ошибка")}</span></summary><div class="review-body">${!skipped && !correct ? `<p class="wrong-text">${t("Твой ответ:")} ${esc(q.options[answer])}</p>` : ''}<p class="correct-text">${t("Правильный ответ:")} ${esc(q.options[q.correctIndex])}</p>${note(q)}${bookmark(q)}</div></details>`;
  }).join('')}`;
}
function filteredQuestions() {
  const query = search.trim().toLocaleLowerCase();
  return questions().filter(q => (filter === 'all' || q.section === filter) && (route !== 'mistakes' || progress.records[q.id]?.lastCorrect === false) && (route !== 'bookmarks' || progress.bookmarks.includes(q.id)) && (statusFilter === 'all' || (statusFilter === 'pending' ? !isGradable(q) : statusFilter === 'new' ? !progress.records[q.id] : progress.records[q.id]?.lastCorrect === true)) && (!query || `${q.number} ${q.question} ${q.options.join(' ')} ${q.explanation || ''}`.toLocaleLowerCase().includes(query)));
}
function libraryPage() {
  return `${heading(t("МАТЕРИАЛЫ ЭКЗАМЕНА"), route === 'mistakes' ? t("Мои ошибки") : route === 'bookmarks' ? t("Избранное") : t("Все вопросы"), t("Нажимай на варианты прямо здесь или включи ответы для чтения и запоминания."))}<div class="library-toolbar"><label class="search-field"><span aria-hidden="true">⌕</span><input id="question-search" type="search" value="${esc(search)}" placeholder="${t("Найти вопрос, ответ или понятие…")}" aria-label="${t("Поиск вопросов")}"></label><select id="section-filter" aria-label="${t("Раздел")}"><option value="all">${t("Все разделы")}</option>${Object.entries(sections()).map(([id, title]) => `<option value="${id}" ${id === filter ? 'selected' : ''}>${esc(title)}</option>`).join('')}</select><select id="status-filter" aria-label="${t("Состояние вопроса")}">${[['all', t("Все состояния")], ['new', t("Ещё не отвечал")], ['learned', t("Последний ответ верный")], ['pending', t("Без ключа")]].map(([id, title]) => `<option value="${id}" ${id === statusFilter ? 'selected' : ''}>${title}</option>`).join('')}</select></div><div class="library-options"><label class="checkbox"><input id="show-answers" type="checkbox" ${reveal ? 'checked' : ''}>${t("Показывать правильные ответы")}</label>${btn('practice-filtered', t("Тренировать подборку →"), 'secondary small')}</div><div id="library-results">${libraryResults()}</div>`;
}
function libraryCard(q) {
  const answer = inlineAnswers.get(q.id), checked = answer !== undefined, gradable = isGradable(q);
  return `<article class="panel library-card" id="question-${q.id}"><div class="question-meta"><span>${esc(sections()[q.section])} · № ${q.number}${!gradable ? t(" · Ключ требует проверки") : ''}</span>${bookmark(q)}</div><h2>${esc(q.question)}</h2>${answerButtons(q, q.options.map((_, i) => i), answer, gradable && (reveal || checked), 'inline-answer', `data-id="${q.id}" ${!gradable ? 'disabled' : ''}`)}${gradable && (reveal || checked) ? `${checked ? `<p class="${answer === q.correctIndex ? 'correct-text' : 'wrong-text'}" role="status">${answer === q.correctIndex ? t("✓ Верно") : t("× Неверно — повтори этот вопрос позже")}</p>` : ''}${note(q)}${checked && !reveal ? btn('inline-retry', t("Попробовать ещё раз"), 'text-link small', `data-id="${q.id}"`) : ''}` : !gradable ? `<div class="notice">${t("Ответ не оценивается: сначала проверь ключ и обнови файл экзамена.")}${q.note ? ` ${esc(q.note)}` : ''}</div>` : ''}</article>`;
}
function libraryResults() {
  const list = filteredQuestions(), pages = Math.max(1, Math.ceil(list.length / 20)); page = Math.min(page, pages);
  return `<div class="section-heading result-count" role="status"><span>${t("Найдено")} ${list.length} ${t("из")} ${questions().length}</span><span>${t("Страница")} ${page} / ${pages}</span></div>${!list.length ? `<div class="empty-state"><h2>${t("Здесь пока пусто")}</h2><p>${t("Измени фильтры или начни тренировку.")}</p></div>` : `<div class="library-list">${list.slice((page - 1) * 20, page * 20).map(libraryCard).join('')}</div><div class="pagination">${btn('page-prev', t("← Назад"), 'secondary', page === 1 ? 'disabled' : '')}<span>${page} / ${pages}</span>${btn('page-next', t("Дальше →"), 'secondary', page === pages ? 'disabled' : '')}</div>`}`;
}
function refreshLibrary() { document.querySelector('#library-results').innerHTML = libraryResults(); }
function cardsPage() {
  const c = progress.cards;
  if (!c) return `${heading(t("ВСПОМНИ САМ"), t("Карточки для запоминания"), t("Сначала попробуй ответить мысленно. Затем открой ответ и отметь, нужно ли повторение."))}<div class="panel cards-intro"><span class="card-symbol">▤</span><h2>${ready().length} ${t("карточек в экзамене")}</h2><p class="muted">${t("Самооценка в карточках не меняет точность ответов в тренировках.")}</p><div class="actions">${btn('cards-start', t("Начать все карточки →"))}${btn('cards-mistakes', t("Только мои ошибки"), 'secondary')}</div></div>`;
  if (c.position >= c.ids.length) return `${heading(t("КРУГ ЗАВЕРШЁН"), t("Ещё немного — и запомнишь."), `${c.ids.length - c.again.length} ${t("карточек отмечены «Помню»,")} ${c.again.length} ${t("— «Повторить».")}`)}<div class="actions">${c.again.length ? btn('cards-again', `${t("Повторить сложные (")}${c.again.length})`) : ''}${btn('cards-start', t("Новый круг"), 'secondary')}${link('practice', t("Проверить себя в тренировке"), 'secondary')}</div>`;
  const q = byId(c.ids[c.position]);
  return `${heading(t("ВСПОМНИ САМ"), t("Карточки"))}<div class="section-heading"><span>${t("Карточка")} ${c.position + 1} / ${c.ids.length}</span>${btn('cards-reset', t("Закончить круг"), 'secondary small')}</div>${meter(c.position, c.ids.length)}<section class="panel flashcard"><div class="question-meta"><span>${esc(sections()[q.section])}</span>${bookmark(q)}</div><p class="eyebrow">${t("ПОПРОБУЙ ВСПОМНИТЬ ОТВЕТ")}</p><h2>${esc(q.question)}</h2>${c.revealed ? `<div class="card-answer"><span class="eyebrow">${t("ПРАВИЛЬНЫЙ ОТВЕТ")}</span><h3>${esc(q.options[q.correctIndex])}</h3>${note(q)}</div><div class="actions">${btn('card-again', t("↻ Ещё повторить"), 'secondary')}${btn('card-known', t("✓ Помню"))}</div>` : btn('card-reveal', t("Показать ответ"), 'primary')}<p class="keyboard-hint">${t("Пробел — открыть ответ · 1 — повторить · 2 — помню")}</p></section>`;
}
function importPage() {
  return `${adminTabs('questions')}${heading(t("ПАНЕЛЬ УПРАВЛЕНИЯ"), t("Экзамены и вопросы"), t("Загрузи файл или вставь JSON. Сначала проверим вопросы, затем сохраним экзамен."))}<div class="import-layout"><section class="panel"><div class="step-label">01 <span>${t("Загрузи вопросы")}</span></div><label class="dropzone" id="dropzone"><input id="exam-files" type="file" accept=".json,application/json" multiple><span class="upload-symbol">JSON</span><strong>${t("Выбрать JSON-файлы")}</strong><span>${t("или перетащи сюда · до 5 МБ на файл")}</span><small>${t("NiuTest и FQuiz · можно несколько файлов сразу")}</small></label><div class="or-divider">${t("ИЛИ ВСТАВЬ ТЕКСТ")}</div><label class="field">${t("Название для файла FQuiz / массива вопросов")}<input id="import-title" maxlength="200" value="${esc(importTitle)}" placeholder="${t("Например, Биология · итоговый экзамен")}"></label><label class="field">${t("JSON с вопросами")}<textarea id="import-json" rows="7" spellcheck="false" placeholder='{"schemaVersion": 1, "id": "biology", …}'>${esc(importText)}</textarea></label>${btn('validate-import', importBusy ? t("Проверяем…") : t("Проверить вопросы →"), 'primary', importBusy ? 'disabled' : '')}<div id="import-preview" aria-live="polite">${importPreview()}</div></section><aside class="import-aside"><section class="panel"><div class="step-label">02 <span>${t("Есть только документ?")}</span></div><h2>${t("Подготовь вопросы с ИИ")}</h2><p class="muted">${t("Скопируй промпт и приложи свой документ в другой модели. Готовый JSON загрузи сюда.")}</p><div class="prompt-list">${prompts.map((p, i) => `<div><strong>${i + 1}. ${esc(t(p.title))}</strong><p>${esc(t(p.description))}</p><div class="actions">${btn('copy-prompt', t("Копировать"), 'secondary small', `data-index="${i}"`)}${btn('download-prompt', t("Скачать .txt"), 'text-link small', `data-index="${i}"`)}</div></div>`).join('')}</div><a class="text-link" href="./assets/exam-template.json" download>${t("↓ Скачать пример экзамена")}</a><a class="text-link block-link" href="./assets/exam.schema.json" download>${t("↓ JSON Schema для проверки")}</a></section></aside></div><section class="panel backup-panel"><div><h2>${t("Общий каталог сайта")}</h2><p class="muted">${t("Готовые вопросы и список экзаменов для папки src/exams/. Без личных ответов и прогресса.")}</p></div>${btn('export-catalog', t("Скачать каталог для сайта ↓"))}<p class="muted small-text">${t("После загрузки новых вопросов можно скачать обновлённый каталог прямо из предпросмотра. Публиковать его может владелец репозитория.")}</p></section><section class="panel backup-panel"><div><h2>${t("Резервная копия и перенос")}</h2><p class="muted">${t("Все свои экзамены, ответы, избранное и незавершённые попытки одним файлом.")}</p></div><div class="actions">${btn('backup', t("↓ Скачать копию"), 'secondary')}<label class="button secondary">${t("↑ Восстановить")}<input id="backup-file" class="sr-only" type="file" accept=".json,application/json"></label>${btn('raw-backup', t("Сырые данные"), 'text-link small')}</div><p class="small-text muted">${t("Загруженные экзамены доступны только в этом браузере. Для общего каталога сайта используй команду добавления из README.")}</p></section>`;
}
function importPreview() {
  return `${importMessages.length ? `<div class="notice ${pending ? '' : 'error'}"><ul>${importMessages.slice(0, 60).map(m => `<li>${esc(m)}</li>`).join('')}</ul>${importMessages.length > 60 ? `<p>${t("И ещё сообщений:")} ${importMessages.length - 60}${t(". Исправь первые ошибки и проверь снова.")}</p>` : ''}</div>` : ''}${pending?.type === 'exams' ? `<div class="import-summary"><h3>${t("Готово к добавлению")}</h3>${pending.exams.map(e => `<div class="preview-exam"><strong>${esc(e.title)}</strong><p>${e.questions.length} ${t("вопросов ·")} ${e.questions.filter(isGradable).length} ${t("с ключом ·")} ${Object.keys(sectionNames(e)).length} ${t("разделов")}</p>${exams().some(x => x.id === e.id) ? `<p class="pending-label">${t("Обновление существующего экзамена: изменённые ответы и попытка будут сброшены.")}</p>` : ''}<details><summary>${t("Посмотреть первый вопрос")}</summary><p>${esc(e.questions[0].question)}</p><ol type="A">${e.questions[0].options.map(o => `<li>${esc(o)}</li>`).join('')}</ol></details></div>`).join('')}<div class="actions">${btn('export-catalog', t("Скачать каталог для сайта ↓"))}${btn('commit-import', t("Сохранить в этом браузере"), 'secondary')}</div><p class="muted small-text">${t("Для всех посетителей: распакуй архив в репозиторий и опубликуй изменения. Каталог уже содержит текущие и новые экзамены.")}</p></div>` : pending?.type === 'backup' ? `<div class="import-summary"><h3>${t("Резервная копия проверена")}</h3><p>${t("Пользовательских экзаменов:")} ${pending.data.exams.length}${t(". Прогресс из копии заменит текущий. Сначала можно скачать свою копию.")}</p><div class="actions">${btn('backup', t("Скачать текущую копию"), 'secondary')}${btn('restore-backup', t("Восстановить эту копию"))}</div></div>` : ''}`;
}
function idFromTitle(title) {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 65);
  let hash = 0; for (const c of title) hash = (Math.imul(hash, 31) + c.charCodeAt(0)) >>> 0;
  return slug && !['constructor', 'prototype'].includes(slug) ? slug : `exam-${hash.toString(36)}`;
}
function validateImports(items) {
  pending = null; importMessages = []; const valid = [];
  for (const item of items) {
    const title = importTitle.trim() || item.name.replace(/\.json$/i, '') || t("Новый экзамен");
    const result = parseExam(item.text, { id: idFromTitle(title), title });
    importMessages.push(...result.errors.map(m => `${item.name}: ${m}`), ...result.warnings.map(m => `${item.name}: ${m}`));
    if (result.exam) {
      if (bundled.some(e => e.id === result.exam.id)) importMessages.push(`${item.name}: id «${result.exam.id}${t("» принадлежит встроенному экзамену. Выберите другой id для своей копии.")}`);
      else if (valid.some(e => e.id === result.exam.id)) importMessages.push(`${item.name}${t(": одинаковый id у двух файлов. Укажите разные id.")}`);
      else valid.push(result.exam);
    }
  }
  if (valid.length === items.length && items.length) pending = { type: 'exams', exams: valid };
  document.querySelector('#import-preview').innerHTML = importPreview();
}
async function readFiles(files) {
  if (importBusy) return;
  importBusy = true; pending = null;
  try {
    if (!files.length) return;
    if (files.length > 20 || Array.from(files).reduce((sum, f) => sum + f.size, 0) > 20 * 1024 * 1024) throw new Error(t("За один раз загрузите не больше 20 файлов общим размером до 20 МБ."));
    const items = [];
    for (const file of files) { if (file.size > MAX_FILE_BYTES) throw new Error(`${file.name}${t(": размер больше 5 МБ.")}`); items.push({ name: file.name, text: await file.text() }); }
    if (route === 'import') validateImports(items);
  } catch (error) { importMessages = [error.message]; if (route === 'import') document.querySelector('#import-preview').innerHTML = importPreview(); }
  finally { importBusy = false; }
}
function commitImport() {
  if (pending?.type !== 'exams' || !catalogOK) return toast(t("Сначала устраните ошибки библиотеки и проверьте файл."));
  const incoming = pending.exams, next = imported.filter(e => !incoming.some(x => x.id === e.id)).concat(incoming), entries = [], updated = new Map();
  for (const e of incoming) { const old = exams().find(x => x.id === e.id), p = reconcileProgress(old ? getProgress(old) : blankProgress(), old, e); updated.set(e.id, p); entries.push([progressKey(e.id), JSON.stringify(snapshotProgress(p, e))]); }
  entries.push([LIBRARY_KEY, JSON.stringify({ version: 2, exams: next })]);
  try { commitStorage(localStorage, entries); } catch { return toast(t("Не удалось сохранить экзамены. Ничего не добавлено. Освободите место в браузере и повторите.")); }
  imported = next; for (const [id, p] of updated) progressCache.set(id, p);
  pending = null; importMessages = []; importText = ''; storageOK = true; selectExam(incoming[0].id, 'exams'); toast(`${t("Добавлено экзаменов:")} ${incoming.length}${t(". Можно начинать!")}`);
}
function backup() {
  const allProgress = Object.fromEntries(exams().map(e => [e.id, snapshotProgress(getProgress(e), e)]));
  download('niutest-backup.json', JSON.stringify({ type: 'niutest-backup', version: 1, exportedAt: new Date().toISOString(), exams: imported, progress: allProgress }, null, 2));
}
function exportCatalog() {
  const incoming = pending?.type === 'exams' ? pending.exams : [];
  const all = exams().filter(e => !incoming.some(x => x.id === e.id)).concat(incoming);
  try { download('niutest-catalog.zip', zipFiles(catalogFiles(all)), 'application/zip'); toast(t("Каталог скачан. Замени src/exams/ содержимым архива и опубликуй сайт. Личный прогресс в архив не включён.")); }
  catch (error) { toast(`${t("Каталог не создан:")} ${error.message}`); }
}
function restoreBackup() {
  if (pending?.type !== 'backup' || !catalogOK) return;
  const data = pending.data;
  confirmAction(t("Восстановить библиотеку из копии?"), t("Список пользовательских экзаменов и прогресс будут заменены данными проверенной копии."), t("Восстановить"), () => {
    const entries = [[LIBRARY_KEY, JSON.stringify({ version: 2, exams: data.exams })]];
    for (const e of [...bundled, ...data.exams]) entries.push([progressKey(e.id), JSON.stringify(snapshotProgress(data.progress[e.id], e))]);
    for (const e of imported) if (!data.exams.some(x => x.id === e.id)) entries.push([progressKey(e.id), null]);
    try { commitStorage(localStorage, entries); } catch { return toast(t("Копия не восстановлена: браузер не смог сохранить данные.")); }
    imported = data.exams; progressCache.clear(); pending = null; importMessages = []; if (exams().length) selectExam(exams()[0].id, 'exams'); else { activeId = ''; progress = blankProgress(); go('exams'); } toast(t("Библиотека и прогресс восстановлены."));
  });
}
function aboutPage() {
  const e = current();
  return `${heading(t("ПОНЯТНО И ПРОСТО"), t("Как устроен NiuTest"), t("Подготовка к экзаменам с выбором одного правильного варианта."))}<section class="panel prose"><h2>${t("Один экзамен — все его вопросы")}</h2><p>${t("Главная страница сразу открывает классический экзамен: весь набор вопросов, перемешивание и мгновенная проверка. В дополнительных настройках можно выбрать исходный порядок и размер попытки. В тренировке и списке вопросов результат появляется сразу. В пробном экзамене ответы открываются в конце. Карточки помогают вспомнить ответ без подсказок.")}</p><h2>${t("Откуда берутся правильные ответы")}</h2><p>${t("Сайт использует ключ из файла. Он проверяет структуру, но не может гарантировать фактическую правильность ключа. Для ответа можно указать объяснение, источник и статус проверки. Неизвестные или спорные ответы помечаются «needs-review» и не оцениваются.")}</p>${e.answerKey === 'inferred-from-content' ? `<div class="notice">${t("Встроенный AI & Go содержит 189 вопросов из исходного документа. Официального ключа в документе не было: ответы определены по содержанию. Уточнения, включая len() и goroutine, сохранены рядом с вопросами.")}</div>` : ''}<h2>${t("Сохранение и обновление")}</h2><p>${t("У каждого экзамена свои ответы, ошибки, закладки и попытка. Всё сохраняется в этом браузере без регистрации. Очистка данных браузера удалит библиотеку: скачивай резервные копии. Синхронизации между устройствами нет.")}</p><p>${t("Импорт с тем же id обновляет экзамен. Статистика неизменённых вопросов сохраняется, изменённые вопросы требуют новой попытки. История и незавершённая попытка сбрасываются при изменении содержания набора.")}</p><h2>${t("Текущий экзамен:")} ${esc(e.title)}</h2><p>${e.questions.length} ${t("вопросов ·")} ${ready().length} ${t("с ключом")}${e.sourceName ? ` ${t("· Источник:")} ${esc(e.sourceName)}` : ''}</p><div class="actions">${btn('export-exam', t("Скачать JSON экзамена"), 'secondary')}${btn('reset-progress', t("Сбросить прогресс экзамена"), 'secondary')}${imported.some(x => x.id === e.id) ? btn('delete-exam', t("Удалить этот экзамен"), 'danger') : ''}</div><p class="muted small-text">${t("Идея мгновенной проверки и карточек — из")} <a href="https://github.com/DemiNeko/FQuiz" target="_blank" rel="noopener">FQuiz</a>${t(". Файлы с options: [{ text, isCorrect }] можно импортировать напрямую.")}</p></section>`;
}
function setMenu(open) {
  menuOpen = open;
  const sidebar = document.querySelector('#sidebar'), backdrop = document.querySelector('.menu-backdrop'), main = document.querySelector('.main-shell'), toggle = document.querySelector('[data-action="toggle-menu"]');
  sidebar?.classList.toggle('is-open', open); if (sidebar) sidebar.inert = !open;
  if (backdrop) { backdrop.hidden = !open; backdrop.classList.toggle('visible', open); }
  if (main) main.inert = open;
  toggle?.setAttribute('aria-expanded', String(open)); document.body.classList.toggle('menu-open', open);
  if (open) document.querySelector('#sidebar [data-action="close-menu"]')?.focus(); else toggle?.focus({ preventScroll: true });
}
function adminTabs(active) { return `<nav class="admin-tabs" aria-label="${t("Панель управления")}"><a href="#import" class="${active === 'questions' ? 'active' : ''}">${t("Экзамены и вопросы")}</a><a href="#admin" class="${active === 'appearance' ? 'active' : ''}">${t("Оформление")}</a></nav>`; }
function configPreview() {
  const c = configDraft;
  return `<div class="branding-preview" style="${themeStyle(c)}">${c.background ? `<img class="branding-background" src="${esc(c.background)}" alt="" style="opacity:${c.backgroundOpacity / 100}">` : ''}<div class="branding-preview-header">${c.logo ? `<img src="${esc(c.logo)}" alt="${t("Логотип")}" width="34" height="34">` : ''}<strong>${esc(c.name)}</strong></div><div class="branding-preview-body">${c.homeEyebrow ? `<p class="eyebrow">${esc(siteText(c, 'homeEyebrow'))}</p>` : ''}<h2>${esc(siteText(c, 'homeTitle'))}</h2><p>${esc(siteText(c, 'homeSubtitle'))}</p><span class="button primary">${t("Начать экзамен →")}</span></div></div>`;
}
function adminPage() {
  configDraft ||= { ...siteConfig };
  const c = configDraft;
  return `${adminTabs('appearance')}${heading(t("ПАНЕЛЬ УПРАВЛЕНИЯ"), t("Оформление сайта"), t("Общие настройки находятся в src/site.json. Изображения можно заменять в src/images/."))}<div class="import-layout"><form id="site-config-form" class="panel"><h2>${t("Название и логотип")}</h2><label class="field">${t("Название сайта")}<input name="name" maxlength="120" value="${esc(c.name)}" required></label><label class="field">${t("Подпись в меню")}<input name="tagline" maxlength="120" value="${esc(c.tagline)}"></label><label class="field">${t("Логотип: путь или ссылка")}<input name="logo" value="${esc(c.logo)}" placeholder="./src/images/logo.svg"></label><label class="button secondary small">${t("Загрузить логотип")}<input id="logo-upload" type="file" class="sr-only" accept="image/png,image/jpeg,image/webp"></label><p class="muted small-text">${t("PNG, JPG, WebP до 1 МБ. Загруженное изображение попадёт в файл настроек.")}</p><h2>${t("Главная страница")}</h2><label class="field">${t("Надпись над заголовком")}<input name="homeEyebrow" maxlength="120" value="${esc(c.homeEyebrow)}"></label><label class="field">${t("Заголовок")}<input name="homeTitle" maxlength="120" value="${esc(c.homeTitle)}" required></label><label class="field">${t("Описание")}<textarea name="homeSubtitle" rows="3" maxlength="500">${esc(c.homeSubtitle)}</textarea></label><label class="field">${t("Фон: путь или ссылка")}<input name="background" value="${esc(c.background)}" placeholder="./src/images/background.svg"></label><label class="button secondary small">${t("Загрузить фон")}<input id="background-upload" type="file" class="sr-only" accept="image/png,image/jpeg,image/webp"></label><p class="muted small-text">${t("PNG, JPG, WebP до 2 МБ. Пустое поле — без фонового изображения.")}</p><label class="field">${t("Видимость фона:")} <span id="opacity-label">${c.backgroundOpacity}%</span><input type="range" name="backgroundOpacity" min="0" max="100" value="${c.backgroundOpacity}"></label><h2>${t("Цвета и язык")}</h2><div class="color-fields">${[['accentColor', t("Акценты")], ['buttonColor', t("Кнопки")], ['buttonHoverColor', t("Кнопки при наведении")], ['buttonTextColor', t("Текст кнопок")]].map(([key, label]) => `<label class="field">${label}<input type="color" name="${key}" value="${esc(c[key])}"></label>`).join('')}</div><label class="field">${t("Язык по умолчанию")}<select name="defaultLanguage">${[['ru', 'Русский'], ['en', 'English'], ['kk', 'Қазақша']].map(([id, label]) => `<option value="${id}" ${c.defaultLanguage === id ? 'selected' : ''}>${label}</option>`).join('')}</select></label><p class="muted small-text">${t("Переводы главной страницы: translations в src/site.json. Вопросы сохраняют исходный язык.")}</p><h2>${t("Верхняя панель")}</h2><label class="checkbox"><input name="showTopbarText" type="checkbox" ${c.showTopbarText ? 'checked' : ''}>${t("Показывать верхнюю надпись")}</label><label class="field">${t("Текст верхней надписи")}<input name="topbarText" maxlength="120" value="${esc(c.topbarText)}"></label><div class="actions"><button class="button primary" type="submit">${t("Посмотреть на главной →")}</button>${btn('config-export', t("Скачать src/site.json"), 'secondary')}</div><p id="config-error" role="status" class="wrong-text"></p></form><aside><div class="panel"><h2>${t("Предпросмотр")}</h2><div id="config-preview">${configPreview()}</div><p class="muted small-text">${t("Изменения доступны только в предпросмотре, пока файл не опубликован в репозитории.")}</p><div class="actions config-actions">${btn('config-published', t("Вернуть оформление сайта"), 'secondary small')}<label class="button secondary small">${t("Открыть настройки")}<input id="config-upload" type="file" class="sr-only" accept=".json,application/json"></label></div></div><section class="panel publish-help"><h3>${t("Как применить для всех")}</h3><ol><li>${t("Скачай готовый site.json.")}</li><li>${t("Замени src/site.json или выполни")} <code>${t("npm run site:apply -- путь/к/site.json")}</code>.</li><li>${t("Опубликуй изменения в GitHub Pages.")}</li></ol><p class="muted small-text">${t("Настройки меняет владелец репозитория. Посетители не могут опубликовать их через этот статический сайт.")}</p></section></aside></div>`;
}
function updateConfigDraft() {
  const form = document.querySelector('#site-config-form'); if (!form) return false;
  const data = new FormData(form), next = { ...configDraft, version: 1 };
  for (const key of ['name', 'logo', 'tagline', 'topbarText', 'homeEyebrow', 'homeTitle', 'homeSubtitle', 'background', 'accentColor', 'buttonColor', 'buttonHoverColor', 'buttonTextColor', 'defaultLanguage']) next[key] = data.get(key);
  next.showTopbarText = data.has('showTopbarText'); next.backgroundOpacity = Number(data.get('backgroundOpacity'));
  try { configDraft = validateSiteConfig(next); document.querySelector('#config-error').textContent = ''; document.querySelector('#opacity-label').textContent = `${configDraft.backgroundOpacity}%`; document.querySelector('#config-preview').innerHTML = configPreview(); return true; }
  catch (error) { document.querySelector('#config-error').textContent = error.message; return false; }
}
function configAction(action) {
  if (action === 'config-published') { configDraft = null; siteConfig = { ...publishedConfig }; try { localStorage.removeItem(SITE_CONFIG_KEY); } catch {} render(); return; }
  if (!updateConfigDraft()) return;
  if (action === 'config-export') return download('site.json', JSON.stringify(configDraft, null, 2));
  if (action === 'config-preview') { siteConfig = { ...configDraft }; go('exams'); toast(t("Предпросмотр оформления. Для всех посетителей замени src/site.json и опубликуй сайт.")); }
}
async function loadConfigImage(input) {
  const file = input.files[0]; if (!file) return;
  const key = input.id === 'logo-upload' ? 'logo' : 'background', limit = key === 'logo' ? 1024 * 1024 : 2 * 1024 * 1024;
  try {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > limit) throw new Error(`${t("Нужен PNG, JPG или WebP до")} ${limit / 1024 / 1024} ${t("МБ.")}`);
    const reader = new FileReader(); const result = await new Promise((resolve, reject) => { reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error(t("Не удалось прочитать изображение."))); reader.readAsDataURL(file); });
    const check = new Image(); check.src = result; await check.decode();
    if (route !== 'admin') return; document.querySelector(`[name="${key}"]`).value = result; updateConfigDraft(); toast(t("Изображение добавлено в предпросмотр."));
  } catch (error) { toast(error.message || t("Изображение не удалось открыть.")); } input.value = '';
}
async function loadConfigFile(input) {
  const file = input.files[0]; if (!file) return;
  try { if (file.size > 7 * 1024 * 1024) throw new Error(t("Файл больше 7 МБ.")); const config = validateSiteConfig(JSON.parse((await file.text()).replace(/^\uFEFF/, ''))); if (route === 'admin') { configDraft = config; render(); } }
  catch (error) { toast(error.message); } input.value = '';
}
function render() {
  route = location.hash.slice(1) || 'exams';
  if (route === 'classic') { if (current()) { startClassic(); return; } route = 'exams'; }
  if (!current() && !['exams', 'import', 'admin'].includes(route)) route = 'exams';
  const pages = { exams: catalogPage, home: homePage, practice: () => setupPage('practice'), exam: () => setupPage('exam'), quiz: quizPage, results: resultsPage, library: libraryPage, mistakes: libraryPage, bookmarks: libraryPage, cards: cardsPage, import: importPage, admin: adminPage, about: aboutPage };
  if (!pages[route]) route = 'exams';
  document.title = `${route === 'exams' ? t("Мои экзамены") : route === 'import' ? t("Добавить экзамен") : current()?.title || t("Подготовка")} — ${siteConfig.name}`;
  document.documentElement.lang = getLanguage();
  document.documentElement.style.cssText = themeStyle(siteConfig);
  document.querySelector('meta[name="theme-color"]').content = siteConfig.accentColor || '#3863f4';
  document.querySelector('.skip-link').textContent = t('Перейти к содержимому');
  document.querySelector('#external-change p').textContent = t('Данные изменились в другой вкладке. Обнови страницу, чтобы продолжить с актуальным прогрессом.');
  document.querySelector('#external-change a').textContent = t('Обновить страницу');
  app.innerHTML = shell(pages[route]()); tick();
}
function finish() { finishSession(progress, questions()); save(); go('results'); }
function tick() {
  const s = progress.session; if (!s || s.finishedAt || s.mode !== 'exam') return;
  const left = Math.max(0, Math.ceil((s.deadline - Date.now()) / 1000)), timer = document.querySelector('#timer');
  if (timer) { timer.textContent = `${String(Math.floor(left / 60)).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}`; timer.classList.toggle('wrong-text', left < 60); }
  if (!left) { finishSession(progress, questions()); save(); if (route === 'quiz') go('results'); toast(t("Время экзамена вышло. Результат сохранён.")); }
}
app.addEventListener('click', async event => {
  if (event.target.closest('#sidebar a')) setMenu(false);
  const target = event.target.closest('[data-action]'); if (!target || target.disabled) return;
  const action = target.dataset.action, id = target.dataset.id, s = progress.session;
  if (action === 'toggle-menu' || action === 'close-menu') { setMenu(action === 'toggle-menu' ? !menuOpen : false); return; }
  if (action.startsWith('config-')) return configAction(action);
  if (action === 'classic') { event.preventDefault(); return startClassic(); }
  if (action === 'open-exam') { activeId = id; progress = getProgress(current()); inlineAnswers.clear(); setup.section = 'all'; try { localStorage.setItem('niutest-active-exam', id); } catch {} return startClassic(); }
  if (action === 'learn-all') return start({ mode: 'practice', count: 'all', randomOrder: false });
  if (action === 'bookmark') {
    progress.bookmarks = progress.bookmarks.includes(id) ? progress.bookmarks.filter(x => x !== id) : [...progress.bookmarks, id]; save();
    if (route === 'bookmarks') refreshLibrary(); else { const marked = progress.bookmarks.includes(id); target.textContent = marked ? '★' : '☆'; target.setAttribute('aria-pressed', marked); target.setAttribute('aria-label', marked ? t("Убрать из избранного") : t("В избранное")); } return;
  }
  if (action === 'practice-filtered') return start({ mode: 'practice', count: 'all', randomOrder: true }, filteredQuestions());
  if (action === 'inline-answer') {
    const q = byId(id); if (!q || !isGradable(q) || reveal || inlineAnswers.has(id)) return;
    const answer = Number(target.dataset.answer); inlineAnswers.set(id, answer); recordAnswer(progress, q, answer); save();
    document.getElementById(`question-${id}`).outerHTML = libraryCard(q); document.querySelector(`#question-${id} [data-action="inline-retry"]`)?.focus({ preventScroll: true }); return;
  }
  if (action === 'inline-retry') { inlineAnswers.delete(id); document.getElementById(`question-${id}`).outerHTML = libraryCard(byId(id)); document.querySelector(`#question-${id} [data-action="inline-answer"]`)?.focus({ preventScroll: true }); return; }
  if (action === 'page-prev' || action === 'page-next') { page += action === 'page-prev' ? -1 : 1; refreshLibrary(); document.querySelector('#library-results').scrollIntoView({ block: 'start' }); return; }
  if (action === 'backup') return backup();
  if (action === 'export-catalog') return exportCatalog();
  if (action === 'raw-backup') {
    const raw = {}; try { for (let i = 0; i < localStorage.length; i++) { const key = localStorage.key(i); if (key.startsWith('niutest-') || key === STORAGE_KEY) raw[key] = localStorage.getItem(key); } download('niutest-raw-storage.json', JSON.stringify(raw, null, 2)); } catch { toast(t("Браузер не разрешает читать хранилище.")); } return;
  }
  if (action === 'validate-import') return validateImports([{ name: t('Вставленный JSON'), text: importText }]);
  if (action === 'commit-import') return commitImport();
  if (action === 'restore-backup') return restoreBackup();
  if (action === 'copy-prompt' || action === 'download-prompt') {
    const p = prompts[Number(target.dataset.index)];
    if (action === 'download-prompt') return download(`${p.id}.txt`, p.text, 'text/plain');
    try { await navigator.clipboard.writeText(p.text); toast(t("Промпт скопирован. Приложи к нему исходный документ.")); } catch { download(`${p.id}.txt`, p.text, 'text/plain'); toast(t("Буфер обмена недоступен. Промпт скачан файлом.")); } return;
  }
  if (action === 'export-exam') return download(`${activeId}.json`, JSON.stringify(current(), null, 2));
  if (action === 'reset-progress') return confirmAction(t("Сбросить прогресс этого экзамена?"), t("Будут удалены ответы, закладки, карточки и попытка только текущего экзамена."), t("Сбросить"), () => { progress = blankProgress(); save(); go('home'); });
  if (action === 'delete-exam') return confirmAction(t("Удалить экзамен из браузера?"), t("Вопросы и весь прогресс этого экзамена будут удалены. Для восстановления понадобится резервная копия."), t("Удалить"), () => {
    const next = imported.filter(e => e.id !== activeId);
    try { commitStorage(localStorage, [[LIBRARY_KEY, JSON.stringify({ version: 2, exams: next })], [progressKey(activeId), null]]); } catch { return toast(t("Удаление не удалось. Данные сохранены.")); }
    imported = next; progressCache.delete(activeId); if (exams().length) selectExam(exams()[0].id, 'exams'); else { activeId = ''; progress = blankProgress(); go('exams'); }
  });
  if (action.startsWith('card')) {
    const c = progress.cards;
    if (action === 'cards-start' || action === 'cards-mistakes') { const pool = ready().filter(q => action !== 'cards-mistakes' || progress.records[q.id]?.lastCorrect === false); if (!pool.length) return toast(t("В этой подборке пока нет карточек.")); progress.cards = { ids: shuffle(pool.map(q => q.id)), position: 0, revealed: false, again: [] }; }
    if (action === 'cards-reset') return confirmAction(t("Закончить круг карточек?"), t("Положение и отметки этого круга будут очищены. Результаты тренировок сохранятся."), t("Закончить"), () => { delete progress.cards; save(); render(); });
    if (c && action === 'card-reveal') c.revealed = true;
    if (c && c.revealed && ['card-again', 'card-known'].includes(action)) { if (action === 'card-again') c.again.push(c.ids[c.position]); c.position++; c.revealed = false; }
    if (c && action === 'cards-again') progress.cards = { ids: shuffle(c.again), position: 0, revealed: false, again: [] };
    save(); render(); document.querySelector('[data-action="card-reveal"], [data-action="card-known"], [data-action="cards-again"]')?.focus({ preventScroll: true }); return;
  }
  if (action === 'retry' && s?.finishedAt) return start({ mode: 'practice', count: 'all' }, s.items.filter(it => s.answers[it.id] !== byId(it.id).correctIndex || (s.mode === 'practice' && !s.checked.includes(it.id))).map(it => byId(it.id)));
  if (!s || s.finishedAt) return;
  if (s.mode === 'exam' && Date.now() >= s.deadline) return tick();
  const q = byId(s.items[s.position].id);
  if (action === 'answer') selectAnswer(progress, q, Number(target.dataset.answer));
  if (action === 'next') s.position = Math.min(s.items.length - 1, s.position + 1);
  if (action === 'previous') s.position = Math.max(0, s.position - 1);
  if (action === 'jump') s.position = Number(target.dataset.index);
  if (action === 'finish') return confirmAction(t("Завершить попытку?"), `${t("Без ответа:")} ${s.items.length - (s.mode === 'practice' ? s.checked.length : Object.keys(s.answers).length)}${t(". Они будут отмечены как пропущенные.")}`, t("Показать результат"), finish);
  save(); render();
  if (action === 'answer') document.querySelector(s.mode === 'practice' ? '.question-controls [data-action="next"], .question-controls [data-action="finish"]' : `[data-action="answer"][data-answer="${s.answers[q.id]}"]`)?.focus({ preventScroll: true });
  if (['next', 'previous', 'jump'].includes(action)) { document.querySelector('#question-title')?.scrollIntoView({ block: 'nearest' }); document.querySelector('[data-action="answer"]')?.focus({ preventScroll: true }); }
});
app.addEventListener('input', event => {
  const el = event.target;
  if (el.closest('#site-config-form')) { updateConfigDraft(); return; }
  if (el.id === 'question-search') { search = el.value; page = 1; refreshLibrary(); }
  if (el.id === 'import-json' || el.id === 'import-title') { if (el.id === 'import-json') importText = el.value; else importTitle = el.value; pending = null; importMessages = []; document.querySelector('#import-preview').innerHTML = ''; }
});
app.addEventListener('change', async event => {
  const el = event.target;
  if (el.id === 'logo-upload' || el.id === 'background-upload') return loadConfigImage(el);
  if (el.id === 'config-upload') return loadConfigFile(el);
  if (el.closest('#site-config-form')) { updateConfigDraft(); return; }
  if (el.id === 'language-switch') { if (route === 'admin') updateConfigDraft(); setLanguage(el.value); try { localStorage.setItem('niutest-language', getLanguage()); } catch {} setMenu(false); render(); document.querySelector('#language-switch')?.focus(); return; }
  if (el.id === 'exam-switch') return selectExam(el.value, 'exams');
  if (el.id === 'section-filter') { filter = el.value; page = 1; refreshLibrary(); }
  if (el.id === 'status-filter') { statusFilter = el.value; page = 1; refreshLibrary(); }
  if (el.id === 'show-answers') { reveal = el.checked; refreshLibrary(); }
  if (el.id === 'exam-files') { await readFiles(el.files); el.value = ''; }
  if (el.id === 'backup-file') {
    const file = el.files[0]; if (!file) return; pending = null;
    try { if (file.size > 50 * 1024 * 1024) throw new Error(t("Копия больше 50 МБ.")); const data = parseBackup(await file.text(), bundled); pending = { type: 'backup', data }; importMessages = []; }
    catch (error) { importMessages = [`${t("Копия не загружена:")} ${error.message}`]; }
    if (route === 'import') { document.querySelector('#import-preview').innerHTML = importPreview(); document.querySelector('#import-preview').scrollIntoView({ block: 'center' }); } el.value = '';
  }
});
app.addEventListener('submit', event => {
  if (event.target.id === 'site-config-form') { event.preventDefault(); return configAction('config-preview'); }
  if (event.target.id !== 'setup-form') return; event.preventDefault(); const data = new FormData(event.target);
  setup = { section: data.get('section'), count: data.get('count'), minutes: Number(data.get('minutes') || 30), randomOrder: data.has('randomOrder'), randomOptions: data.has('randomOptions') };
  start({ ...setup, mode: route === 'exam' ? 'exam' : 'practice' });
});
app.addEventListener('dragover', event => { if (route === 'import' && event.dataTransfer?.types.includes('Files')) { event.preventDefault(); document.querySelector('#dropzone')?.classList.add('dragging'); } });
app.addEventListener('dragleave', event => { if (!event.relatedTarget || !app.contains(event.relatedTarget)) document.querySelector('#dropzone')?.classList.remove('dragging'); });
app.addEventListener('drop', event => { if (route === 'import') { event.preventDefault(); document.querySelector('#dropzone')?.classList.remove('dragging'); readFiles(event.dataTransfer.files); } });
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && menuOpen) { setMenu(false); return; }
  if (menuOpen && event.key === 'Tab') { const nodes = [...document.querySelectorAll('#sidebar a, #sidebar button, #sidebar summary')].filter(el => el.checkVisibility()); const first = nodes[0], last = nodes.at(-1); if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); } }
  if (event.repeat || menuOpen || document.querySelector('dialog[open]') || /INPUT|SELECT|TEXTAREA/.test(event.target.tagName) || event.ctrlKey || event.metaKey || event.altKey) return;
  if (route === 'quiz' && !progress.session?.finishedAt) {
    if (/^[1-9]$/.test(event.key)) { event.preventDefault(); document.querySelectorAll('[data-action="answer"]')[Number(event.key) - 1]?.click(); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); document.querySelector('[data-action="previous"]')?.click(); }
    if (event.key === 'ArrowRight' || (event.key === 'Enter' && !event.target.closest('a,button'))) { event.preventDefault(); document.querySelector('.question-controls [data-action="next"], .question-controls [data-action="finish"]')?.click(); }
  }
  if (route === 'cards') {
    const selector = event.key === ' ' ? '[data-action="card-reveal"]' : event.key === '1' ? '[data-action="card-again"]' : event.key === '2' ? '[data-action="card-known"]' : null;
    if (selector && document.querySelector(selector)) { event.preventDefault(); document.querySelector(selector).click(); }
  }
});
window.addEventListener('hashchange', () => { menuOpen = false; document.body.classList.remove('menu-open'); search = ''; filter = statusFilter = 'all'; page = 1; render(); window.scrollTo(0, 0); document.querySelector('#main')?.focus({ preventScroll: true }); });
document.addEventListener('visibilitychange', tick);
// Avoid silent last-writer-wins loss when another tab changes the library or progress.
window.addEventListener('storage', event => { if (event.key === LIBRARY_KEY || event.key?.startsWith('niutest-progress-v2:')) { toast(t("Данные изменены в другой вкладке. Обновите страницу перед продолжением.")); app.inert = true; const el = document.querySelector('#external-change'); el.hidden = false; } });
document.querySelector('.skip-link').addEventListener('click', event => { event.preventDefault(); document.querySelector('#main')?.focus(); });
async function init() {
  try { const res = await fetch(new URL('../src/site.json', import.meta.url)); if (res.ok) publishedConfig = validateSiteConfig(await res.json()); } catch { toast(t("Настройки оформления недоступны. Используется стандартный вид.")); }
  siteConfig = { ...publishedConfig };
  setLanguage(safeRead('niutest-language') || siteConfig.defaultLanguage);
  try { const raw = safeRead(SITE_CONFIG_KEY); if (raw) siteConfig = validateSiteConfig(JSON.parse(raw)); } catch { toast(t("Локальные настройки оформления повреждены. Используется оформление сайта.")); }
  try { recoverStorage(localStorage); } catch { catalogOK = false; storageOK = false; }
  try {
    const response = await fetch(new URL('../src/exams/index.json', import.meta.url)); if (!response.ok) throw new Error(t("Каталог экзаменов не загрузился."));
    const manifest = await response.json(); const failures = [];
    for (const meta of manifest.exams) {
      try {
        if (!/^[a-zA-Z0-9_-]+\.json$/.test(meta.file)) throw new Error(t("Недопустимый путь к файлу экзамена."));
        const res = await fetch(new URL(meta.file, new URL('../src/exams/', import.meta.url))); if (!res.ok) throw new Error(t("Файл не найден."));
        const data = await res.json(); const result = parseExam({ ...meta, ...data, id: meta.id });
        if (!result.exam) throw new Error(result.errors[0]); if (bundled.some(e => e.id === result.exam.id)) throw new Error(t("Повторяющийся id экзамена.")); bundled.push(result.exam);
      } catch (error) { failures.push(`${meta.title}: ${error.message}`); }
    }
    if (failures.length) toast(`${t("Часть встроенных экзаменов недоступна:")} ${failures.join(' ')}`);
  } catch { toast(t("Встроенный каталог недоступен. Можно использовать свои экзамены или импортировать новый.")); }
  const stored = safeRead(LIBRARY_KEY);
  if (stored) { try { imported = readCatalog(JSON.parse(stored)).exams; if (imported.some(e => bundled.some(b => b.id === e.id))) throw new Error(t("Конфликт id")); } catch { catalogOK = false; imported = []; } }
  const original = bundled.find(e => e.id === 'ai-go');
  if (original && !safeRead(progressKey(original.id)) && safeRead(STORAGE_KEY)) { try { const migrated = validateProgress(JSON.parse(safeRead(STORAGE_KEY)), original.questions); localStorage.setItem(progressKey(original.id), JSON.stringify(snapshotProgress(migrated, original))); } catch { toast(t("Старый прогресс не перенесён; исходные данные сохранены в браузере.")); } }
  activeId = exams().some(e => e.id === safeRead('niutest-active-exam')) ? safeRead('niutest-active-exam') : exams()[0]?.id || '';
  if (current()) progress = getProgress(current());
  render(); setInterval(tick, 1000);
}
init();
