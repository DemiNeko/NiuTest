import { esc } from './html.js';
import { getLanguage, locale } from './i18n.js';
import { CHECK_LABELS, MONTH, SUBJECTS, publicSchedule, scheduleToday, validWallpaperImage } from './schedule-model.js';

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
    logout: 'Выйти', save: 'Сохранить для всех', preview: 'Предпросмотр календаря', closePreview: 'Закрыть предпросмотр',
    unsaved: 'Есть несохранённые изменения', subjects: 'Предметы', add: 'Добавить предмет',
    edit: 'Экзамен', remove: 'Удалить предмет', subject: 'Название предмета',
    date: 'Дата экзамена', time: 'Время', room: 'Аудитория', visibility: 'Показывать календарь на главной',
    wallpaper: 'Фон экзамена', enableWallpaper: 'Использовать на главной',
    wallpaperHint: 'Фон с датой и названием предмета можно включить даже при скрытом календаре.',
    wallpaperUrl: 'Ссылка на изображение', uploadPhoto: 'Загрузить изображение', removePhoto: 'Убрать изображение',
    imageHint: 'JPG, PNG или WebP. После сохранения загруженный файл будет доступен в репозитории.',
    timing: 'Когда показывать', dayOnly: 'В день экзамена', upcoming: 'Заранее и в день экзамена',
    priority: 'Приоритет от 1 до 10', orderHint: 'Сначала показывается сегодняшний экзамен, затем ближайший из включённых заранее. При совпадении дат выбирается экзамен с большим числом.',
    wallpaperPreview: 'Предпросмотр фона', needDate: 'Назначьте дату экзамена для показа фона.',
    today: 'Сегодня экзамен', nextExam: 'Ближайший экзамен',
    checklist: 'Чек-лист готовности', checklistShort: 'Готовность', emptyTitle: 'Новый предмет',
    projectExam: 'Проектный экзамен', checks: CHECK_LABELS, pending: 'Дата не назначена', empty: 'Добавьте первый предмет в расписание.',
    reference: 'Занятия по исходному расписанию', lecture: 'Лекция', seminar: 'Семинар',
    publicTitle: 'Расписание экзаменов', monthOverview: 'Календарь', noDates: 'Даты экзаменов ещё не назначены.',
    roomShort: 'ауд.', previewTitle: 'Вид календаря на главной', reload: 'Загрузить последнюю версию',
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
    logout: 'Шығу', save: 'Барлығына сақтау', preview: 'Күнтізбені алдын ала көру', closePreview: 'Алдын ала көріністі жабу',
    unsaved: 'Сақталмаған өзгерістер бар', subjects: 'Пәндер', add: 'Пән қосу',
    edit: 'Емтихан', remove: 'Пәнді жою', subject: 'Пән атауы',
    date: 'Емтихан күні', time: 'Уақыты', room: 'Аудитория', visibility: 'Күнтізбені басты бетте көрсету',
    wallpaper: 'Емтихан фоны', enableWallpaper: 'Басты бетте пайдалану',
    wallpaperHint: 'Күнтізбе жасырын болса да, пәннің атауы мен күні жазылған фонды қосуға болады.',
    wallpaperUrl: 'Суретке сілтеме', uploadPhoto: 'Сурет жүктеу', removePhoto: 'Суретті алып тастау',
    imageHint: 'JPG, PNG немесе WebP. Сақтағаннан кейін жүктелген файл репозиторийде қолжетімді болады.',
    timing: 'Көрсету мерзімі', dayOnly: 'Емтихан күні', upcoming: 'Алдын ала және емтихан күні',
    priority: 'Басымдық (1–10)', orderHint: 'Алдымен бүгінгі емтихан, содан кейін алдын ала көрсетуге таңдалған ең жақын емтихан көрсетіледі. Күндері бірдей болса, басымдық саны жоғары емтихан таңдалады.',
    wallpaperPreview: 'Фонды алдын ала көру', needDate: 'Фонды көрсету үшін емтихан күнін белгілеңіз.',
    today: 'Бүгін емтихан', nextExam: 'Ең жақын емтихан',
    checklist: 'Дайындық тізімі', checklistShort: 'Дайындық', emptyTitle: 'Жаңа пән',
    projectExam: 'Жобалық емтихан', checks: ['Күні мен аудиториясы расталды', 'Материалдар қосылды', 'Жауаптар тексерілді', 'Емтихан аяқталды'],
    pending: 'Күні белгіленбеген', empty: 'Кестеге алғашқы пәнді қосыңыз.',
    reference: 'Бастапқы кестедегі сабақтар', lecture: 'Дәріс', seminar: 'Семинар',
    publicTitle: 'Емтихан кестесі', monthOverview: 'Күнтізбе', noDates: 'Емтихан күндері әлі белгіленген жоқ.',
    roomShort: 'ауд.', previewTitle: 'Басты беттегі күнтізбе', reload: 'Соңғы нұсқасын жүктеу',
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
    logout: 'Sign out', save: 'Save for everyone', preview: 'Preview calendar', closePreview: 'Close preview',
    unsaved: 'Unsaved changes', subjects: 'Subjects', add: 'Add subject',
    edit: 'Exam', remove: 'Remove subject', subject: 'Subject name',
    date: 'Exam date', time: 'Time', room: 'Room', visibility: 'Show calendar on the home page',
    wallpaper: 'Exam background', enableWallpaper: 'Use on the home page',
    wallpaperHint: 'Show the exam date and subject on the home page even when the calendar is hidden.',
    wallpaperUrl: 'Image URL', uploadPhoto: 'Upload an image', removePhoto: 'Remove image',
    imageHint: 'JPG, PNG or WebP. Uploaded images will be available in the repository once saved.',
    timing: 'When to show', dayOnly: 'On the exam day', upcoming: 'In advance and on the exam day',
    priority: 'Priority from 1 to 10', orderHint: 'Today’s exam appears first, followed by the nearest exam set to show in advance. For exams on the same date, the higher number takes priority.',
    wallpaperPreview: 'Background preview', needDate: 'Set an exam date to show this background.',
    today: 'Exam today', nextExam: 'Next exam',
    checklist: 'Preparation checklist', checklistShort: 'Preparation', emptyTitle: 'New subject',
    projectExam: 'Project-based exam', checks: ['Date and room confirmed', 'Materials added', 'Answers checked', 'Exam completed'],
    pending: 'Date to be set', empty: 'Add the first subject to the schedule.',
    reference: 'Classes in the original timetable', lecture: 'Lecture', seminar: 'Seminar',
    publicTitle: 'Exam schedule', monthOverview: 'Calendar', noDates: 'Exam dates have yet to be set.',
    roomShort: 'room', previewTitle: 'Calendar on the home page', reload: 'Load latest version',
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

