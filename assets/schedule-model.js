export const MONTH = '2026-12';
export const CHECK_LABELS = [
  'Дата и аудитория подтверждены',
  'Материалы добавлены',
  'Ответы проверены',
  'Экзамен завершён'
];

// The supplied weekly teaching timetable contains fifty-minute classes.
// Day 1 is Monday. Exam dates, rooms and times are set separately by the admin.
function slot(day, hour, room, teacher, type) {
  const startHour = String(hour).padStart(2, '0');
  return { day, start: startHour + ':00', end: startHour + ':50', room, teacher, type };
}

export const SUBJECTS = [
  {
    id: 'e-business', title: 'Электронды бизнес',
    slots: [
      slot(1, 8, '417', 'Абдибекова Л.М.', 'Дәріс'),
      slot(4, 9, '402', 'Саурыков Е.М.', 'Семинар'),
      slot(4, 10, '402', 'Саурыков Е.М.', 'Семинар')
    ]
  },
  {
    id: 'academic-english', title: 'Академиялық ағылшын тілі',
    slots: [
      slot(1, 9, '502', 'Садуакасова А.Б.', ''),
      slot(1, 10, '502', 'Садуакасова А.Б.', ''),
      slot(1, 11, '120', 'Садуакасова А.Б.', '')
    ]
  },
  {
    id: 'parallel', title: 'Параллельді және үлестірілген есептеулер',
    slots: [
      slot(2, 8, '212', 'Алимагамбетова А.З.', 'Дәріс'),
      slot(2, 9, '405', 'Несіпбай Ұ.Д.', 'Семинар'),
      slot(2, 10, '405', 'Несіпбай Ұ.Д.', 'Семинар')
    ]
  },
  {
    id: 'mobile', title: 'Мобильді қосымшаларды жобалау және әзірлеу',
    slots: [
      slot(2, 11, '417', 'Ахметова-Әбдік Г.А.', 'Дәріс'),
      slot(3, 13, '417', 'Ахметова-Әбдік Г.А.', 'Семинар'),
      slot(3, 14, '417', 'Ахметова-Әбдік Г.А.', 'Семинар')
    ]
  },
  {
    id: 'testing', title: 'Бағдарламалық қамтамасыз етуді тестілеу',
    slots: [
      slot(3, 11, '417', 'Сексембаева М.А.', 'Семинар'),
      slot(3, 12, '417', 'Сексембаева М.А.', 'Семинар'),
      slot(4, 11, '417', 'Сексембаева М.А.', 'Дәріс')
    ]
  },
  {
    id: 'ai', title: 'Жасанды интеллект жүйелері',
    slots: [
      slot(5, 8, '417', 'Кешімбек Д.Х.', 'Семинар'),
      slot(5, 9, '417', 'Кешімбек Д.Х.', 'Семинар')
    ]
  }
];

export function createExam(id, title) {
  return { id, title, date: '', time: '', room: '', checks: CHECK_LABELS.map(() => false), projectExam: false, wallpaper: null };
}

export function createSchedule() {
  const subjectsWithMaterials = new Set(['ai', 'parallel', 'testing']);
  return {
    version: 1, month: MONTH, visible: false,
    exams: SUBJECTS.map(({ id, title }) => {
      const exam = createExam(id, title);
      exam.checks[1] = subjectsWithMaterials.has(id);
      return exam;
    })
  };
}

function hasFields(value, fields, optional = []) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) &&
    fields.every(field => Object.hasOwn(value, field)) &&
    Object.keys(value).every(key => fields.includes(key) || optional.includes(key));
}

function readSubject(row, allowUndated) {
  if (typeof row.id !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(row.id)) throw new Error('Некорректный идентификатор экзамена.');
  if (typeof row.title !== 'string' || !row.title.trim() || row.title.length > 200) throw new Error('Укажите название предмета длиной до 200 символов.');
  if (typeof row.date !== 'string' || !(row.date === '' && allowUndated || /^2026-12-(0[1-9]|[12]\d|3[01])$/.test(row.date))) {
    throw new Error('Выберите дату в декабре 2026 года.');
  }
  return { id: row.id, title: row.title.trim(), date: row.date };
}

