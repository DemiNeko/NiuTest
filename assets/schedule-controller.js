import { t } from './i18n.js';
import { createExam, createSchedule, publicSchedule, validateSchedule, validatePublicSchedule, selectExamBackground, scheduleToday } from './schedule-model.js';
import { readRemote, writeRemote, openPlan, sealPlan, openCredential, sealCredential } from './schedule-storage.js';
import { prepareSchedulePhoto } from './schedule-photo.js';
import { renderScheduleLogin, renderSchedulePlanner, renderPublicSchedule, refreshScheduleSummary, renderExamBackgroundHeader, refreshExamWallpaperPreview } from './schedule-view.js';

// Never include the device credential in NiuTest's learner-data exports.
const deviceKey = 'NiuTest.schedule.device.v1';
let published = null, configured = false, loadFailed = false;
let session = null, selection = '', dirty = false, preview = false, busy = false;
let errorText = '', notice = '', conflict = false;
let checkedMinute = -1, lastPaint = '';

function errorMessage(error) {
  switch (error.code) {
    case 'password': return t("Неверный пароль. Попробуйте ещё раз.");
    case 'auth': return t("GitHub отклонил доступ. Проверьте срок токена и право записи в репозиторий NiuTest.");
    case 'conflict': return t("Расписание уже изменилось. Скопируйте нужные правки и загрузите последнюю версию.");
    case 'unavailable': return t("GitHub недоступен. Проверьте соединение и попробуйте ещё раз.");
    case 'crypto': return t("Для входа откройте сайт по HTTPS в современном браузере.");
    case 'photo-type': return t("Выберите изображение JPG, PNG или WebP.");
    case 'photo-size': return t("Изображение слишком большое. Выберите файл до 12 МБ и 50 мегапикселей.");
    case 'photo-decode': return t("Не удалось прочитать изображение. Выберите другой файл.");
    default: return t("Не удалось прочитать или сохранить расписание. Проверьте данные и попробуйте ещё раз.");
  }
}

export async function loadScheduleDocument() {
  try {
    const response = await fetch(new URL('../src/december-schedule.json', import.meta.url), { cache: 'no-store' });
    if (!response.ok) throw new Error();
    const file = await response.json();
    published = validatePublicSchedule(file.public);
    configured = file.configured ?? Boolean(file.vault);
    loadFailed = false;
  } catch { loadFailed = true; }
  refresh();
  refreshBackdrop();
}

export function scheduleBackdrop() {
  return published?.visible ? renderPublicSchedule(published) : '';
}

function refreshBackdrop() {
  const host = document.getElementById('schedule-backdrop');
  if (host) host.innerHTML = scheduleBackdrop();
  updateExamBackground(true);
}

export function updateExamBackground(force = false) {
  const minute = Math.floor(Date.now() / 60_000);
  if (!force && minute === checkedMinute) return;
  checkedMinute = minute;
  const heading = document.getElementById('exam-background-heading');
  if (!heading) return;
  const today = scheduleToday();
  const winner = selectExamBackground(published?.backgrounds || [], today);
  const signature = JSON.stringify([today, winner]);
  if (!force && signature === lastPaint) return;
  lastPaint = signature;
  const main = heading.closest('.catalog-main');
  main.classList.toggle('exam-wallpaper-active', Boolean(winner));
  main.querySelector('.exam-wallpaper-surface')?.remove();
  heading.innerHTML = winner ? renderExamBackgroundHeader(winner, today) : '';
  if (!winner) return;

  const surface = document.createElement('div');
  surface.className = 'exam-wallpaper-surface';
  surface.setAttribute('aria-hidden', 'true');
  if (winner.image) {
    const img = document.createElement('img');
    img.alt = '';
    img.referrerPolicy = 'no-referrer';
    img.onerror = () => img.remove();
    img.src = session?.photoPreviews.get(winner.image) || winner.image;
    surface.append(img);
  }
  main.prepend(surface);
}

