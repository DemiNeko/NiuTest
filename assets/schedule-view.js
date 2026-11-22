import { esc } from './html.js';
import { getLanguage, locale } from './i18n.js';
import { CHECK_LABELS, MONTH, SUBJECTS, publicSchedule } from './schedule-model.js';

const copy = {
  ru: {
    title: 'Расписание экзаменов', admin: 'Управление расписанием',
    loginHint: 'Войдите, чтобы назначить даты, проверить готовность и опубликовать расписание.',
    password: 'Пароль администратора', setPassword: 'Задайте пароль администратора',
    login: 'Войти', setup: 'Создать учётную запись', waiting: 'Подождите…', token: 'Токен публикации GitHub',
    setupHint: 'Задайте пароль для закрытого плана и чек-листа. Для первой публикации понадобится доступ к репозиторию NiuTest.',
    confirm: 'Повторите пароль', minimum: 'Не менее 12 символов', remember: 'Запомнить токен на этом устройстве',
    optionalToken: 'Добавить доступ к публикации', createToken: 'Создать токен на GitHub',
    permission: 'Выберите репозиторий NiuTest и разрешение Contents → Read and write.',
    logout: 'Выйти', save: 'Сохранить для всех', preview: 'Предпросмотр', closePreview: 'Закрыть предпросмотр',
    unsaved: 'Есть несохранённые изменения', subjects: 'Предметы', add: 'Добавить предмет',
    edit: 'Экзамен', remove: 'Удалить предмет', subject: 'Название предмета',
    date: 'Дата экзамена', time: 'Время', room: 'Аудитория', visibility: 'Показывать на главной',
    checklist: 'Чек-лист готовности', checklistShort: 'Готовность', emptyTitle: 'Новый предмет',
    projectExam: 'Проектный экзамен', checks: CHECK_LABELS, pending: 'Дата не назначена', empty: 'Добавьте первый предмет в расписание.',
    reference: 'Занятия по исходному расписанию', lecture: 'Лекция', seminar: 'Семинар',
    publicTitle: 'Расписание экзаменов', monthOverview: 'Календарь', noDates: 'Даты экзаменов ещё не назначены.',
    roomShort: 'ауд.', previewTitle: 'Вид на главной', reload: 'Загрузить последнюю версию',
    publishHint: 'Календарь обновится после публикации GitHub Pages. Чек-лист доступен администратору.',
    invalidPreview: 'Проверьте названия предметов и даты для предпросмотра.', materials: 'Открыть билеты по предмету'
  },
  kk: {
    title: 'Емтихан кестесі', admin: 'Кестені басқару',
    loginHint: 'Емтихан күндерін белгілеу, дайындықты тексеру және кестені жариялау үшін жүйеге кіріңіз.',
    password: 'Әкімші құпиясөзі', setPassword: 'Әкімші құпиясөзін орнатыңыз',
    login: 'Кіру', setup: 'Тіркелгі жасау', waiting: 'Күте тұрыңыз…', token: 'GitHub жариялау токені',
    setupHint: 'Жабық жоспар мен дайындық тізіміне құпиясөз орнатыңыз. Алғашқы жарияланым үшін NiuTest репозиторийіне кіру рұқсаты қажет.',
    confirm: 'Құпиясөзді қайталаңыз', minimum: 'Кемінде 12 таңба', remember: 'Токенді осы құрылғыда сақтау',
    optionalToken: 'Жариялау рұқсатын қосу', createToken: 'GitHub-та токен жасау',
    permission: 'NiuTest репозиторийін және Contents → Read and write рұқсатын таңдаңыз.',
    logout: 'Шығу', save: 'Барлығына сақтау', preview: 'Алдын ала көру', closePreview: 'Алдын ала көріністі жабу',
    unsaved: 'Сақталмаған өзгерістер бар', subjects: 'Пәндер', add: 'Пән қосу',
    edit: 'Емтихан', remove: 'Пәнді жою', subject: 'Пән атауы',
    date: 'Емтихан күні', time: 'Уақыты', room: 'Аудитория', visibility: 'Басты бетте көрсету',
    checklist: 'Дайындық тізімі', checklistShort: 'Дайындық', emptyTitle: 'Жаңа пән',
    projectExam: 'Жобалық емтихан', checks: ['Күні мен аудиториясы расталды', 'Материалдар қосылды', 'Жауаптар тексерілді', 'Емтихан аяқталды'],
    pending: 'Күні белгіленбеген', empty: 'Кестеге алғашқы пәнді қосыңыз.',
    reference: 'Бастапқы кестедегі сабақтар', lecture: 'Дәріс', seminar: 'Семинар',
    publicTitle: 'Емтихан кестесі', monthOverview: 'Күнтізбе', noDates: 'Емтихан күндері әлі белгіленген жоқ.',
    roomShort: 'ауд.', previewTitle: 'Басты беттегі көрініс', reload: 'Соңғы нұсқасын жүктеу',
    publishHint: 'GitHub Pages жариялаған соң күнтізбе жаңарады. Дайындық тізімін әкімші ғана көре алады.',
    invalidPreview: 'Алдын ала көру үшін пән атаулары мен күндерін тексеріңіз.', materials: 'Пәннің билеттерін ашу'
  },
  en: {
    title: 'Exam schedule', admin: 'Manage the exam schedule',
    loginHint: 'Sign in to set exam dates, track preparation and publish the schedule.',
    password: 'Administrator password', setPassword: 'Set an administrator password',
    login: 'Sign in', setup: 'Create administrator account', waiting: 'Please wait…', token: 'GitHub publishing token',
    setupHint: 'Set a password for the private plan and checklist. The first publication requires access to the NiuTest repository.',
    confirm: 'Confirm password', minimum: 'At least 12 characters', remember: 'Remember the token on this device',
    optionalToken: 'Add publishing access', createToken: 'Create a token on GitHub',
    permission: 'Select the NiuTest repository and the Contents → Read and write permission.',
    logout: 'Sign out', save: 'Save for everyone', preview: 'Preview', closePreview: 'Close preview',
    unsaved: 'Unsaved changes', subjects: 'Subjects', add: 'Add subject',
    edit: 'Exam', remove: 'Remove subject', subject: 'Subject name',
    date: 'Exam date', time: 'Time', room: 'Room', visibility: 'Show on the home page',
    checklist: 'Preparation checklist', checklistShort: 'Preparation', emptyTitle: 'New subject',
    projectExam: 'Project-based exam', checks: ['Date and room confirmed', 'Materials added', 'Answers checked', 'Exam completed'],
    pending: 'Date to be set', empty: 'Add the first subject to the schedule.',
    reference: 'Classes in the original timetable', lecture: 'Lecture', seminar: 'Seminar',
    publicTitle: 'Exam schedule', monthOverview: 'Calendar', noDates: 'Exam dates have yet to be set.',
    roomShort: 'room', previewTitle: 'Home page preview', reload: 'Load latest version',
    publishHint: 'The calendar updates when GitHub Pages publishes. Only the administrator can view the checklist.',
    invalidPreview: 'Check subject names and dates to preview the schedule.', materials: 'Open the study tickets'
  }
};

