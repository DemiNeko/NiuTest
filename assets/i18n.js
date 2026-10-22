import { messages } from './locales.js';

export const languages = ['ru', 'en', 'kk'];
let language = 'ru';
export const getLanguage = () => language;
export function setLanguage(value) { language = languages.includes(value) ? value : 'ru'; }
export const locale = () => ({ ru: 'ru-RU', en: 'en-GB', kk: 'kk-KZ' })[language];
// Call explicitly for interface strings. Never call on imported exam content.
export function t(key) {
  const text = messages[language]?.[key] ?? key;
  // Decorative arrows are omitted; keyboard instructions retain their meaning.
  return text.replace(/^[←→↗↑↓↻]\s*|\s*[←→↗↑↓↻]$/g, '');
}
export function siteText(config, key) { return config.translations?.[language]?.[key] ?? config[key] ?? ''; }

const nouns = {
  ru: { questions: ['вопрос', 'вопроса', 'вопросов'], sections: ['раздел', 'раздела', 'разделов'] },
  en: { questions: ['question', 'questions', 'questions'], sections: ['section', 'sections', 'sections'] },
  kk: { questions: ['сұрақ', 'сұрақ', 'сұрақ'], sections: ['бөлім', 'бөлім', 'бөлім'] }
};
export function countText(count, noun) {
  const plural = new Intl.PluralRules(language).select(count);
  return `${count} ${nouns[language][noun][plural === 'one' ? 0 : plural === 'few' ? 1 : 2]}`;
}
