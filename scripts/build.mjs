import { mkdir, copyFile, cp, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { root, validateCatalog } from './catalog.mjs';
import { validateSiteConfig } from '../assets/site-config.js';
import { checkedRecord } from '../assets/schedule-storage.js';
const schedule = checkedRecord(JSON.parse(await readFile('src/december-schedule.json', 'utf8')));
validateSiteConfig(JSON.parse(await readFile('src/site.json', 'utf8')));
const { exams } = await validateCatalog();
console.log(`Validated ${exams.length} exams / ${exams.reduce((n, e) => n + e.questions.length, 0)} questions`);
// Only the generated dist directory of this checkout may be cleared.
if (resolve('dist') !== resolve(root, 'dist')) throw new Error('Run the build from the repository root.');
await rm(resolve(root, 'dist'), { recursive: true, force: true });
await mkdir('dist', { recursive: true });
for (const file of ['index.html', '.nojekyll']) await copyFile(file, `dist/${file}`);
await cp('assets', 'dist/assets', { recursive: true });
await cp('src', 'dist/src', { recursive: true });
// The public Pages artifact needs only the calendar entries and the login state.
await writeFile('dist/src/december-schedule.json', JSON.stringify({ public: schedule.public, configured: schedule.vault !== null }));
console.log('Static site ready in dist/');
