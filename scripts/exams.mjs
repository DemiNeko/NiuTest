import { readFile, writeFile, rename, unlink } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { parseExam, isGradable } from '../assets/exam-format.js';
import { root, validateCatalog } from './catalog.mjs';
const [command, file, ...args] = process.argv.slice(2);
const option = name => { const index = args.indexOf(name); return index < 0 ? undefined : args[index + 1]; };
try {
  if (!['check', 'add'].includes(command) || !file) throw new Error('Использование: node scripts/exams.mjs check|add <file.json> [--id exam-id] [--title "Название"] [--replace]');
  const name = basename(file, '.json'), defaults = { id: option('--id') || name, title: option('--title') || name };
  const raw = await readFile(resolve(file), 'utf8');
  const result = parseExam(raw, defaults);
  if (!result.exam) throw new Error(result.errors.join('\n'));
  const exam = result.exam;
  for (const warning of result.warnings) console.log(`Предупреждение: ${warning}`);
  console.log(`${exam.title}: ${exam.questions.length} вопросов, ${exam.questions.filter(isGradable).length} с ключом. Проверка пройдена.`);
  if (command === 'add') {
    const { manifest } = await validateCatalog();
    const existing = manifest.exams.find(e => e.id === exam.id);
    if (existing?.id === 'ai-go') throw new Error('ID встроенного исходного экзамена зарезервирован. Сделайте копию с другим id.');
    if (existing && !args.includes('--replace')) throw new Error('Такой id уже существует. Для явного обновления используйте --replace.');
    const target = resolve(root, 'src/exams', `${exam.id}.json`), index = resolve(root, 'src/exams/index.json');
    let oldFile = null; try { oldFile = await readFile(target); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (!existing && oldFile) throw new Error('Файл с таким id уже есть вне каталога. Выберите другой id.');
    const next = { ...manifest, exams: manifest.exams.filter(e => e.id !== exam.id).concat({ id: exam.id, title: exam.title, file: `${exam.id}.json` }) };
    try {
      await writeFile(`${target}.tmp`, JSON.stringify(exam, null, 2) + '\n', 'utf8');
      await writeFile(`${index}.tmp`, JSON.stringify(next, null, 2) + '\n', 'utf8');
      await rename(`${target}.tmp`, target);
      await rename(`${index}.tmp`, index);
    } catch (error) {
      if (oldFile) await writeFile(target, oldFile); else await unlink(target).catch(() => {});
      throw error;
    } finally { await unlink(`${target}.tmp`).catch(() => {}); await unlink(`${index}.tmp`).catch(() => {}); }
    console.log(`Добавлен src/exams/${exam.id}.json. Выполните npm test и npm run build, затем опубликуйте изменения обычным способом.`);
  }
} catch (error) { console.error(error.message); process.exitCode = 1; }
