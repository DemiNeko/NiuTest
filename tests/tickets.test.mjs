import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ticketCollections, parseTicketRoute, ticketReader } from '../assets/tickets.js';

const subjects = [
  { id: 'testing', count: 15, source: 'Емтихан_билеттері_тестПО.docx' },
  { id: 'parallel', count: 30, source: 'Билеттер_ПҮЕ (1).docx' }
];

test('each catalog entry links to its complete, consecutively numbered ticket set and original DOCX', async () => {
  assert.deepEqual(ticketCollections.map(({ id, count, source }) => ({ id, count, source })), subjects);
  for (const { id, count, source } of subjects) {
    const data = new URL(`../src/tickets/${id}.json`, import.meta.url);
    const tickets = JSON.parse(await readFile(data, 'utf8'));
    assert.deepEqual(tickets.map(ticket => ticket.number), Array.from({ length: count }, (_, i) => i + 1));
    const uniqueTickets = new Set(tickets.map(ticket => JSON.stringify(ticket.questions.map(q => [q.prompt, q.code]))));
    assert.equal(uniqueTickets.size, count, `${id}: duplicated ticket content`);
    for (const ticket of tickets) {
      assert.ok(ticket.title.trim());
      assert.equal(ticket.questions.length, 3);
      for (const [i, question] of ticket.questions.entries()) {
        const label = `${id}/${ticket.number}, question ${i + 1}`;
        for (const key of ['prompt', 'short', 'long', 'cue']) {
          assert.ok(typeof question[key] === 'string' && question[key].trim(), `${label}: ${key}`);
        }
        assert.notEqual(question.short.trim(), question.long.trim(), label);
        assert.match(question.long, /[әғқңөұүһі]/iu, `${label}: expected a Kazakh explanation`);
      }
    }
    const page = ticketReader(parseTicketRoute(`tickets/${id}/${count}`), tickets, { mode: 'short', recall: false });
    assert.ok(page.includes(`href="./src/tickets/sources/${encodeURIComponent(source)}"`));
    const document = await readFile(new URL(`sources/${source}`, data));
    assert.equal(document.readUInt32LE(0), 0x04034b50, `${source}: missing DOCX archive`);
  }
});

test('ticket routes default to the first tab and reject missing subjects or out-of-range numbers', () => {
  for (const { id, count } of subjects) {
    const collection = ticketCollections.find(item => item.id === id);
    assert.deepEqual(parseTicketRoute(`tickets/${id}`), { collection, number: 1 });
    for (let number = 1; number <= count; number++) {
      assert.deepEqual(parseTicketRoute(`tickets/${id}/${number}`), { collection, number });
    }
    for (const number of ['0', '-1', '01', '1.5', 'x', String(count + 1), '1/other']) {
      assert.equal(parseTicketRoute(`tickets/${id}/${number}`), null);
    }
  }
  for (const invalid of ['tickets', 'tickets/other/1', 'exams']) assert.equal(parseTicketRoute(invalid), null);
});

test('study mode reveals only the selected answer length and recall mode starts cards closed', () => {
  const selection = parseTicketRoute('tickets/testing/1');
  const ticket = {
    number: 1, title: 'Төлем',
    questions: [{ prompt: 'Неше төлем жасалды?', short: 'Бір төлем.', long: 'Бір тапсырысқа бір төлем тіркелді.', cue: 'Тапсырыс пен төлемді салыстыр.' }]
  };
  for (const mode of ['short', 'long']) {
    for (const recall of [false, true]) {
      const page = ticketReader(selection, [ticket], { mode, recall });
      const details = page.match(/<details class="ticket-answer"[^>]*>/)?.[0];
      assert.ok(details);
      assert.equal(/\bopen\b/.test(details), !recall);
      const question = ticket.questions[0];
      assert.ok(page.includes(`<p>${question.short}</p>`));
      const paragraph = /<p class="answer-detail"([^>]*)>([^<]+)<\/p>/.exec(page);
      assert.equal(/\bhidden\b/.test(paragraph[1]), mode === 'short');
      assert.equal(paragraph[2], question.long);
      const start = page.indexOf(details);
      const answer = page.slice(start, page.indexOf('</details>', start));
      assert.ok(answer.includes(ticket.questions[0].cue));
    }
  }
});