function wallpaperHeading(exam, today, imageOverride, preview) {
  const c = words();
  const date = /^2026-12-(0[1-9]|[12]\d|3[01])$/.test(exam.date) ? utcDate(exam.date) : null;
  const localPreview = preview && typeof imageOverride === 'string' &&
    /^(?:blob:|data:image\/webp;base64,)/.test(imageOverride);
  const image = localPreview ? imageOverride : validWallpaperImage(exam.image) && exam.image;
  const titleTag = preview ? 'h3' : 'h1';
  // The live photo spans the catalog. Only the miniature preview needs its own image.
  const label = preview ? c.wallpaperPreview : exam.date === today ? c.today : c.nextExam;
  const month = date && new Intl.DateTimeFormat(locale(), { day: 'numeric', month: 'long', timeZone: 'UTC' })
    .formatToParts(date).find(part => part.type === 'month').value;
  return `<header class="exam-wallpaper-hero${preview ? ' wallpaper-miniature' : ''}">
    ${preview && image ? `<img aria-hidden="true" src="${esc(image)}" referrerpolicy="no-referrer" alt="">` : ''}
    <div class="wallpaper-caption">
      ${date ? `<time class="wallpaper-date" datetime="${esc(exam.date)}" aria-label="${esc(format(date, { dateStyle: 'full' }))}">
        <strong>${date.getUTCDate()}</strong><span>${esc(month)}</span></time>` : ''}
      <div class="wallpaper-subject"><p>${label}</p><${titleTag}>${esc(exam.title || c.emptyTitle)}</${titleTag}>
        ${date ? '' : `<small>${c.needDate}</small>`}</div>
    </div></header>`;
}

