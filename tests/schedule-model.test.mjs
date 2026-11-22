import test from 'node:test';
import assert from 'node:assert/strict';
import { CHECK_LABELS, SUBJECTS, createExam, createSchedule, validateSchedule, publicSchedule, validatePublicSchedule, validWallpaperImage, scheduleToday, selectExamBackground } from '../assets/schedule-model.js';

test('weekly timetable seeds six independent undated exams and retains the 17 teaching slots', () => {
  const plan = createSchedule();
  assert.deepEqual(validateSchedule(plan), plan);
  assert.equal(plan.visible, false);
  assert.equal(plan.exams.length, 6);
  assert.ok(plan.exams.every(row => row.date === '' && row.time === '' && row.room === ''));
  assert.equal(CHECK_LABELS[1], 'Материалы добавлены');
  for (const row of plan.exams) {
    const hasMaterials = ['ai', 'testing', 'parallel'].includes(row.id);
    assert.deepEqual(row.checks, [false, hasMaterials, false, false]);
    assert.equal(row.projectExam, false);
  }
  // An admin can revise the initial inventory and persist that decision.
  const testing = plan.exams.find(row => row.id === 'testing');
  testing.checks[1] = false;
  assert.deepEqual(validateSchedule(plan).exams.find(row => row.id === 'testing').checks, [false, false, false, false]);
  assert.equal(SUBJECTS.flatMap(subject => subject.slots).length, 17);
  const english = SUBJECTS.find(subject => subject.id === 'academic-english');
  assert.deepEqual(english.slots.map(({ day, start, room }) => [day, start, room]), [[1, '09:00', '502'], [1, '10:00', '502'], [1, '11:00', '120']]);
  plan.exams[0].checks[0] = true;
  assert.equal(plan.exams[1].checks[0], false);
  assert.equal(createSchedule().exams[0].checks[0], false);
});

test('older plans preserve readiness and gain a separate private project exam flag', () => {
  const legacy = { id: 'course', title: 'Предмет', date: '2026-12-07', time: '11:00', room: '120', checks: [true, false, true, false] };
  const plan = validateSchedule({ ...createSchedule(), visible: true, exams: [legacy] });
  assert.deepEqual(plan.exams[0], { ...legacy, projectExam: false, wallpaper: null });
  const publicBefore = publicSchedule(plan);
  for (const projectExam of [true, false]) {
    plan.exams[0].projectExam = projectExam;
    assert.deepEqual(validateSchedule(plan).exams[0], { ...legacy, projectExam, wallpaper: null });
    assert.deepEqual(publicSchedule(plan), publicBefore);
  }
  const output = publicBefore.exams[0];
  assert.equal(Object.hasOwn(output, 'projectExam'), false);
  assert.throws(() => validatePublicSchedule({ ...publicBefore, exams: [{ ...output, projectExam: true }] }));
  for (const value of [null, 1, 'true']) {
    assert.throws(() => validateSchedule({ ...plan, exams: [{ ...legacy, projectExam: value }] }));
  }
});

test('published output contains dated exams only and drops all dates while hidden', () => {
  const plan = createSchedule();
  Object.assign(plan.exams[0], { date: '2026-12-18', time: '10:30', room: '417', checks: CHECK_LABELS.map(() => true) });
  Object.assign(plan.exams[1], { date: '2026-12-01', time: '09:00' });
  Object.assign(plan.exams[2], { date: '2026-12-01' });
  Object.assign(plan.exams[3], { date: '2026-12-01', time: '08:30' });
  assert.deepEqual(publicSchedule(plan).exams, []);
  plan.visible = true;
  const output = publicSchedule(plan);
  assert.deepEqual(output.exams.map(e => e.id), ['mobile', 'academic-english', 'parallel', 'e-business']);
  assert.deepEqual(output.exams.at(-1), { id: 'e-business', title: plan.exams[0].title, date: '2026-12-18', time: '10:30', room: '417' });
  assert.deepEqual(validatePublicSchedule(output), output);
  assert.equal(plan.exams[0].checks[3], true);
  plan.visible = false;
  assert.deepEqual(publicSchedule(plan), { version: 1, month: '2026-12', visible: false, exams: [] });
  assert.throws(() => validatePublicSchedule({ ...output, visible: false }));
  assert.throws(() => validatePublicSchedule({ ...output, exams: [{ ...output.exams[0], checks: plan.exams[0].checks }] }));
});

test('edited and custom subjects allow shared time slots, separate IDs and removal of the last row', () => {
  const plan = createSchedule();
  const original = createExam('first', '  Первый предмет ');
  const extra = createExam('second', 'Екінші пән');
  plan.exams = [original, extra];
  for (const exam of plan.exams) Object.assign(exam, { date: '2026-12-31', time: '23:59', room: '  212  ' });
  const edited = validateSchedule(plan);
  assert.equal(edited.exams[0].title, 'Первый предмет');
  assert.equal(edited.exams[1].room, '212');
  assert.notEqual(edited.exams[0].checks, original.checks);
  assert.deepEqual(validateSchedule({ ...plan, exams: [] }).exams, []);
  assert.throws(() => validateSchedule({ ...plan, exams: [original, original] }));
});

