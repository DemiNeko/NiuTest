import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { setLanguage, getLanguage, t, siteText, countText } from '../assets/i18n.js';
import { messages } from '../assets/locales.js';
import { validateSiteConfig, themeStyle } from '../assets/site-config.js';
import { parseExam } from '../assets/exam-format.js';

test('all explicit interface messages have both translations', async () => {
  for (const file of ['app', 'site-config', 'exam-format', 'library-store', 'catalog-export']) {
    const source = await readFile(new URL(`../assets/${file}.js`, import.meta.url), 'utf8');
    for (const [, literal] of source.matchAll(/\bt\(("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')\)/g)) {
      const key = literal[0] === '"' ? JSON.parse(literal) : literal.slice(1,-1);
      for (const lang of ['en','kk']) assert.ok(messages[lang][key], `${lang}: ${key}`);
    }
  }
});

test('language changes localize UI and validation but preserve exam content', async () => {
  const raw = JSON.parse(await readFile(new URL('../assets/exam-template.json', import.meta.url), 'utf8'));
  setLanguage('ru'); const original = parseExam(raw).exam;
  try {
    for (const lang of ['en', 'kk']) {
      setLanguage(lang);
      assert.notEqual(t('Мои экзамены'), 'Мои экзамены');
      assert.deepEqual(parseExam(raw).exam, original);
    }
    setLanguage('en'); assert.match(parseExam({}).errors.join(' '), /Exam id/);
    assert.equal(countText(1, 'questions'), '1 question');
    assert.equal(countText(2, 'questions'), '2 questions');
    setLanguage('ru'); assert.equal(countText(2, 'sections'), '2 раздела');
    setLanguage('kk'); assert.equal(countText(2, 'questions'), '2 сұрақ');
    setLanguage('unknown'); assert.equal(getLanguage(), 'ru');
  } finally { setLanguage('ru'); }
});

test('site config validates colors, preserves translated copy, and supports older files', () => {
  const config = validateSiteConfig({version:1,buttonColor:'#abcdef',accentColor:'#123456',defaultLanguage:'kk',homeTitle:'Мой заголовок',translations:{en:{homeTitle:'My title',topbarText:''}}});
  assert.match(themeStyle(config), /--button:#abcdef/);
  assert.match(themeStyle(config), /--blue:#123456/);
  assert.deepEqual(validateSiteConfig(JSON.parse(JSON.stringify(config))),config);
  assert.equal(validateSiteConfig({version:1}).defaultLanguage,'ru');
  try {
    setLanguage('en'); assert.equal(siteText(config,'homeTitle'),'My title'); assert.equal(siteText(config,'topbarText'),'');
    setLanguage('kk'); assert.equal(siteText(config,'homeTitle'),'Мой заголовок');
  } finally { setLanguage('ru'); }
  for (const fields of [{accentColor:'red'}, {buttonColor:'#000;display:none'}, {buttonHoverColor:'#fff'}, {buttonTextColor:42}, {defaultLanguage:'kz'}, {translations:[]}, {translations:{en:{logo:'x'}}}, {translations:{en:{homeTitle:''}}}]) assert.throws(()=>validateSiteConfig({version:1,...fields}));
});