export function validWallpaperImage(value) {
  if (value === '') return true;
  if (typeof value !== 'string' || value.length > 4096 || /[\s\\\x00-\x1f\x7f]/.test(value)) return false;
  if (/^\.\/src\/images\/schedule\/[a-f0-9]{64}\.webp$/.test(value)) return true;
  if (!/^https:\/\/[^/?#@]+(?:[/?#]|$)/i.test(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && Boolean(url.hostname) && !url.username && !url.password;
  } catch { return false; }
}

function readAppearance(wallpaper) {
  const { image, priority, timing } = wallpaper;
  if (!validWallpaperImage(image)) throw new Error('Выберите загруженную картинку или укажите ссылку HTTPS.');
  if (!Number.isInteger(priority) || priority < 1 || priority > 10) throw new Error('Выберите приоритет фона от 1 до 10.');
  if (timing !== 'day' && timing !== 'upcoming') throw new Error('Выберите период показа фона.');
  return { image, priority, timing };
}

function readExam(row, isPublic) {
  const fields = ['id', 'title', 'date', 'time', 'room'];
  if (!isPublic) fields.push('checks');
  if (!hasFields(row, fields, isPublic ? [] : ['projectExam', 'wallpaper'])) throw new Error('Проверьте поля экзамена.');
  const subject = readSubject(row, !isPublic);
  if (typeof row.time !== 'string' || row.time !== '' && !/^([01]\d|2[0-3]):[0-5]\d$/.test(row.time)) throw new Error('Укажите время от 00:00 до 23:59.');
  if (typeof row.room !== 'string' || row.room.length > 160) throw new Error('Укажите место проведения длиной до 160 символов.');
  const exam = { ...subject, time: row.time, room: row.room.trim() };
  if (!isPublic) {
    if (!Array.isArray(row.checks) || row.checks.length !== CHECK_LABELS.length ||
        !Array.from(row.checks).every(check => typeof check === 'boolean')) throw new Error('Проверьте отметки готовности предмета.');
    exam.checks = [...row.checks];
    if (Object.hasOwn(row, 'projectExam') && typeof row.projectExam !== 'boolean') throw new Error('Проверьте отметку проектного экзамена.');
    exam.projectExam = row.projectExam ?? false;
    exam.wallpaper = null;
    if (Object.hasOwn(row, 'wallpaper') && row.wallpaper !== null) {
      const wallpaper = row.wallpaper;
      if (!hasFields(wallpaper, ['image', 'priority', 'timing', 'enabled']) || typeof wallpaper.enabled !== 'boolean') {
        throw new Error('Проверьте настройки фона экзамена.');
      }
      exam.wallpaper = { ...readAppearance(wallpaper), enabled: wallpaper.enabled };
    }
  }
  return exam;
}

function readSchedule(raw, isPublic) {
  if (!hasFields(raw, ['version', 'month', 'visible', 'exams'], isPublic ? ['backgrounds'] : []) ||
      raw.version !== 1 || raw.month !== MONTH || typeof raw.visible !== 'boolean' || !Array.isArray(raw.exams)) {
    throw new Error('Нужен файл расписания на декабрь 2026 года.');
  }
  if (isPublic && !raw.visible && raw.exams.length) throw new Error('Скрытое расписание должно быть пустым.');
  const exams = Array.from(raw.exams, row => readExam(row, isPublic));
  if (new Set(exams.map(exam => exam.id)).size !== exams.length) throw new Error('У каждого экзамена должен быть свой идентификатор.');
  const plan = { version: 1, month: MONTH, visible: raw.visible, exams };
  if (isPublic && Object.hasOwn(raw, 'backgrounds')) {
    if (!Array.isArray(raw.backgrounds)) throw new Error('Проверьте список фонов.');
    plan.backgrounds = Array.from(raw.backgrounds, row => {
      if (!hasFields(row, ['id', 'title', 'date', 'image', 'priority', 'timing'])) throw new Error('Проверьте поля фона экзамена.');
      return { ...readSubject(row, false), ...readAppearance(row) };
    });
    if (new Set(plan.backgrounds.map(item => item.id)).size !== plan.backgrounds.length) throw new Error('У каждого фона должен быть свой идентификатор.');
  }
  return plan;
}

export const validateSchedule = raw => readSchedule(raw, false);
export const validatePublicSchedule = raw => readSchedule(raw, true);

export function publicSchedule(raw) {
  const { version, month, visible, exams } = validateSchedule(raw);
  const dated = exams.filter(exam => exam.date);
  const output = { version, month, visible, exams: [] };
  if (visible) {
    output.exams = dated.map(({ id, title, date, time, room }) => ({ id, title, date, time, room }));
    output.exams.sort((a, b) => a.date.localeCompare(b.date) || (a.time || '24:00').localeCompare(b.time || '24:00') || a.title.localeCompare(b.title, 'kk'));
  }
  const backgrounds = dated.filter(exam => exam.wallpaper?.enabled).map(({ id, title, date, wallpaper }) => ({
    id, title, date, image: wallpaper.image, priority: wallpaper.priority, timing: wallpaper.timing
  }));
  if (backgrounds.length) output.backgrounds = backgrounds;
  return output;
}

const campusDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Qyzylorda', year: 'numeric', month: '2-digit', day: '2-digit'
});

export function scheduleToday(now = new Date()) {
  const parts = Object.fromEntries(campusDate.formatToParts(now).map(({ type, value }) => [type, value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function selectExamBackground(backgrounds = [], today = scheduleToday()) {
  const eligible = backgrounds.filter(item => item.date === today || (item.timing === 'upcoming' && item.date > today));
  eligible.sort((a, b) => a.date.localeCompare(b.date) || b.priority - a.priority || a.id.localeCompare(b.id, 'en'));
  return eligible[0] ?? null;
}