test('validation rejects malformed dates, times, identifiers, checklist entries and unexpected fields', () => {
  const plan = createSchedule();
  const check = fields => validateSchedule({ ...plan, exams: [{ ...plan.exams[0], ...fields }] });
  for (const date of [null, '2026-12-0', '2026-12-00', '2026-12-32', '2026-11-30', '2025-12-02']) assert.throws(() => check({ date }));
  for (const time of [null, '8:00', '24:00', '10:60']) assert.throws(() => check({ time }));
  for (const fields of [{ checks: [true] }, { checks: [true, false, false, 1] }, { id: '../123' }, { id: '' }, { title: '  ' }, { room: 417 }, { note: 'unexpected' }]) assert.throws(() => check(fields));
  for (const fields of [{ version: 2 }, { month: '2026-01' }, { visible: 'true' }, { exams: null }, { draft: true }]) assert.throws(() => validateSchedule({ ...plan, ...fields }));
});

test('public wallpapers are independent of the calendar list; disabled, undated and private fields stay out', () => {
  const plan = createSchedule();
  const image = './src/images/schedule/' + 'a'.repeat(64) + '.webp';
  const options = { image, priority: 3, timing: 'day', enabled: true };
  Object.assign(plan.exams[0], { date: '2026-12-07', wallpaper: options, room: '417', projectExam: true });
  plan.exams[1].wallpaper = options;
  Object.assign(plan.exams[2], { date: '2026-12-08', wallpaper: { ...options, enabled: false } });
  const expected = [{ id: plan.exams[0].id, title: plan.exams[0].title, date: '2026-12-07', image, priority: 3, timing: 'day' }];
  assert.deepEqual(validateSchedule(plan), plan);
  assert.notEqual(validateSchedule(plan).exams[0].wallpaper, options);
  const hidden = publicSchedule(plan);
  assert.deepEqual(hidden.exams, []);
  assert.deepEqual(hidden.backgrounds, expected);
  assert.deepEqual(validatePublicSchedule(hidden), hidden);
  plan.visible = true;
  assert.deepEqual(publicSchedule(plan).backgrounds, expected);
  assert.ok(publicSchedule(plan).exams.every(row => !Object.hasOwn(row, 'wallpaper')));
  for (const fields of [{ enabled: true }, { checks: [] }, { date: '' }, { priority: 15 }, { timing: 'always' }, { image: 'data:image/png;base64,A' }]) {
    assert.throws(() => validatePublicSchedule({ ...hidden, backgrounds: [{ ...expected[0], ...fields }] }));
  }
  assert.throws(() => validatePublicSchedule({ ...hidden, backgrounds: [...expected, ...expected] }));
  for (const wallpaper of [{ ...options, enabled: 'false' }, { ...options, timing: '' }, { ...options, priority: 1.2 }, { ...options, extra: 'value' }, {}]) {
    assert.throws(() => validateSchedule({ ...plan, exams: [{ ...plan.exams[0], wallpaper }] }));
  }
});

test('image sources are HTTPS links without credentials or local content-addressed WebP images', () => {
  const digest = 'a3'.repeat(32);
  for (const image of ['', 'https://cdn.example.org/a.webp', 'https://images.example/test?size=3', './src/images/schedule/' + digest + '.webp']) {
    assert.equal(validWallpaperImage(image), true, image);
  }
  for (const image of [null, false, 'https://', 'http://example.org/a.jpg', 'data:image/png;base64,AAA=', 'blob:https://example.org/id', 'javascript:alert(1)', 'https://user:pw@example.org/a', 'https://@example.org/a', 'https://examp\nle.org/a', '//example.org/a', '/assets/a.webp', './src/images/schedule/../' + digest + '.webp', './src/images/schedule/test.webp']) {
    assert.equal(validWallpaperImage(image), false, String(image));
  }
});

test('wallpaper selection chooses today before nearest upcoming, then priority and a stable ID', () => {
  const rows = [
    { id: 'past', date: '2026-12-03', priority: 9, timing: 'upcoming' },
    { id: 'day-only', date: '2026-12-09', priority: 9, timing: 'day' },
    { id: 'later', date: '2026-12-16', priority: 10, timing: 'upcoming' },
    { id: 'low', date: '2026-12-11', priority: 1, timing: 'upcoming' },
    { id: 'zzz', date: '2026-12-11', priority: 3, timing: 'upcoming' },
    { id: 'aaa', date: '2026-12-11', priority: 3, timing: 'upcoming' }
  ];
  assert.equal(selectExamBackground(rows, '2026-12-07').id, 'aaa');
  assert.equal(selectExamBackground(rows.toReversed(), '2026-12-07').id, 'aaa');
  assert.equal(selectExamBackground(rows, '2026-12-09').id, 'day-only');
  assert.equal(selectExamBackground(rows, '2026-12-11').id, 'aaa');
  assert.equal(selectExamBackground(rows, '2026-12-17'), null);
  assert.equal(selectExamBackground([rows[1]], '2026-12-08'), null);
  assert.equal(selectExamBackground(undefined, '2026-12-07'), null);
  assert.equal(scheduleToday(new Date('2026-12-08T18:59:59Z')), '2026-12-08');
  assert.equal(scheduleToday(new Date('2026-12-08T19:00:00Z')), '2026-12-09');
});