const words = () => copy[getLanguage()] || copy.ru;
const utcDate = iso => new Date(iso + 'T12:00:00Z');
const format = (date, options) => new Intl.DateTimeFormat(locale(), { ...options, timeZone: 'UTC' }).format(date);
const monthText = () => format(utcDate(MONTH + '-01'), { month: 'long', year: 'numeric' });
const disabled = busy => busy ? ' disabled' : '';
const shortDate = value => /^2026-12-(0[1-9]|[12]\d|3[01])$/.test(value)
  ? format(utcDate(value), { day: 'numeric', month: 'short' }) : words().pending;
const optionLabel = exam => `${exam.title || words().emptyTitle} · ${exam.checks.filter(Boolean).length}/${exam.checks.length}`;

function messages(error, notice) {
  return `${error ? `<p class="notice error schedule-message" role="alert">${esc(error)}</p>` : ''}
    ${notice ? `<p class="notice schedule-message" role="status">${esc(notice)}</p>` : ''}`;
}

function tokenField(id, busy, required) {
  const c = words();
  return `<div class="schedule-token"><label class="field" for="${id}">${c.token}
    <input type="password" name="token" id="${id}" autocomplete="off" spellcheck="false" aria-describedby="${id}-help" ${required ? 'required' : ''}${disabled(busy)}></label>
    <p id="${id}-help">${c.permission} <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener noreferrer">${c.createToken} ↗</a></p>
    <label class="schedule-remember"><input type="checkbox" id="schedule-remember-token" name="remember"${disabled(busy)}>${c.remember}</label></div>`;
}

