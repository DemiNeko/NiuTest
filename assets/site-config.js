import { t } from './i18n.js';
export const SITE_CONFIG_KEY = 'niutest-site-preview-v1';
export const textFields = ['tagline', 'topbarText', 'homeEyebrow', 'homeTitle', 'homeSubtitle'];
export const themeDefaults = { accentColor: '#3863f4', buttonColor: '#3863f4', buttonHoverColor: '#2850d5', buttonTextColor: '#ffffff' };
export const defaultConfig = { version: 1, ...themeDefaults, defaultLanguage: 'ru', translations: {}, name: 'NiuTest', logo: './src/images/logo.svg', tagline: 'ПОДГОТОВКА БЕЗ ЛИШНЕГО', topbarText: 'ТВОЁ ПРОСТРАНСТВО ДЛЯ УЧЁБЫ', showTopbarText: true, homeEyebrow: 'ВЫБРАТЬ. ОТВЕТИТЬ. ЗАПОМНИТЬ.', homeTitle: 'К чему готовимся?', homeSubtitle: 'Выбери экзамен — и сразу к вопросам. Нажми на ответ, чтобы проверить себя.', background: '', backgroundOpacity: 25 };
export function validImage(value) {
  if (typeof value !== 'string' || value.length > 3 * 1024 * 1024) return false;
  if (!value || /^\.\/(?:assets|src\/images)\/[a-zA-Z0-9_./-]+\.(svg|png|jpe?g|webp)$/i.test(value) && !value.includes('..')) return true;
  if (/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(value)) return true;
  try { return ['https:', 'http:'].includes(new URL(value).protocol); } catch { return false; }
}
export function validateSiteConfig(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || raw.version !== 1) throw new Error(t("Нужен файл настроек сайта версии 1."));
  const config = { ...defaultConfig, ...themeDefaults, defaultLanguage: 'ru', translations: {} };
  for (const key of ['name', 'tagline', 'topbarText', 'homeEyebrow', 'homeTitle', 'homeSubtitle']) {
    if (raw[key] !== undefined) { if (typeof raw[key] !== 'string' || raw[key].length > (key === 'homeSubtitle' ? 500 : 120) || ['name', 'homeTitle'].includes(key) && !raw[key].trim()) throw new Error(`${t("Некорректное поле")} ${key}.`); config[key] = raw[key].trim(); }
  }
  for (const key of ['logo', 'background']) { if (raw[key] !== undefined) { if (!validImage(raw[key])) throw new Error(`${t("Некорректное изображение")} ${key}${t(". Используйте PNG, JPG, WebP или ссылку http/https.")}`); config[key] = raw[key]; } }
  if (raw.showTopbarText !== undefined) { if (typeof raw.showTopbarText !== 'boolean') throw new Error(t("showTopbarText должен быть true или false.")); config.showTopbarText = raw.showTopbarText; }
  if (raw.backgroundOpacity !== undefined) { if (!Number.isFinite(raw.backgroundOpacity) || raw.backgroundOpacity < 0 || raw.backgroundOpacity > 100) throw new Error(t("Видимость фона должна быть от 0 до 100.")); config.backgroundOpacity = raw.backgroundOpacity; }
  for (const key of Object.keys(themeDefaults)) {
    if (raw[key] !== undefined) {
      if (typeof raw[key] !== 'string' || !/^#[0-9a-f]{6}$/i.test(raw[key])) throw new Error(`${t("Некорректный цвет")} ${key}${t(": нужен #RRGGBB.")}`);
      config[key] = raw[key];
    }
  }
  if (raw.defaultLanguage !== undefined) {
    if (!['ru', 'en', 'kk'].includes(raw.defaultLanguage)) throw new Error(t("defaultLanguage: ru, en или kk."));
    config.defaultLanguage = raw.defaultLanguage;
  }
  if (raw.translations !== undefined) {
    if (!raw.translations || typeof raw.translations !== 'object' || Array.isArray(raw.translations)) throw new Error(t("translations должен быть объектом."));
    for (const [lang, fields] of Object.entries(raw.translations)) {
      if (!['ru', 'en', 'kk'].includes(lang) || !fields || typeof fields !== 'object' || Array.isArray(fields)) throw new Error(t("Некорректный язык в translations."));
      config.translations[lang] = {};
      for (const [key, value] of Object.entries(fields)) {
        if (!textFields.includes(key) || typeof value !== 'string' || value.length > (key === 'homeSubtitle' ? 500 : 120) || key === 'homeTitle' && !value.trim()) throw new Error(`${t("Некорректный перевод")} ${lang}.${key}.`);
        config.translations[lang][key] = value.trim();
      }
    }
  }
  return config;
}

export function themeStyle(config) {
  const c = { ...themeDefaults, ...config };
  return `--blue:${c.accentColor};--button:${c.buttonColor};--button-hover:${c.buttonHoverColor};--button-text:${c.buttonTextColor};`;
}
