import { STORAGE_KEY, sections, blankProgress, createSession, evaluate, recordAnswer, finishSession, statistics, validateProgress } from './engine.js';

const icons = {
  home: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  practice: '<path d="m13 2-9 12h7l-1 8 10-13h-7l1-7Z"/>',
  exam: '<rect x="5" y="5" width="14" height="17" rx="2"/><rect x="9" y="2" width="6" height="5" rx="1"/><path d="m9 14 2 2 4-4"/>',
  library: '<path d="M12 5C8 2 4 3 2 4v16c4-2 7-1 10 1 3-2 6-3 10-1V4c-2-1-6-2-10 1Zm0 0v16"/>',
  mistakes: '<path d="M3 10a9 9 0 1 1 1 7M3 4v6h6M12 7v5l3 2"/>',
  bookmarks: '<path d="M6 3h12v19l-6-4-6 4V3Z"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/>',
  code: '<path d="m8 6-6 6 6 6m8-12 6 6-6 6M14 3l-4 18"/>',
  spark: '<path d="m12 3 3 6 6 3-6 3-3 6-3-6-6-3 6-3 3-6Z"/>',
  chart: '<path d="M4 20V10m8 10V4m8 16v-7"/>',
};
const icon = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.info}</svg>`;
const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const answerLabel = q => q.id === 'go-53' ? 'Ожидаемый ответ теста' : 'Правильный ответ';
const app = document.querySelector('#app');
let questions = [], progress = blankProgress(), route = 'home', search = '', filter = 'all', storageOK = true, toastTimeout;
let setup = { mode: 'practice', section: 'all', count: 20, minutes: 30 };
const qById = new Map();
function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(progress)); }
  catch { storageOK = false; toast('Браузер не позволяет сохранить прогресс. Текущая сессия продолжит работать.'); }
}
function toast(message) {
  const el = document.querySelector('#toast');
  el.textContent = message; el.classList.add('visible');
  clearTimeout(toastTimeout); toastTimeout = setTimeout(() => el.classList.remove('visible'), 4500);
}
function goto(next) {
  location.hash = next;
  if (route === next) render();
}
const link = (to, text, cls = 'button secondary') => `<a class="${cls}" href="#${to}">${text}</a>`;
const button = (action, text, cls = 'button primary', extra = '') => `<button class="${cls}" data-action="${action}" ${extra}>${text}</button>`;
function note(q) {
  return q.note ? `<div class="question-note">${icon('info')}<p>${esc(q.note)}${q.sourceUrl ? ` <a href="${esc(q.sourceUrl)}" target="_blank" rel="noopener">Документация Go ↗</a>` : ''}</p></div>` : '';
}
function bookmark(q) {
  const active = progress.bookmarks.includes(q.id);
  return button('bookmark', icon('bookmarks'), `icon-button ${active ? 'bookmarked' : ''}`, `data-id="${q.id}" aria-pressed="${active}" aria-label="${active ? 'Убрать из избранного' : 'В избранное'}" title="${active ? 'Убрать из избранного' : 'В избранное'}"`);
}
function shell(content) {
  const stats = statistics(progress, questions);
  const nav = [['home', 'Обзор'], ['practice', 'Тренировка'], ['exam', 'Экзамен'], ['library', 'Все вопросы'], ['mistakes', 'Мои ошибки'], ['bookmarks', 'Избранное']];
  const active = route === 'quiz' || route === 'results' ? (progress.session?.mode || 'practice') : route;
  return `<aside class="sidebar"><a class="brand" href="#home"><img src="./assets/favicon.svg" width="36" height="36" alt=""><span>Niu<span class="brand-suffix">Test</span></span></a><div class="workspace-label">ТЕСТ-ТРЕНАЖЁР / AI + GO</div>
    <nav aria-label="Основная навигация">${nav.map(([key, title], index) => `${index === 4 ? '<div class="nav-divider"></div>' : ''}<a href="#${key}" aria-label="${title}" title="${title}" class="nav-item ${active === key ? 'active' : ''}" ${active === key ? 'aria-current="page"' : ''}>${icon(key)}<span>${title}</span>${key === 'mistakes' && stats.mistakes ? `<span class="nav-count">${stats.mistakes}</span>` : ''}</a>`).join('')}</nav>
    <div class="sidebar-bottom"><div class="save-status"><span class="status-dot"></span>${storageOK ? 'Прогресс сохраняется' : 'Сохранение недоступно'}</div><p>На этом устройстве, в этом браузере</p>${link('about', `${icon('info')} О тесте и ответах`, 'about-link')}</div></aside>
    <div class="main-shell"><header class="topbar"><div><span class="course-label">УЧЕБНЫЙ КУРС</span><span class="course-name">Искусственный интеллект <span class="muted">/</span> Go</span></div><div class="topbar-right"><span class="language-tag">ҚАЗ <span>вопросы</span></span><span class="profile-icon">N</span></div></header><main id="main" tabindex="-1">${content}</main><footer>NiuTest <span>Один вопрос ближе к цели.</span><a href="#about">189 вопросов · AI & Go</a></footer></div>`;
}
function meter(value, total, cls = '') { return `<div class="meter ${cls}" role="progressbar" aria-label="Освоенные вопросы" aria-valuenow="${value}" aria-valuemin="0" aria-valuemax="${total}"><span style="width:${value / total * 100}%"></span></div>`; }
function heading(kicker, title, subtitle = '') { return `<div class="page-heading"><div class="eyebrow">${kicker}</div><h1>${title}</h1>${subtitle ? `<p>${subtitle}</p>` : ''}</div>`; }
function home() {
  const stats = statistics(progress, questions);
  const percent = Math.round(stats.learned / questions.length * 100);
  const session = progress.session;
  return `<div class="page-intro"><div><div class="eyebrow">ТВОЙ УЧЕБНЫЙ ПЛАН</div><h1>Твоя подготовка к тесту<span class="green">.</span></h1><p>Весь материал в одном месте. Практикуйся и отслеживай результат.</p></div><span class="pill">${icon('library')} 189 вопросов</span></div>
    ${session && !session.finishedAt ? `<div class="resume-bar">${icon('clock')}<div><strong>Ты уже начал${session.mode === 'exam' ? ' экзамен' : ' тренировку'}</strong><span>Ответов: ${Object.keys(session.answers).length} из ${session.items.length}${session.mode === 'exam' ? ' · время продолжает идти' : ''}</span></div>${link('quiz', 'Продолжить ' + icon('arrow'), 'button primary small')}</div>` : ''}
    <section class="hero"><div class="hero-copy"><div class="hero-kicker"><span></span>AI + GO · ОТ ЗНАНИЙ К РЕЗУЛЬТАТУ</div><h2>Знания —<br>в практику.</h2><p>Разбирай вопросы, учись на ошибках<br class="desktop-break"> и приходи на тест с уверенностью.</p><div class="hero-actions">${button('quick', `Начать тренировку ${icon('arrow')}`)}<span>20 вопросов · без таймера</span></div></div><div class="hero-visual" aria-hidden="true"><div class="knowledge-grid"></div><div class="knowledge-orbit"></div><div class="knowledge-card ai-card"><span>INTELLIGENCE</span><strong>AI</strong><small>Понимай больше.</small></div><div class="knowledge-card go-card"><span>DEVELOPMENT</span><strong>Go</strong><small>Думай как разработчик.</small></div><div class="knowledge-badge">${icon('check')} 189 вопросов. Одна цель.</div><span class="knowledge-spark">✳</span></div></section>
    <section class="stats-grid" aria-label="Твой прогресс"><div class="stat-card"><span class="stat-icon mint">${icon('library')}</span><div><span class="stat-label">Освоено вопросов</span><strong>${stats.learned}<small> / 189</small></strong></div></div><div class="stat-card"><span class="stat-icon blue">${icon('chart')}</span><div><span class="stat-label">Точность ответов</span><strong>${stats.accuracy === null ? '—' : stats.accuracy + '%'}<small>${stats.attempts ? ` за ${stats.attempts} ответов` : ' начни практику'}</small></strong></div></div><a href="#mistakes" class="stat-card"><span class="stat-icon peach">${icon('mistakes')}</span><div><span class="stat-label">Нужно повторить</span><strong>${stats.mistakes}<small> вопросов</small></strong></div>${icon('arrow', 'stat-arrow')}</a></section>
    <div class="dashboard-columns"><section><div class="section-heading"><h2>Что будем изучать?</h2><span>02 раздела</span></div><div class="subject-grid">${Object.entries(sections).map(([key, title], i) => {
      const list = questions.filter(q => q.section === key), n = statistics(progress, list).learned;
      return `<button class="subject-card" data-action="subject" data-section="${key}"><div class="subject-top"><span class="subject-icon ${key}">${icon(i ? 'code' : 'spark')}</span><span class="subject-number">0${i + 1}</span></div><h3>${title}</h3><p>${i ? 'Синтаксис, данные, конкурентность<br>и AI в экосистеме Go.' : 'Машинное обучение, нейросети,<br>применение и этика AI.'}</p><div class="subject-progress"><span>${list.length} вопросов</span><span>${n} / ${list.length}</span></div>${meter(n, list.length)}<div class="subject-cta">Перейти к практике ${icon('arrow')}</div></button>`;
    }).join('')}</div><div class="exam-callout"><span class="exam-icon">${icon('exam')}</span><div><h3>Готов проверить себя?</h3><p>Экзамен с таймером и разбором в конце.</p></div>${link('exam', 'Пройти экзамен ' + icon('arrow'), 'text-link')}</div></section>
    <aside class="progress-panel"><div class="section-heading"><h2>Общий прогресс</h2>${icon('chart')}</div><div class="progress-ring" style="--progress:${percent}%"><div><strong>${percent}<small>%</small></strong><span>материала освоено</span></div></div><div class="progress-caption"><strong>${stats.learned ? 'Продолжай в том же духе' : 'Начало большого пути'}</strong><p>${stats.learned ? `${189 - stats.learned} вопросов впереди. Каждый ответ — ещё один шаг.` : 'Первая тренировка — первый шаг к уверенности на тесте.'}</p></div><div class="panel-divider"></div><div class="small-tip">${icon('spark')}<p>Учи смысл, а не букву.<br><span>Варианты ответов перемешиваются в каждой попытке.</span></p></div></aside></div>
    ${progress.history.length ? `<section class="history-section"><div class="section-heading"><h2>Последние попытки</h2></div>${progress.history.slice(0, 4).map(h => `<div class="history-row">${icon(h.mode)}<strong>${h.mode === 'exam' ? 'Экзамен' : 'Тренировка'}</strong><span>${h.section === 'all' ? 'Все разделы' : sections[h.section]}</span><span>${new Date(h.date).toLocaleDateString('ru-RU')}</span><b>${h.correct}/${h.total} <span class="green">${h.percent}%</span></b></div>`).join('')}</section>` : ''}`;
}
function setupPage(mode) {
  const exam = mode === 'exam';
  const pool = questions.filter(q => setup.section === 'all' || q.section === setup.section);
  return `${heading(exam ? 'ПРОВЕРКА ЗНАНИЙ' : 'ШАГ ЗА ШАГОМ', exam ? 'Пробный экзамен' : 'Твоя тренировка', exam ? 'Ответы и разбор появятся после завершения. Можно менять выбор и возвращаться к вопросам.' : 'Отвечай без спешки. После проверки увидишь правильный ответ.')}
    <div class="setup-layout"><form id="setup-form" class="panel setup-panel"><h2>Настрой под себя</h2><fieldset><legend>Раздел</legend><div class="segmented">${[['all', 'Все вопросы'], ['ai', 'Основы AI'], ['go', 'Go и AI']].map(([v, t]) => `<label><input type="radio" name="section" value="${v}" ${setup.section === v ? 'checked' : ''}><span>${t}</span></label>`).join('')}</div></fieldset><fieldset><legend>Количество вопросов</legend><div class="count-options">${[10, 20, 40, 'all'].map(v => `<label><input type="radio" name="count" value="${v}" ${setup.count === v ? 'checked' : ''}><span>${v === 'all' ? `Все ${pool.length}` : v}</span></label>`).join('')}</div></fieldset>${exam ? `<label class="field-label" for="minutes">Время на экзамен</label><select id="minutes" name="minutes">${[10, 20, 30, 60, 120].map(n => `<option value="${n}" ${setup.minutes === n ? 'selected' : ''}>${n} минут</option>`).join('')}</select>` : `<div class="setting-line">${icon('check')} Вопросы и варианты перемешиваются</div><div class="setting-line">${icon('check')} Прогресс сохраняется автоматически</div>`}<button class="button primary wide" type="submit">${exam ? 'Начать экзамен' : 'Начать тренировку'} ${icon('arrow')}</button></form><aside class="setup-aside"><span class="big-icon">${icon(exam ? 'clock' : 'practice')}</span><h2>${exam ? 'Как на настоящем тесте' : 'Понимание приходит с практикой'}</h2><p>${exam ? 'Таймер продолжает идти при закрытии страницы. После истечения времени попытка завершится автоматически.' : 'Неправильные ответы попадут в «Мои ошибки». Повтори их, чтобы закрепить материал.'}</p><p class="muted">Это учебный режим. Число вопросов и время можно выбрать самостоятельно.</p><a class="text-link" href="#about">Как проверены ответы ${icon('arrow')}</a></aside></div>`;
}
function quizPage() {
  const s = progress.session;
  if (!s) return `${heading('ПРАКТИКА', 'Начнём новую попытку?')}${link('practice', 'Настроить тренировку', 'button primary')}`;
  if (s.finishedAt) return resultsPage();
  const item = s.items[s.position], q = qById.get(item.id), answer = s.answers[q.id];
  const checked = s.mode === 'practice' && s.checked.includes(q.id), correct = answer === q.correctIndex;
  const answered = s.mode === 'practice' ? s.checked.length : Object.keys(s.answers).length;
  return `<div class="quiz-heading"><a class="back-link" href="#home">← К обзору</a><span class="pill">${icon(s.mode === 'exam' ? 'clock' : 'practice')}${s.mode === 'exam' ? '<span id="timer">—:—</span>' : 'Без таймера'}</span></div><div class="quiz-title"><h1>${s.mode === 'exam' ? 'Пробный экзамен' : 'Тренировка'}</h1>${button('finish', 'Завершить', 'button secondary small')}</div><div class="quiz-progress"><span>Вопрос <b>${s.position + 1}</b> из ${s.items.length}</span><span>Отвечено: ${answered} / ${s.items.length}</span></div>${meter(answered, s.items.length)}<div class="quiz-layout"><section class="panel question-panel"><div class="question-top"><span class="question-category">${sections[q.section]} <span>· № ${q.number} в документе</span></span>${bookmark(q)}</div><h2 lang="kk" id="question-title">${esc(q.question)}</h2><div class="answers" role="group" aria-labelledby="question-title">${item.order.map((original, displayed) => {
    let cls = answer === original ? 'selected' : '';
    if (checked && original === q.correctIndex) cls = 'correct';
    else if (checked && answer === original) cls = 'incorrect';
    return `<button class="answer ${cls}" data-action="answer" data-answer="${original}" ${checked ? 'disabled' : ''} aria-pressed="${answer === original}"><span class="answer-letter">${'ABCD'[displayed]}</span><span lang="kk">${esc(q.options[original])}</span>${checked && original === q.correctIndex ? icon('check') : checked && answer === original ? icon('close') : ''}</button>`;
  }).join('')}</div>${checked ? `<div class="feedback ${correct ? 'success' : 'error'}" role="status">${icon(correct ? 'check' : 'info')}<div><strong>${correct ? (q.id === 'go-53' ? 'Засчитано по ключу теста. Прочитай уточнение ниже.' : 'Верно! Ещё один шаг вперёд.') : 'Ничего страшного — теперь ты знаешь.'}</strong>${!correct ? `<p>${answerLabel(q)}: <span lang="kk">${esc(q.options[q.correctIndex])}</span></p>` : ''}</div></div>${note(q)}` : ''}<div class="question-controls">${button('previous', '← Назад', 'button secondary', s.position === 0 ? 'disabled' : '')}${s.mode === 'practice' && !checked ? button('check', `Проверить ${icon('check')}`, 'button primary', answer === undefined ? 'disabled' : '') : button(s.position === s.items.length - 1 ? 'finish' : 'next', s.position === s.items.length - 1 ? 'Завершить попытку' : `Дальше ${icon('arrow')}`)}${s.mode === 'practice' && !checked ? button('next', s.position === s.items.length - 1 ? 'К началу' : 'Пропустить', 'text-button') : ''}</div><p class="keyboard-hint">Клавиши 1–${q.options.length} — выбрать ответ · Enter — ${checked || s.mode === 'exam' ? 'дальше' : 'проверить'}</p></section><aside class="panel question-map"><h3>Вопросы попытки</h3><div class="question-grid">${s.items.map((it, i) => {
    const marked = s.mode === 'practice' ? s.checked.includes(it.id) : s.answers[it.id] !== undefined;
    const status = marked ? (s.mode === 'exam' ? 'answered' : s.answers[it.id] === qById.get(it.id).correctIndex ? 'right' : 'wrong') : '';
    return `<button class="question-number ${status} ${i === s.position ? 'current' : ''}" data-action="jump" data-index="${i}" aria-label="Вопрос ${i + 1}${marked ? ', отвечен' : ''}" ${i === s.position ? 'aria-current="step"' : ''}>${i + 1}</button>`;
  }).join('')}</div><p>${s.mode === 'exam' ? 'Нажми на номер, чтобы перейти к вопросу. Ответы можно менять до завершения.' : 'Зелёный — верно, красный — ошибка. К пропущенным вопросам можно вернуться.'}</p>${link('home', 'Продолжить позже', 'text-link')}</aside></div>`;
}
function resultsPage() {
  const s = progress.session;
  if (!s?.finishedAt) return quizPage();
  const result = evaluate(s, questions), bad = s.items.filter(it => s.answers[it.id] !== qById.get(it.id).correctIndex || (s.mode === 'practice' && !s.checked.includes(it.id)));
  return `${heading('ПОПЫТКА ЗАВЕРШЕНА', result.percent >= 80 ? 'Отличная работа!' : 'Каждая попытка — это опыт.', 'Посмотри разбор и закрепи вопросы, которые вызвали трудности.')}<section class="panel result-summary"><div class="result-score">${result.percent}<span>%</span></div><div><h2>${result.correct} из ${result.total} верно</h2><p>${result.wrong} ошибок · ${result.skipped} без ответа</p><p class="muted">${s.mode === 'exam' ? 'Экзамен' : 'Тренировка'} · ${Math.max(1, Math.round((Math.min(s.finishedAt, s.deadline || Infinity) - s.startedAt) / 60000))} мин</p></div><div class="result-actions">${bad.length ? button('retry', 'Повторить ошибки и пропуски ' + icon('arrow')) : button('quick', 'Ещё одна тренировка ' + icon('arrow'))}${link('home', 'Вернуться к обзору')}</div></section><div class="section-heading"><h2>Разбор ответов</h2><span>${result.total} вопросов</span></div><div class="review-list">${s.items.map((it, i) => {
    const q = qById.get(it.id), a = s.answers[it.id], skipped = a === undefined || (s.mode === 'practice' && !s.checked.includes(it.id)), right = !skipped && a === q.correctIndex;
    return `<details class="review-card" ${right ? '' : 'open'}><summary><span class="review-status ${right ? 'right' : 'wrong'}">${icon(right ? 'check' : 'info')}</span><span lang="kk">${i + 1}. ${esc(q.question)}</span><span class="review-label">${skipped ? 'Пропущен' : right ? 'Верно' : 'Ошибка'}</span></summary><div class="review-body">${!right && !skipped ? `<p class="wrong-text">Твой ответ: <span lang="kk">${esc(q.options[a])}</span></p>` : ''}<p class="correct-text">${answerLabel(q)}: <span lang="kk">${esc(q.options[q.correctIndex])}</span></p>${note(q)}<div class="review-meta">${sections[q.section]} · № ${q.number} ${bookmark(q)}</div></div></details>`;
  }).join('')}</div>`;
}
function libraryPage() {
  const isMistakes = route === 'mistakes', isBookmarks = route === 'bookmarks';
  const title = isMistakes ? 'Ошибки — точки роста' : isBookmarks ? 'Важное всегда под рукой' : 'Все вопросы';
  const subtitle = isMistakes ? 'Здесь вопросы, на которые ты в последний раз ответил неверно.' : isBookmarks ? 'Сохраняй сложные вопросы и возвращайся к ним в удобное время.' : 'Изучай материал по разделам или найди нужное понятие.';
  return `${heading('ТВОЯ БАЗА ЗНАНИЙ', title, subtitle)}<div class="library-toolbar"><label class="search-field">${icon('search')}<input id="question-search" type="search" placeholder="Поиск по вопросу или ответам…" aria-label="Поиск вопросов" value="${esc(search)}"></label><select id="section-filter" aria-label="Фильтр раздела"><option value="all">Все разделы</option>${Object.entries(sections).map(([v, t]) => `<option value="${v}" ${filter === v ? 'selected' : ''}>${t}</option>`).join('')}</select>${isMistakes || isBookmarks ? button('practice-filtered', 'Тренировать ' + icon('arrow'), 'button primary') : ''}</div><div id="library-results">${libraryResults()}</div>`;
}
function filteredQuestions() {
  const text = search.trim().toLocaleLowerCase();
  return questions.filter(q => (filter === 'all' || q.section === filter) && (route !== 'mistakes' || progress.records[q.id]?.lastCorrect === false) && (route !== 'bookmarks' || progress.bookmarks.includes(q.id)) && (!text || `${q.number} ${q.question} ${q.options.join(' ')}`.toLocaleLowerCase().includes(text)));
}
function libraryResults() {
  const list = filteredQuestions();
  if (!list.length) return `<div class="empty-state">${icon(route === 'mistakes' ? 'check' : 'search')}<h2>${search || filter !== 'all' ? 'Ничего не нашлось' : route === 'mistakes' ? 'Пока ошибок нет' : 'Здесь будут избранные вопросы'}</h2><p>${search || filter !== 'all' ? 'Попробуй другой запрос или раздел.' : route === 'mistakes' ? 'Пройди тренировку, и вопросы для повторения появятся здесь.' : 'Нажми на закладку рядом с любым вопросом.'}</p>${link('practice', 'К тренировке', 'button primary')}</div>`;
  return `<p class="result-count" role="status">Найдено: ${list.length} из 189</p><div class="library-list">${list.map(q => `<article class="library-card"><div class="question-top"><span class="question-category">${sections[q.section]} · № ${q.number}</span>${bookmark(q)}</div><h2 lang="kk">${esc(q.question)}</h2><details><summary>Показать варианты и ответ <span>+</span></summary><div class="library-options">${q.options.map((o, i) => `<p class="${i === q.correctIndex ? 'correct-text' : ''}" lang="kk"><span class="original-letter">${'ABCD'[i]}</span>${esc(o)}${i === q.correctIndex ? icon('check') : ''}</p>`).join('')}</div>${note(q)}</details></article>`).join('')}</div>`;
}
function aboutPage() {
  return `${heading('ПРОЗРАЧНО О МАТЕРИАЛАХ', 'О тесте и ответах', 'Что включено в тренажёр и как устроена проверка.')}<div class="panel about-panel"><h2>189 вопросов из твоего документа</h2><p>100 вопросов по основам искусственного интеллекта и 89 по Go и AI. Текст вопросов и вариантов сохранён на казахском языке. У последнего вопроса Go в документе только три варианта.</p><h2>Ключ проверен по содержанию</h2><p>В исходном документе нет отдельного официального ключа. Все вопросы и варианты просмотрены: во всех 189 заданиях наиболее подходящим является исходный вариант A. Это составленный ключ, а не подтверждение ключа преподавателя.</p><p>Для спорных формулировок добавлены уточнения со ссылками. В частности, в Go № 53 ответ A неточен: для строк len() считает байты, а не символы. Он засчитывается как ожидаемый ответ исходного теста, с обязательным пояснением.</p><div class="question-note">${icon('info')}<p>В тренировке и экзамене варианты перемешиваются. Правильность привязана к содержанию ответа, а не к отображаемой букве.</p></div><h2>Источники для проверки</h2><ul class="source-links"><li><a href="https://go.dev/ref/spec" target="_blank" rel="noopener">Спецификация Go ↗</a> — типы, операторы, функции, строки и конкурентность.</li><li><a href="https://pkg.go.dev/cmd/go" target="_blank" rel="noopener">Команды Go ↗</a> — модули, сборка, запуск и тесты.</li><li><a href="https://developers.google.com/machine-learning/glossary" target="_blank" rel="noopener">Глоссарий машинного обучения Google ↗</a> — основные понятия AI и ML.</li><li><a href="https://www.nist.gov/itl/ai-risk-management-framework" target="_blank" rel="noopener">NIST AI Risk Management Framework ↗</a> — риски и ответственное использование AI.</li><li>Стандартная библиотека Go: <a href="https://pkg.go.dev/fmt" target="_blank" rel="noopener">fmt</a>, <a href="https://pkg.go.dev/net/http" target="_blank" rel="noopener">net/http</a>, <a href="https://pkg.go.dev/encoding/json" target="_blank" rel="noopener">encoding/json</a>.</li></ul><h2>Твой прогресс</h2><p>Ответы, ошибки, закладки и текущая попытка хранятся только в этом браузере. Освоенным считается вопрос с последним правильным ответом. Точность — доля верных ответов за всё время. Пропуски входят в результат попытки, но не в общую точность.</p><p>Перезагрузка не сбрасывает попытку. Таймер экзамена продолжает идти при закрытии страницы. При очистке данных браузера прогресс удаляется.</p>${button('reset', 'Сбросить весь прогресс', 'button danger')}</div>`;
}
function render() {
  const valid = ['home', 'practice', 'exam', 'library', 'mistakes', 'bookmarks', 'about', 'quiz', 'results'];
  route = location.hash.slice(1) || 'home';
  if (!valid.includes(route)) route = 'home';
  const pages = { home, practice: () => setupPage('practice'), exam: () => setupPage('exam'), quiz: quizPage, results: resultsPage, library: libraryPage, mistakes: libraryPage, bookmarks: libraryPage, about: aboutPage };
  app.innerHTML = shell(pages[route]());
  tick();
}
function start(options, pool = questions) {
  const begin = () => { progress.session = createSession(pool, options); save(); goto('quiz'); };
  if (progress.session && !progress.session.finishedAt) confirmAction('Начать новую попытку?', 'Текущая попытка будет заменена. Уже проверенные ответы тренировки останутся в статистике.', 'Начать новую', begin);
  else begin();
}
function confirmAction(title, description, label, action) {
  const dialog = document.querySelector('#confirm-dialog');
  dialog.innerHTML = `<form method="dialog"><h2 id="dialog-title">${esc(title)}</h2><p>${esc(description)}</p><div class="dialog-actions"><button class="button secondary" value="cancel">Отмена</button><button class="button primary" value="confirm">${esc(label)}</button></div></form>`;
  dialog.onclose = () => { if (dialog.returnValue === 'confirm') action(); };
  dialog.returnValue = ''; dialog.showModal();
}
function complete() { finishSession(progress, questions); save(); goto('results'); }
function tick() {
  const s = progress.session;
  if (!s || s.mode !== 'exam' || s.finishedAt) return;
  const remaining = Math.max(0, Math.ceil((s.deadline - Date.now()) / 1000));
  const timer = document.querySelector('#timer');
  if (timer) { timer.textContent = `${Math.floor(remaining / 60).toString().padStart(2, '0')}:${(remaining % 60).toString().padStart(2, '0')}`; timer.parentElement.classList.toggle('time-warning', remaining < 60); }
  if (!remaining) { document.querySelector('#confirm-dialog').close('cancel'); complete(); toast('Время вышло. Ответы сохранены, результат готов.'); }
}
app.addEventListener('click', event => {
  const target = event.target.closest('[data-action]');
  if (!target || target.disabled) return;
  const action = target.dataset.action, s = progress.session;
  if (action === 'quick') return start({ mode: 'practice', count: 20 });
  if (action === 'subject') { setup.section = target.dataset.section; return goto('practice'); }
  if (action === 'bookmark') {
    const id = target.dataset.id;
    progress.bookmarks = progress.bookmarks.includes(id) ? progress.bookmarks.filter(x => x !== id) : [...progress.bookmarks, id];
    save();
    if (route === 'bookmarks') document.querySelector('#library-results').innerHTML = libraryResults();
    else {
      const q = qById.get(id); const temp = document.createElement('template'); temp.innerHTML = bookmark(q); const replacement = temp.content.firstElementChild; target.replaceWith(replacement); replacement.focus();
    }
    return;
  }
  if (action === 'practice-filtered') { const list = filteredQuestions(); if (!list.length) return toast('Пока нет вопросов для тренировки.'); return start({ mode: 'practice', count: list.length, section: 'all' }, list); }
  if (action === 'reset') return confirmAction('Сбросить весь прогресс?', 'Удалятся ответы, история, избранное и текущая попытка в этом браузере. Это действие нельзя отменить.', 'Сбросить', () => { progress = blankProgress(); save(); goto('home'); toast('Прогресс сброшен'); });
  if (action === 'retry' && s?.finishedAt) {
    const pool = s.items.filter(it => s.answers[it.id] !== qById.get(it.id).correctIndex || (s.mode === 'practice' && !s.checked.includes(it.id))).map(it => qById.get(it.id));
    return start({ mode: 'practice', count: pool.length }, pool);
  }
  if (!s || s.finishedAt) return;
  if (s.mode === 'exam' && Date.now() >= s.deadline) return tick();
  const q = qById.get(s.items[s.position].id);
  if (action === 'answer' && !(s.mode === 'practice' && s.checked.includes(q.id))) s.answers[q.id] = Number(target.dataset.answer);
  if (action === 'check' && s.mode === 'practice' && s.answers[q.id] !== undefined && !s.checked.includes(q.id)) { s.checked.push(q.id); recordAnswer(progress, q, s.answers[q.id]); }
  if (action === 'next') s.position = (s.position + 1) % s.items.length;
  if (action === 'previous') s.position = Math.max(0, s.position - 1);
  if (action === 'jump') s.position = Number(target.dataset.index);
  if (action === 'finish') {
    const skipped = s.items.length - (s.mode === 'practice' ? s.checked.length : Object.keys(s.answers).length);
    return confirmAction('Завершить попытку?', skipped ? `Без проверенного ответа: ${skipped}. Они будут отмечены как пропущенные и снизят результат попытки.` : 'Посмотрим результат и разберём ответы.', 'Завершить', complete);
  }
  save(); render();
  if (['next', 'previous', 'jump'].includes(action)) document.querySelector('#question-title')?.scrollIntoView({ block: 'nearest' });
  if (action === 'answer') document.querySelector(`[data-action="answer"][data-answer="${s.answers[q.id]}"]`)?.focus();
  if (action === 'check') document.querySelector('[data-action="next"], .question-controls [data-action="finish"]')?.focus();
});
app.addEventListener('input', event => {
  if (event.target.id === 'question-search') { search = event.target.value; document.querySelector('#library-results').innerHTML = libraryResults(); }
});
app.addEventListener('change', event => {
  if (event.target.id === 'section-filter') { filter = event.target.value; document.querySelector('#library-results').innerHTML = libraryResults(); }
  if (event.target.closest('#setup-form')) {
    const data = new FormData(document.querySelector('#setup-form'));
    setup = { ...setup, section: data.get('section'), count: data.get('count') === 'all' ? 'all' : Number(data.get('count')), minutes: Number(data.get('minutes') || setup.minutes) };
    const all = document.querySelector('input[name="count"][value="all"] + span');
    if (all) all.textContent = `Все ${questions.filter(q => setup.section === 'all' || q.section === setup.section).length}`;
  }
});
app.addEventListener('submit', event => {
  if (event.target.id !== 'setup-form') return;
  event.preventDefault(); start({ ...setup, mode: route === 'exam' ? 'exam' : 'practice', count: setup.count === 'all' ? 189 : setup.count });
});
document.addEventListener('keydown', event => {
  if (route !== 'quiz' || progress.session?.finishedAt || document.querySelector('dialog[open]') || /INPUT|SELECT|TEXTAREA/.test(event.target.tagName) || event.ctrlKey || event.metaKey || event.altKey) return;
  if (/^[1-4]$/.test(event.key)) { event.preventDefault(); document.querySelectorAll('[data-action="answer"]')[Number(event.key) - 1]?.click(); }
  if (event.key === 'Enter' && !event.target.closest('a') && (!event.target.closest('button') || event.target.closest('[data-action=answer]'))) { event.preventDefault(); document.querySelector('.question-controls [data-action="check"], .question-controls [data-action="next"], .question-controls [data-action="finish"]')?.click(); }
});
window.addEventListener('hashchange', () => { search = ''; filter = 'all'; render(); window.scrollTo(0, 0); document.querySelector('#main')?.focus({ preventScroll: true }); });
document.addEventListener('visibilitychange', tick);
document.querySelector('.skip-link').addEventListener('click', event => {
  event.preventDefault();
  document.querySelector('#main')?.focus();
  document.querySelector('#main')?.scrollIntoView({ block: 'start' });
});
async function init() {
  try {
    const response = await fetch(new URL('./questions.json', import.meta.url));
    if (!response.ok) throw new Error('questions');
    const data = await response.json(); questions = data.questions;
    questions.forEach(q => qById.set(q.id, q));
    try { progress = validateProgress(JSON.parse(localStorage.getItem(STORAGE_KEY)), questions); }
    catch { progress = blankProgress(); }
    try { localStorage.setItem('qadam-storage-check', '1'); localStorage.removeItem('qadam-storage-check'); } catch { storageOK = false; }
    render(); setInterval(tick, 1000);
  } catch {
    app.innerHTML = `<main class="loading"><h1>Не удалось загрузить вопросы</h1><p>Проверь подключение и обнови страницу. Если открываешь сайт локально, запусти npm run dev.</p><button class="button primary" id="reload">Повторить</button></main>`;
    document.querySelector('#reload').onclick = () => location.reload();
  }
}
init();
