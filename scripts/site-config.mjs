import { readFile, writeFile, rename } from 'node:fs/promises';
import { resolve } from 'node:path';
import { root } from './catalog.mjs';
import { validateSiteConfig } from '../assets/site-config.js';
try {
  if (!process.argv[2]) throw new Error('Использование: npm run site:apply -- путь/к/site-config.json');
  const file = resolve(process.argv[2]);
  const raw = await readFile(file, 'utf8');
  if (Buffer.byteLength(raw) > 7 * 1024 * 1024) throw new Error('Файл настроек больше 7 МБ.');
  const config = validateSiteConfig(JSON.parse(raw.replace(/^\uFEFF/, '')));
  const target = resolve(root, 'src/site.json');
  await writeFile(`${target}.tmp`, JSON.stringify(config, null, 2) + '\n');
  await rename(`${target}.tmp`, target);
  console.log('Настройки применены в src/site.json. Соберите и опубликуйте сайт, чтобы они появились у всех посетителей.');
} catch (error) { console.error(error.message); process.exitCode = 1; }