export function scheduleScreen() {
  if (!published && !session) {
    return `<section class="panel" role="status"><p>${loadFailed ? t("Не удалось загрузить расписание.") : t("Загружаем расписание…")}</p>
      ${loadFailed ? `<button data-action="schedule-reload" class="button secondary">${t("Повторить загрузку")}</button>` : ''}</section>`;
  }
  if (!session) return renderScheduleLogin({ busy, setup: !configured, tokenRequired: !configured, error: errorText });
  return renderSchedulePlanner(session.plan, {
    selectedId: selection, dirty, preview, busy, error: errorText, notice, conflict,
    tokenRequired: !session.token, photoPreviews: session.photoPreviews
  });
}

function refresh(focusSelector) {
  const root = document.getElementById('schedule-workspace');
  if (!root) return;
  root.innerHTML = scheduleScreen();
  const tokenBox = root.querySelector('#schedule-publish-token');
  if (tokenBox && session) tokenBox.value = session.pendingToken;
  const remember = root.querySelector('#schedule-remember-token');
  if (remember && session) remember.checked = session.remember;
  if (focusSelector) root.querySelector(focusSelector)?.focus({ preventScroll: true });
}

function beginSession(plan, sha, password, token) {
  session = { plan, sha, password, token, pendingToken: '', remember: false, photos: new Map(), photoPreviews: new Map() };
  selection = plan.exams[0]?.id || '';
  preview = dirty = conflict = false;
  configured = true;
}

async function deviceCredential(password) {
  try {
    const encrypted = localStorage.getItem(deviceKey);
    return encrypted ? await openCredential(JSON.parse(encrypted), password) : '';
  } catch { return ''; }
}

async function rememberCredential(token, password) {
  try {
    const encrypted = await sealCredential(token, password);
    localStorage.setItem(deviceKey, JSON.stringify(encrypted));
  } catch { notice = t("Вход выполнен. Браузер не смог запомнить подключение на этом устройстве."); }
}

export async function scheduleLogin(form) {
  if (busy || session || !form.reportValidity()) return;
  const values = new FormData(form);
  const password = String(values.get('password') || '');
  let token = String(values.get('token') || '').trim();
  const setup = !configured;
  if (setup && (password.length < 12 || password !== values.get('confirm') || !token)) {
    errorText = t("Введите токен и дважды укажите одинаковый пароль длиной от 12 символов.");
    return refresh('[name=password]');
  }
  errorText = notice = '';
  busy = true;
  refresh();
  try {
    let latest;
    if (token) latest = await readRemote(token);
    else {
      token = await deviceCredential(password);
      try { latest = await readRemote(token || undefined); }
      catch (error) {
        if (!token || error.code !== 'auth') throw error;
        token = '';
        try { localStorage.removeItem(deviceKey); } catch { /* Continue with password-only access. */ }
        latest = await readRemote();
      }
    }
    let { record, sha } = latest;
    if (setup !== (record.vault === null)) {
      configured = record.vault !== null;
      throw Object.assign(new Error(), { code: 'state' });
    }
    let plan;
    if (setup) {
      plan = createSchedule();
      const initial = { version: 1, public: publicSchedule(plan), vault: await sealPlan(plan, password) };
      ({ sha, record } = await writeRemote(token, sha, initial));
    } else {
      plan = await openPlan(record.vault, password);
    }
    beginSession(plan, sha, password, token);
    published = record.public;
    if (token && values.has('remember')) await rememberCredential(token, password);
    refreshBackdrop();
  } catch (error) {
    errorText = error.code === 'state' ? t("Настройки входа обновились. Войдите ещё раз.") : errorMessage(error);
  } finally {
    busy = false;
    refresh(session ? '[data-action="schedule-select"][aria-current="true"]' : '[name=password]');
  }
}

function markDirty() {
  dirty = true;
  notice = '';
  if (!conflict) errorText = '';
  const save = document.querySelector('#schedule-workspace [data-action="schedule-save"]');
  if (save && !busy) save.disabled = false;
  const mark = document.querySelector('#schedule-workspace .schedule-dirty');
  if (mark) mark.hidden = false;
  document.querySelector('#schedule-workspace .schedule-message[role="status"]')?.remove();
  if (!errorText) document.querySelector('#schedule-workspace .schedule-message[role="alert"]')?.remove();
}

