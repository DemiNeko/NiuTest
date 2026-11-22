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
  return { id, title, date: '', time: '', room: '', checks: CHECK_LABELS.map(() => false) };
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

function hasFields(value, fields) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).length === fields.length && fields.every(field => Object.hasOwn(value, field));
}

function readExam(row, isPublic) {
  const fields = ['id', 'title', 'date', 'time', 'room'];
  if (!hasFields(row, isPublic ? fields : [...fields, 'checks'])) throw new Error('Проверьте поля экзамена.');
  if (typeof row.id !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(row.id)) throw new Error('Некорректный идентификатор экзамена.');
  if (typeof row.title !== 'string' || !row.title.trim() || row.title.length > 200) throw new Error('Укажите название предмета длиной до 200 символов.');
  if (typeof row.date !== 'string' || !(row.date === '' && !isPublic || /^2026-12-(0[1-9]|[12]\d|3[01])$/.test(row.date))) {
    throw new Error('Выберите дату в декабре 2026 года.');
  }
  if (typeof row.time !== 'string' || row.time !== '' && !/^([01]\d|2[0-3]):[0-5]\d$/.test(row.time)) throw new Error('Укажите время от 00:00 до 23:59.');
  if (typeof row.room !== 'string' || row.room.length > 160) throw new Error('Укажите место проведения длиной до 160 символов.');
  const exam = { id: row.id, title: row.title.trim(), date: row.date, time: row.time, room: row.room.trim() };
  if (!isPublic) {
    if (!Array.isArray(row.checks) || row.checks.length !== CHECK_LABELS.length ||
        !Array.from(row.checks).every(check => typeof check === 'boolean')) throw new Error('Проверьте отметки готовности предмета.');
    exam.checks = [...row.checks];
  }
  return exam;
}

function readSchedule(raw, isPublic) {
  if (!hasFields(raw, ['version', 'month', 'visible', 'exams']) ||
      raw.version !== 1 || raw.month !== MONTH || typeof raw.visible !== 'boolean' || !Array.isArray(raw.exams)) {
    throw new Error('Нужен файл расписания на декабрь 2026 года.');
  }
  if (isPublic && !raw.visible && raw.exams.length) throw new Error('Скрытое расписание должно быть пустым.');
  const exams = Array.from(raw.exams, row => readExam(row, isPublic));
  if (new Set(exams.map(exam => exam.id)).size !== exams.length) throw new Error('У каждого экзамена должен быть свой идентификатор.');
  return { version: 1, month: MONTH, visible: raw.visible, exams };
}

export const validateSchedule = raw => readSchedule(raw, false);
export const validatePublicSchedule = raw => readSchedule(raw, true);

export function publicSchedule(raw) {
  const { version, month, visible, exams } = validateSchedule(raw);
  if (!visible) return { version, month, visible, exams: [] };
  const dated = exams.filter(exam => exam.date).map(({ id, title, date, time, room }) => ({ id, title, date, time, room }));
  dated.sort((a, b) => a.date.localeCompare(b.date) || (a.time || '24:00').localeCompare(b.time || '24:00') || a.title.localeCompare(b.title, 'kk'));
  return { version, month, visible, exams: dated };
}