export function renderScheduleLogin({ busy = false, error = '', notice = '', setup = false, tokenRequired = false } = {}) {
  const c = words();
  return `<div class="schedule-screen schedule-login">
    <section class="schedule-login-panel" aria-labelledby="schedule-login-heading">
      <div class="schedule-login-top"><span class="schedule-calendar-mark" aria-hidden="true"></span>
        <span class="schedule-month">${monthText()}</span></div>
      <h1 id="schedule-login-heading">${c.admin}</h1><p class="schedule-intro">${setup ? c.setupHint : c.loginHint}</p>
      <form id="schedule-login-form" aria-busy="${busy}">
        <label class="field" for="schedule-password">${setup ? c.setPassword : c.password}
          <input type="password" name="password" id="schedule-password" autocomplete="${setup ? 'new-password' : 'current-password'}" ${setup ? 'minlength="12" aria-describedby="schedule-password-minimum"' : ''} required${disabled(busy)}>
          ${setup ? `<small id="schedule-password-minimum">${c.minimum}</small>` : ''}</label>
        ${setup ? `<label class="field">${c.confirm}<input type="password" name="confirm" autocomplete="new-password" minlength="12" required${disabled(busy)}></label>` : ''}
        ${setup || tokenRequired ? tokenField('schedule-login-token', busy, true) : `<details class="schedule-token-optional"><summary>${c.optionalToken}</summary>${tokenField('schedule-login-token', busy, false)}</details>`}
        ${messages(error, notice)}
        <button class="button primary" type="submit"${disabled(busy)}>${busy ? c.waiting : setup ? c.setup : c.login}</button>
      </form>
    </section></div>`;
}

function subjectList(exams, selectedId, busy) {
  const c = words();
  return `<aside class="schedule-subjects schedule-surface">
    <div class="schedule-section-title"><h2>${c.subjects}</h2><span class="schedule-counter">${exams.length}</span></div>
    ${exams.length ? `<label class="schedule-mobile-picker"><span class="sr-only">${c.subjects}</span>
      <select id="schedule-subject-picker"${disabled(busy)}>${exams.map(exam => `<option value="${esc(exam.id)}"${exam.id === selectedId ? ' selected' : ''}>${esc(optionLabel(exam))}</option>`).join('')}</select></label>` : ''}
    <div class="schedule-subject-list">${exams.map(exam => {
      const count = exam.checks.filter(Boolean).length;
      return `<button type="button" class="schedule-subject" data-action="schedule-select" data-id="${esc(exam.id)}"
        ${exam.id === selectedId ? 'aria-current="true"' : ''}${disabled(busy)}>
        <strong>${esc(exam.title || c.emptyTitle)}</strong>
        <span class="schedule-subject-meta"><span class="schedule-subject-date">${shortDate(exam.date)}</span><span title="${c.checklistShort}"><span class="sr-only">${c.checklistShort} </span>✓ ${count}/${exam.checks.length}</span></span>
      </button>`;
    }).join('')}</div>
    <button type="button" class="button secondary schedule-add" data-action="schedule-add"${disabled(busy)}><span aria-hidden="true">+</span> ${c.add}</button>
  </aside>`;
}