function wallpaperFor(exam) {
  return exam.wallpaper ??= { enabled: false, image: '', priority: 1, timing: 'day' };
}

function dropUnusedPhotos() {
  const used = new Set(session.plan.exams.map(exam => exam.wallpaper?.image));
  for (const path of session.photoPreviews.keys()) {
    if (!used.has(path)) {
      session.photos.delete(path);
      session.photoPreviews.delete(path);
    }
  }
}

async function choosePhoto(exam, file) {
  if (!file) return;
  busy = true;
  errorText = notice = '';
  refresh();
  try {
    const photo = await prepareSchedulePhoto(file);
    wallpaperFor(exam).image = photo.path;
    session.photos.set(photo.path, photo);
    session.photoPreviews.set(photo.path, photo.previewUrl);
    dropUnusedPhotos();
    markDirty();
  } catch (error) { errorText = errorMessage(error); }
  finally { busy = false; refresh('[name=wallpaperFile]'); }
}

function updateWallpaper(input, exam, change) {
  if (input.name === 'wallpaperFile') { if (change) return choosePhoto(exam, input.files[0]); return; }
  const wallpaper = wallpaperFor(exam);
  switch (input.name) {
    case 'wallpaperEnabled': wallpaper.enabled = input.checked; break;
    case 'wallpaperUrl': wallpaper.image = input.value.trim(); dropUnusedPhotos(); break;
    case 'wallpaperPriority': wallpaper.priority = input.valueAsNumber; break;
    case 'wallpaperTiming': wallpaper.timing = input.value; break;
    default: return;
  }
  markDirty();
  if (change) refreshExamWallpaperPreview(document.getElementById('schedule-workspace'), exam, session.photoPreviews);
}

export function scheduleInput(input, change) {
  if (busy || !session) return;
  if (input.id === 'schedule-publish-token') { session.pendingToken = input.value.trim(); return; }
  if (input.id === 'schedule-remember-token') { session.remember = input.checked; return; }
  if (input.id === 'schedule-subject-picker') {
    if (change && session.plan.exams.some(exam => exam.id === input.value)) {
      selection = input.value; refresh('#schedule-subject-picker');
    }
    return;
  }
  if (input.id === 'schedule-visible') {
    if (!change) return;
    session.plan.visible = input.checked;
    markDirty();
    return refresh('#schedule-visible');
  }
  const row = session.plan.exams.find(exam => exam.id === selection);
  if (!row || !input.closest('#schedule-edit-form')) return;
  if (input.name.startsWith('wallpaper')) return updateWallpaper(input, row, change);
  if (input.name === 'projectExam') {
    if (change && row.projectExam !== input.checked) {
      row.projectExam = input.checked;
      markDirty();
    }
    return;
  }
  if (input.hasAttribute('data-schedule-check')) {
    if (!change) return;
    const index = Number(input.dataset.scheduleCheck);
    if (Number.isInteger(index) && index >= 0 && index < row.checks.length) {
      row.checks[index] = input.checked;
      markDirty();
      refresh(`[data-schedule-check="${index}"]`);
    }
  } else if (['title', 'date', 'time', 'room'].includes(input.name)) {
    if (row[input.name] !== input.value) {
      row[input.name] = input.value;
      markDirty();
    }
    if (change) {
      const root = document.getElementById('schedule-workspace');
      refreshScheduleSummary(root, session.plan, selection, preview);
      if (['title', 'date'].includes(input.name)) refreshExamWallpaperPreview(root, row, session.photoPreviews);
    }
  }
}

function checkedPlan() {
  for (const exam of session.plan.exams) {
    try { validateSchedule({ ...session.plan, exams: [exam] }); }
    catch {
      selection = exam.id;
      errorText = t("Проверьте поля экзамена, ссылку на изображение и приоритет от 1 до 10.");
      refresh();
      document.getElementById('schedule-edit-form')?.reportValidity();
      return null;
    }
  }
  return validateSchedule(session.plan);
}

