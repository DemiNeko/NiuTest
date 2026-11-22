import { t } from './i18n.js';
import { esc } from './html.js';

export const ticketCollections = [
  {
    id: 'testing', title: 'Бағдарламалық қамтамасыз етуді тестілеу', count: 15,
    description: 'Тест-кейстер, сапа көрсеткіштері және өнімді шығару туралы шешімдер.',
    source: 'Емтихан_билеттері_тестПО.docx'
  },
  {
    id: 'parallel', title: 'Параллельді және үлестірілген есептеулер', count: 30,
    description: 'Кластерлер, GPU және MATLAB кодын қадаммен талдау.',
    source: 'Билеттер_ПҮЕ (1).docx'
  }
];

export function parseTicketRoute(path) {
  const match = /^tickets\/(testing|parallel)(?:\/([1-9]\d*))?$/.exec(path);
  if (!match) return null;
  const collection = ticketCollections.find(item => item.id === match[1]);
  const number = Number(match[2] || 1);
  return number <= collection.count ? { collection, number } : null;
}

const ticketLink = (id, number) => `#tickets/${id}/${number}`;
const padded = number => String(number).padStart(2, '0');

function questionCard(question, index, mode, recall) {
  return `<article class="ticket-question">
    <header><span class="question-index" aria-hidden="true">${padded(index + 1)}</span>
      <h2 lang="kk"><span class="sr-only">${index + 1}-сұрақ. </span>${esc(question.prompt)}</h2></header>
    ${question.code ? `<pre class="ticket-code" dir="ltr"><code>${esc(question.code)}</code></pre>` : ''}
    <details class="ticket-answer"${recall ? '' : ' open'}>
      <summary><span class="when-closed">${t("Показать ответ")}</span><span class="when-open">${t("Скрыть ответ")}</span></summary>
      <div class="answer-copy" lang="kk"><p>${esc(question.short)}</p>
        <p class="answer-detail" ${mode === 'long' ? '' : 'hidden'}>${esc(question.long)}</p>
        <div class="memory-cue"><strong>Есте сақта</strong><p>${esc(question.cue)}</p></div>
      </div>
    </details></article>`;
}

export function ticketReader(selection, tickets, { mode, recall, failed, indexOpen = true }) {
  const { collection: c, number } = selection;
  const back = `<a class="tickets-back" href="#exams">← ${t("Мои экзамены")}</a>`;
  if (!tickets) {
    return `${back}<section class="panel" role="status"><h1 lang="kk">${esc(c.title)}</h1>
      <p>${failed ? t("Не удалось загрузить билеты.") : t("Загружаем билеты…")}</p>
      ${failed ? `<button class="button secondary" data-action="ticket-retry">${t("Повторить загрузку")}</button>` : ''}</section>`;
  }
  const ticket = tickets[number - 1];
  return `<div class="ticket-reader" data-subject="${c.id}">${back}
    <div class="ticket-layout"><aside class="ticket-index">
      <h2 lang="kk">${esc(c.title)}</h2>
      <a class="ticket-source" href="./src/tickets/sources/${encodeURIComponent(c.source)}" download>${t("Скачать исходный документ")} <small>DOCX ↓</small></a>
      <details class="ticket-selector"${indexOpen ? ' open' : ''}><summary>${t("Выберите билет")}<span>${number} / ${c.count}</span></summary>
      <div class="ticket-tabs" role="tablist" aria-label="${t("Экзаменационные билеты")}">
        ${tickets.map(item => `<a role="tab" id="ticket-tab-${item.number}" aria-selected="${number === item.number}"
          tabindex="${number === item.number ? 0 : -1}" aria-controls="ticket-panel" href="${ticketLink(c.id, item.number)}"
          aria-label="${t("Билет")} ${item.number}. ${esc(item.title)}" title="${esc(item.title)}">${padded(item.number)}</a>`).join('')}
      </div></details>
    </aside>
    <section id="ticket-panel" class="ticket-panel" role="tabpanel" aria-labelledby="ticket-tab-${number}" tabindex="0">
      <header class="ticket-heading"><p>${t("Билет")} № ${padded(number)}</p><h1 lang="kk">${esc(ticket.title)}</h1></header>
      <div class="ticket-tools"><div class="answer-switch" role="group" aria-label="${t("Длина ответа")}">
        ${[['short', t("Кратко")], ['long', t("Развёрнуто")]].map(([key,label]) => `
          <button type="button" data-action="ticket-mode" data-mode="${key}" aria-pressed="${mode === key}">${label}</button>`).join('')}
        </div><button type="button" class="recall-switch" data-action="ticket-recall" aria-pressed="${recall}"><span aria-hidden="true"></span>${t("Самопроверка")}</button>
      </div>
      <div class="ticket-questions">${ticket.questions.map((q, i) => questionCard(q, i, mode, recall)).join('')}</div>
      <nav class="ticket-pager" aria-label="${t("Экзаменационные билеты")}">
        ${number > 1 ? `<a rel="prev" href="${ticketLink(c.id, number - 1)}">← ${t("Предыдущий билет")}</a>` : ''}
        ${number < tickets.length ? `<a rel="next" href="${ticketLink(c.id, number + 1)}">${t("Следующий билет")} →</a>` : ''}
      </nav>
    </section></div></div>`;
}