function classReference(id) {
  const subject = SUBJECTS.find(s => s.id === id);
  if (!subject) return '';
  const c = words();
  return `<details class="schedule-reference"><summary>${c.reference}</summary>
    <ul>${subject.slots.map(slot => {
      const day = format(new Date(Date.UTC(2026, 11, 6 + slot.day)), { weekday: 'long' });
      const type = slot.type === 'Дәріс' ? c.lecture : slot.type === 'Семинар' ? c.seminar : '';
      return `<li><strong class="schedule-ref-day">${day}</strong>
        <span class="schedule-ref-time">${esc(slot.start)}–${esc(slot.end)}</span>
        <span>${[type, slot.teacher, slot.room && `${c.roomShort} ${slot.room}`].filter(Boolean).map(esc).join(' · ')}</span></li>`;
    }).join('')}</ul></details>`;
}

function editor(exam, busy) {
  const c = words();
  if (!exam) return `<section class="schedule-surface schedule-empty"><p>${c.empty}</p></section>`;
  return `<section class="schedule-surface schedule-editor">
    <div class="schedule-section-title"><h2>${c.edit}</h2>
      <button type="button" class="schedule-text-button" data-action="schedule-delete" data-id="${esc(exam.id)}"${disabled(busy)}>${c.remove}</button></div>
    <form id="schedule-edit-form" data-id="${esc(exam.id)}"><fieldset${disabled(busy)}>
      <legend class="sr-only">${c.edit}</legend>
      <label class="field">${c.subject}<input name="title" type="text" value="${esc(exam.title)}" maxlength="200" required></label>
      <div class="schedule-date-fields">
        <label class="field">${c.date}<input type="date" name="date" min="${MONTH}-01" max="${MONTH}-31" value="${esc(exam.date)}"></label>
        <label class="field">${c.time}<input type="time" name="time" value="${esc(exam.time)}"></label>
        <label class="field">${c.room}<input type="text" name="room" value="${esc(exam.room)}" maxlength="160"></label>
      </div>
      <fieldset class="schedule-checks"><legend>${c.checklist}</legend>
        <label><input type="checkbox" name="projectExam"${exam.projectExam ? ' checked' : ''}><span>${c.projectExam}</span></label>
        ${c.checks.map((label, i) => `<label><input type="checkbox" data-schedule-check="${i}" name="check-${i}"${exam.checks[i] ? ' checked' : ''}>
          <span>${esc(label)}</span></label>`).join('')}
      </fieldset>
    </fieldset></form>
    ${['testing', 'parallel'].includes(exam.id) ? `<a class="schedule-materials" href="#tickets/${exam.id}/1">${c.materials} →</a>` : ''}
    ${classReference(exam.id)}
  </section>`;
}

function previewContent(plan) {
  try { return renderPublicSchedule(publicSchedule({ ...plan, visible: true })); }
  catch { return messages(words().invalidPreview, ''); }
}

export function refreshScheduleSummary(root, plan, selectedId, preview) {
  if (!root) return;
  const exam = plan.exams.find(item => item.id === selectedId);
  if (!exam) return;
  const selected = root.querySelector('.schedule-subject[aria-current="true"]');
  if (selected && selected.dataset.id === selectedId) {
    selected.querySelector('strong').textContent = exam.title || words().emptyTitle;
    selected.querySelector('.schedule-subject-date').textContent = shortDate(exam.date);
  }
  const chosen = root.querySelector('#schedule-subject-picker option:checked');
  if (chosen && chosen.value === selectedId) chosen.textContent = optionLabel(exam);
  const previewRoot = root.querySelector('.schedule-preview-body');
  if (preview && previewRoot) previewRoot.innerHTML = previewContent(plan);
}

