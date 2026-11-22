import test from 'node:test';
import assert from 'node:assert/strict';
import { readTicketProgress, saveTicketVisit } from '../assets/ticket-progress.js';
import { ticketCollections } from '../assets/tickets.js';

const [testing, parallel] = ticketCollections;

function makeStorage(entries = new Map()) {
  return {
    getItem: key => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value)
  };
}

test('each subject resumes at its own last visit and repeat visits count once', () => {
  const entries = new Map();
  const storage = makeStorage(entries);
  assert.deepEqual(readTicketProgress(storage, testing), { visited: [], last: null });
  for (const number of [4, 1, 4, 4]) saveTicketVisit(storage, testing, number);
  saveTicketVisit(storage, parallel, parallel.count);
  const nextSession = makeStorage(entries);
  assert.deepEqual(readTicketProgress(nextSession, testing), { visited: [1, 4], last: 4 });
  assert.deepEqual(readTicketProgress(nextSession, parallel), { visited: [parallel.count], last: parallel.count });
});

test('invalid ticket numbers, malformed markers and invalid resume pointers are ignored', () => {
  const storage = makeStorage();
  const key = 'niutest-ticket-visits-v1:testing:';
  storage.setItem(key + '1', '{broken');
  storage.setItem(key + '2', '1');
  storage.setItem(key + '99', '1');
  for (const last of ['1', '02', '99', 'foo']) {
    storage.setItem(key + 'last', last);
    assert.deepEqual(readTicketProgress(storage, testing), { visited: [2], last: null });
  }
  for (const number of [0, -1, '2', 2.5, NaN, testing.count + 1]) {
    assert.deepEqual(saveTicketVisit(storage, testing, number), { visited: [2], last: null });
  }
  assert.deepEqual(saveTicketVisit(storage, testing, 1), { visited: [1, 2], last: 1 });
});

test('interleaved tab writes preserve both visits and the last completed selection', () => {
  const entries = new Map();
  const secondTab = makeStorage(entries);
  let interleave = true;
  const firstTab = {
    getItem: secondTab.getItem,
    setItem(key, value) {
      if (interleave) {
        interleave = false;
        saveTicketVisit(secondTab, parallel, 9);
      }
      entries.set(key, value);
    }
  };
  saveTicketVisit(firstTab, parallel, 2);
  assert.deepEqual(readTicketProgress(secondTab, parallel), { visited: [2, 9], last: 2 });
});

test('reading and navigation still work in this session when storage is unavailable', () => {
  const denied = () => { throw new Error('Storage unavailable'); };
  for (const storage of [null, { getItem: denied, setItem: denied }, { ...makeStorage(), setItem: denied }]) {
    assert.deepEqual(readTicketProgress(storage, testing), { visited: [], last: null });
    saveTicketVisit(storage, testing, 3);
    assert.deepEqual(readTicketProgress(storage, testing), { visited: [3], last: 3 });
  }
});