export function renderExamBackgroundHeader(winner, today = scheduleToday()) {
  return winner ? wallpaperHeading(winner, today, null, false) : '';
}

function editorWallpaperPreview(exam, photoPreviews) {
  const image = exam.wallpaper?.image || '';
  return wallpaperHeading({ title: exam.title, date: exam.date, image }, '', photoPreviews?.get(image), true);
}

export function refreshExamWallpaperPreview(root, exam, photoPreviews) {
  const container = root?.querySelector('#schedule-wallpaper-preview');
  if (!container || !exam) return;
  container.innerHTML = editorWallpaperPreview(exam, photoPreviews);
  const remove = root.querySelector('[data-action="schedule-wallpaper-clear"]');
  if (remove) remove.hidden = !exam.wallpaper?.image;
}

function wallpaperFields(exam, photoPreviews) {
  const c = words(), wallpaper = exam.wallpaper;
  const image = wallpaper?.image || '';
  const uploaded = image.startsWith('./src/images/schedule/');
  return `<fieldset class="schedule-wallpaper-fields"><legend>${c.wallpaper}</legend>
    <label class="schedule-switch"><input type="checkbox" name="wallpaperEnabled" role="switch"${wallpaper?.enabled ? ' checked' : ''}>
      <span class="schedule-switch-track" aria-hidden="true"></span><span>${c.enableWallpaper}</span></label>
    <p class="wallpaper-hint">${c.wallpaperHint}</p>
    <div id="schedule-wallpaper-preview">${editorWallpaperPreview(exam, photoPreviews)}</div>
    <div class="wallpaper-source">
      <label class="field">${c.wallpaperUrl}<input type="url" name="wallpaperUrl" placeholder="https://…" spellcheck="false"
        value="${uploaded ? '' : esc(image)}"></label>
      <label class="wallpaper-file"><input type="file" name="wallpaperFile" accept="image/jpeg,image/png,image/webp">
        <span>${c.uploadPhoto}</span></label></div>
    <p class="wallpaper-hint">${c.imageHint}</p>
    <button class="schedule-text-button" type="button" data-action="schedule-wallpaper-clear"${image ? '' : ' hidden'}>${c.removePhoto}</button>
    <div class="wallpaper-rules"><label class="field">${c.timing}<select name="wallpaperTiming">
      <option value="day"${wallpaper?.timing !== 'upcoming' ? ' selected' : ''}>${c.dayOnly}</option>
      <option value="upcoming"${wallpaper?.timing === 'upcoming' ? ' selected' : ''}>${c.upcoming}</option>
    </select></label>
    <label class="field">${c.priority}<input type="number" name="wallpaperPriority" min="1" max="10" step="1" value="${esc(wallpaper?.priority ?? 1)}"></label></div>
    <p class="wallpaper-hint">${c.orderHint}</p></fieldset>`;
}

function editor(exam, busy, photoPreviews) {
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
      ${wallpaperFields(exam, photoPreviews)}
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
  selectedId, busy = false, error = '', notice = '', dirty = false, preview = false, tokenRequired = false, conflict = false, photoPreviews
} = {}) {
  const c = words();
  const exam = plan.exams.find(item => item.id === selectedId) || plan.exams[0];
  return `<section class="schedule-screen schedule-planner" aria-labelledby="schedule-heading" aria-busy="${busy}">
    <header class="schedule-page-heading"><div><p class="schedule-month">${monthText()}</p><h1 id="schedule-heading">${c.title}</h1></div>
      <button type="button" class="button secondary small" data-action="schedule-logout"${disabled(busy)}>${c.logout}</button></header>
    <div class="schedule-layout">${subjectList(plan.exams, exam?.id, busy)}${editor(exam, busy, photoPreviews)}</div>
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
