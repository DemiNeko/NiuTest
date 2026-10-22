import { t } from './i18n.js';
import { parseExam } from './exam-format.js';
export function catalogFiles(exams) {
  const ids = new Set(), files = [], manifest = { version: 1, exams: [] };
  for (const raw of exams) {
    const { exam, errors } = parseExam(raw);
    if (!exam) throw new Error(errors.join('\n'));
    if (ids.has(exam.id)) throw new Error(`${t("Повторяющийся id:")} ${exam.id}`);
    ids.add(exam.id);
    manifest.exams.push({ id: exam.id, title: exam.title, file: `${exam.id}.json` });
    files.push({ name: `src/exams/${exam.id}.json`, content: JSON.stringify(exam, null, 2) + '\n' });
  }
  files.unshift({ name: 'src/exams/index.json', content: JSON.stringify(manifest, null, 2) + '\n' });
  return files;
}
const table = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ c >>> 1 : c >>> 1; return c >>> 0; });
export function crc32(bytes) { let c = 0xffffffff; for (const b of bytes) c = table[(c ^ b) & 255] ^ c >>> 8; return (c ^ 0xffffffff) >>> 0; }
// ZIP STORE, UTF-8 filenames, no external dependency. Unzips with standard OS tools.
export function zipFiles(files) {
  const encoder = new TextEncoder(), chunks = [], directory = []; let offset = 0;
  for (const file of files) {
    const name = encoder.encode(file.name), data = encoder.encode(file.content), crc = crc32(data);
    const header = new Uint8Array(30 + name.length), h = new DataView(header.buffer);
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x800, true); h.setUint16(12, 33, true);
    h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true); header.set(name, 30);
    chunks.push(header, data);
    const central = new Uint8Array(46 + name.length), c = new DataView(central.buffer);
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x800, true); c.setUint16(14, 33, true);
    c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, name.length, true); c.setUint32(42, offset, true); central.set(name, 46);
    directory.push(central); offset += header.length + data.length;
  }
  const size = directory.reduce((n, c) => n + c.length, 0), end = new Uint8Array(22), view = new DataView(end.buffer);
  view.setUint32(0, 0x06054b50, true); view.setUint16(8, files.length, true); view.setUint16(10, files.length, true); view.setUint32(12, size, true); view.setUint32(16, offset, true);
  const out = new Uint8Array(offset + size + end.length); let position = 0;
  for (const chunk of [...chunks, ...directory, end]) { out.set(chunk, position); position += chunk.length; }
  return out;
}
