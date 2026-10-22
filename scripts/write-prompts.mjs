import { mkdir, writeFile } from 'node:fs/promises';
import { prompts } from '../assets/prompts.js';
const folder = new URL('../docs/prompts/', import.meta.url);
await mkdir(folder, { recursive: true });
for (const prompt of prompts) await writeFile(new URL(`${prompt.id}.txt`, folder), prompt.text + '\n', 'utf8');
console.log('Updated 3 prompt files.');