export function renderSchedulePlanner(plan, {
  selectedId, busy = false, error = '', notice = '', dirty = false, preview = false, tokenRequired = false, conflict = false
} = {}) {
  const c = words();
  const exam = plan.exams.find(item => item.id === selectedId) || plan.exams[0];
  return `<section class="schedule-screen schedule-planner" aria-labelledby="schedule-heading" aria-busy="${busy}">
    <header class="schedule-page-heading"><div><p class="schedule-month">${monthText()}</p><h1 id="schedule-heading">${c.title}</h1></div>
      <button type="button" class="button secondary small" data-action="schedule-logout"${disabled(busy)}>${c.logout}</button></header>
    <div class="schedule-layout">${subjectList(plan.exams, exam?.id, busy)}${editor(exam, busy)}</div>
    <div class="schedule-publication schedule-surface">
      <label class="schedule-switch"><input id="schedule-visible" type="checkbox" role="switch" ${plan.visible ? 'checked' : ''}${disabled(busy)}>
        <span class="schedule-switch-track" aria-hidden="true"></span><span>${c.visibility}</span></label>
      <p class="schedule-publish-hint">${c.publishHint}</p>
      ${tokenRequired ? tokenField('schedule-publish-token', busy, true) : ''}
      <div class="schedule-save-actions"><span class="schedule-dirty" role="status"${dirty ? '' : ' hidden'}>${c.unsaved}</span>
        <button type="button" class="button secondary" data-action="schedule-preview" aria-expanded="${preview}"${disabled(busy)}>${preview ? c.closePreview : c.preview}</button>
        <button type="button" class="button primary" data-action="schedule-save"${disabled(busy || !dirty)}>${busy ? c.waiting : c.save}</button>
      </div>
    </div>${messages(error, notice)}
    ${conflict ? `<button class="button secondary small" type="button" data-action="schedule-reload"${disabled(busy)}>${c.reload}</button>` : ''}
    ${preview ? `<div class="schedule-preview"><h2>${c.previewTitle}</h2><div class="schedule-preview-body">${previewContent(plan)}</div></div>` : ''}
  </section>`;
}

function monthGrid(exams) {
  const firstDay = utcDate(MONTH + '-01');
  const offset = (firstDay.getUTCDay() + 6) % 7;
  const activeDays = new Set(exams.map(exam => Number(exam.date.slice(-2))));
  // The seven headers begin on Monday in all three interface languages.
  const weekdays = Array.from({ length: 7 }, (_, day) => format(new Date(Date.UTC(2026, 11, 7 + day)), { weekday: 'short' }));
  return `<div class="schedule-month-grid" aria-hidden="true">
    ${weekdays.map(day => `<span class="schedule-weekday">${day}</span>`).join('')}
    ${'<span></span>'.repeat(offset)}
    ${Array.from({ length: 31 }, (_, i) => `<span class="schedule-number${activeDays.has(i + 1) ? ' has-exam' : ''}">${i + 1}</span>`).join('')}
  </div>`;
}

export function renderPublicSchedule(schedule) {
  if (!schedule?.visible) return '';
  const c = words(), groups = new Map();
  for (const exam of schedule.exams) {
    if (!exam.date) continue;
    if (!groups.has(exam.date)) groups.set(exam.date, []);
    groups.get(exam.date).push(exam);
  }
  return `<section class="schedule-public" aria-label="${c.publicTitle}">
    <div class="schedule-calendar"><p class="schedule-public-label">${c.monthOverview}</p><h2>${monthText()}</h2>
      ${monthGrid(schedule.exams)}</div>
    <div class="schedule-agenda"><h2>${c.publicTitle}</h2>
      ${groups.size ? `<ol class="schedule-agenda-list">${Array.from(groups, ([iso, exams]) => {
        const date = utcDate(iso), weekday = format(date, { weekday: 'short' });
        return `<li class="schedule-agenda-day"><time datetime="${esc(iso)}"><strong>${date.getUTCDate()}</strong><span>${weekday}</span></time>
          <ul>${exams.map(exam => `<li><h3>${esc(exam.title)}</h3>
            ${exam.time || exam.room ? `<p>${[exam.time, exam.room && `${c.roomShort} ${exam.room}`].filter(Boolean).map(esc).join(' · ')}</p>` : ''}</li>`).join('')}</ul></li>`;
      }).join('')}</ol>` : `<p class="schedule-no-dates">${c.noDates}</p>`}
    </div></section>`;
}