async function saveSchedule() {
  const plan = checkedPlan();
  if (!plan) return;
  const token = session.pendingToken || session.token;
  if (!token) { errorText = t("Для сохранения введите токен GitHub с правом записи."); return refresh('#schedule-publish-token'); }
  const remember = document.getElementById('schedule-remember-token')?.checked;
  busy = true;
  errorText = notice = '';
  refresh();
  try {
    const record = { version: 1, public: publicSchedule(plan), vault: await sealPlan(plan, session.password) };
    dropUnusedPhotos();
    const result = await writeRemote(token, session.sha, record, [...session.photos.values()]);
    session.photos.clear();
    session.sha = result.sha;
    session.plan = plan;
    session.token = token;
    session.pendingToken = '';
    published = record.public;
    dirty = conflict = false;
    notice = t("Сохранено. GitHub Pages обновит главную страницу после публикации.");
    if (remember) await rememberCredential(token, session.password);
    refreshBackdrop();
  } catch (error) {
    if (error.code === 'auth') { session.token = session.pendingToken = ''; }
    conflict = error.code === 'conflict';
    errorText = errorMessage(error);
  } finally { busy = false; refresh('[data-action="schedule-save"]'); }
}

async function reloadSchedule() {
  busy = true;
  errorText = notice = '';
  refresh();
  try {
    const { sha, record } = await readRemote(session.token || undefined);
    const plan = await openPlan(record.vault, session.password);
    beginSession(plan, sha, session.password, session.token);
    published = record.public;
    refreshBackdrop();
  } catch (error) { errorText = errorMessage(error); }
  finally { busy = false; refresh(); }
}

export async function scheduleAction(action, target, confirmAction) {
  if (busy) return;
  if (action === 'schedule-reload' && !session) return loadScheduleDocument();
  if (!session) return;
  const plan = session.plan;
  if (action === 'schedule-save') return saveSchedule();
  if (action === 'schedule-wallpaper-clear') {
    const exam = plan.exams.find(row => row.id === selection);
    if (exam?.wallpaper?.image) {
      exam.wallpaper.image = '';
      dropUnusedPhotos(); markDirty(); refresh('[name=wallpaperUrl]');
    }
    return;
  }
  if (action === 'schedule-select') {
    selection = target.dataset.id;
    refresh(`[data-action="schedule-select"][data-id="${CSS.escape(selection)}"]`);
  }
  if (action === 'schedule-preview') {
    if (!preview && !checkedPlan()) return;
    preview = !preview; refresh('[data-action="schedule-preview"]');
  }
  if (action === 'schedule-add') {
    const exam = createExam(crypto.randomUUID(), t("Новый предмет"));
    plan.exams.push(exam);
    selection = exam.id; markDirty(); refresh('#schedule-edit-form [name="title"]');
    document.querySelector('#schedule-edit-form [name="title"]')?.select();
  }
  if (action === 'schedule-delete') {
    const index = plan.exams.findIndex(row => row.id === selection);
    if (index < 0) return;
    confirmAction(t("Удалить экзамен?"), plan.exams[index].title, t("Удалить"), () => {
      plan.exams.splice(index, 1);
      dropUnusedPhotos();
      selection = plan.exams[Math.min(index, plan.exams.length - 1)]?.id || '';
      markDirty(); refresh('[data-action="schedule-add"]');
    });
  }
  if (action === 'schedule-reload' || action === 'schedule-logout') {
    const execute = () => {
      if (action === 'schedule-reload') return reloadSchedule();
      session = null; dirty = preview = conflict = false; selection = errorText = notice = '';
      refresh('[name=password]');
    };
    if (dirty) confirmAction(t("Отбросить несохранённые изменения?"), t("На сайте останется последняя сохранённая версия."), t("Продолжить"), execute);
    else execute();
  }
}

window.addEventListener('beforeunload', event => {
  if (dirty || busy) { event.preventDefault(); event.returnValue = ''; }
});
