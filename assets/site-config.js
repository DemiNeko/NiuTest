export const SITE_CONFIG_KEY = 'niutest-site-preview-v1';
export const defaultConfig = { version: 1, name: 'NiuTest', logo: './src/images/logo.svg', tagline: 'ПОДГОТОВКА БЕЗ ЛИШНЕГО', topbarText: 'ТВОЁ ПРОСТРАНСТВО ДЛЯ УЧЁБЫ', showTopbarText: true, homeEyebrow: 'ВЫБРАТЬ. ОТВЕТИТЬ. ЗАПОМНИТЬ.', homeTitle: 'К чему готовимся?', homeSubtitle: 'Выбери экзамен — и сразу к вопросам. Нажми на ответ, чтобы проверить себя.', background: '', backgroundOpacity: 25 };
export function validImage(value) {
  if (typeof value !== 'string' || value.length > 3 * 1024 * 1024) return false;
  if (!value || /^\.\/(?:assets|src\/images)\/[a-zA-Z0-9_./-]+\.(svg|png|jpe?g|webp)$/i.test(value) && !value.includes('..')) return true;
  if (/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(value)) return true;
  try { return ['https:', 'http:'].includes(new URL(value).protocol); } catch { return false; }
}
export function validateSiteConfig(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || raw.version !== 1) throw new Error('Нужен файл настроек сайта версии 1.');
  const config = { ...defaultConfig };
  for (const key of ['name', 'tagline', 'topbarText', 'homeEyebrow', 'homeTitle', 'homeSubtitle']) {
    if (raw[key] !== undefined) { if (typeof raw[key] !== 'string' || raw[key].length > (key === 'homeSubtitle' ? 500 : 120) || ['name', 'homeTitle'].includes(key) && !raw[key].trim()) throw new Error(`Некорректное поле ${key}.`); config[key] = raw[key].trim(); }
  }
  for (const key of ['logo', 'background']) { if (raw[key] !== undefined) { if (!validImage(raw[key])) throw new Error(`Некорректное изображение ${key}. Используйте PNG, JPG, WebP или ссылку http/https.`); config[key] = raw[key]; } }
  if (raw.showTopbarText !== undefined) { if (typeof raw.showTopbarText !== 'boolean') throw new Error('showTopbarText должен быть true или false.'); config.showTopbarText = raw.showTopbarText; }
  if (raw.backgroundOpacity !== undefined) { if (!Number.isFinite(raw.backgroundOpacity) || raw.backgroundOpacity < 0 || raw.backgroundOpacity > 100) throw new Error('Видимость фона должна быть от 0 до 100.'); config.backgroundOpacity = raw.backgroundOpacity; }
  return config;
}
