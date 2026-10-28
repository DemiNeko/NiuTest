import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseExam } from '../assets/exam-format.js';
export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export async function validateCatalog() {
  const manifest = JSON.parse(await readFile(resolve(root, 'src/exams/index.json'), 'utf8'));
  if (manifest.version !== 1 || !Array.isArray(manifest.exams)) throw new Error('Некорректный каталог экзаменов.');
  const exams = [], ids = new Set();
  for (const meta of manifest.exams) {
    if (!/^[a-zA-Z0-9_-]+\.json$/.test(meta.file)) throw new Error(`Недопустимый путь: ${meta.file}`);
    const raw = JSON.parse(await readFile(resolve(root, 'src/exams', meta.file), 'utf8'));
    const result = parseExam({ ...meta, ...raw, id: meta.id });
    if (!result.exam) throw new Error(`${meta.id}: ${result.errors.join('\n')}`);
    if (ids.has(meta.id)) throw new Error(`Повторяющийся id экзамена: ${meta.id}`);
    if (meta.hidden === true) result.exam.hidden = true;
    ids.add(meta.id); exams.push(result.exam);
  }
  return { manifest, exams };
}
