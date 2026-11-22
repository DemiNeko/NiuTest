import test from 'node:test';
import assert from 'node:assert/strict';
import { createSchedule, publicSchedule } from '../assets/schedule-model.js';
import { openCredential, openPlan, readRemote, sealCredential, sealPlan, writeRemote } from '../assets/schedule-storage.js';

const plan = createSchedule();
const password = 'local test passphrase';
const token = 'test-token-only';
const sha = 'a'.repeat(40), nextSha = 'b'.repeat(40);
const endpoint = 'https://api.github.com/repos/DemiNeko/NiuTest/contents/src/december-schedule.json';
const initial = { version: 1, public: publicSchedule(plan), vault: null };
const encoded = value => Buffer.from(JSON.stringify(value)).toString('base64');
const json = obj => new Response(JSON.stringify(obj));
const vault = await sealPlan(plan, password);
const locked = { ...initial, vault };

test('encrypted schedule and device credential round trip with fresh salt and nonce and separate purposes', async () => {
  assert.deepEqual(await openPlan(vault, password), plan);
  const second = await sealPlan(plan, password);
  assert.notEqual(second.salt, vault.salt);
  assert.notEqual(second.iv, vault.iv);
  assert.notEqual(second.ciphertext, vault.ciphertext);
  assert.ok(!JSON.stringify(vault).includes(plan.exams[0].title));
  const device = await sealCredential(token, password);
  assert.equal(await openCredential(device, password), token);
  assert.ok(!JSON.stringify(device).includes(token));
  await assert.rejects(openPlan(device, password), { code: 'password' });
  await assert.rejects(openCredential(vault, password), { code: 'password' });
  await assert.rejects(openPlan(vault, password + 'x'), { code: 'password' });
  const bytes = Buffer.from(vault.ciphertext, 'base64');
  bytes[0] ^= 1;
  await assert.rejects(openPlan({ ...vault, ciphertext: bytes.toString('base64') }, password), { code: 'password' });
});

test('rejects malformed/oversized vaults, extra KDF parameters, invalid checklist data and blank credentials', async () => {
  await assert.rejects(openPlan({ ...vault, salt: 'AA==' }, password), { code: 'invalid' });
  await assert.rejects(openPlan({ ...vault, iv: 'AA==' }, password), { code: 'invalid' });
  await assert.rejects(openPlan({ ...vault, iterations: 1 }, password), { code: 'invalid' });
  await assert.rejects(openPlan({ ...vault, ciphertext: 'A'.repeat(520_000) }, password), { code: 'invalid' });
  await assert.rejects(sealPlan({ ...plan, visible: 'yes' }, password), { code: 'invalid' });
  await assert.rejects(sealCredential('secret with\nline break', password), { code: 'auth' });
  await assert.rejects(sealPlan(plan, ''), { code: 'password' });
});

test('GitHub GET and SHA-conditional PUT use the fixed repo/branch and keep secrets out of public data', async t => {
  const writePlan = createSchedule();
  writePlan.exams[0].date = '2026-12-19';
  writePlan.exams[0].checks[1] = true;
  writePlan.visible = true;
  const record = { version: 1, public: publicSchedule(writePlan), vault: await sealPlan(writePlan, password) };
  const fetch = t.mock.method(globalThis, 'fetch', async (url, opts) => {
    assert.equal(opts.credentials, 'omit');
    assert.equal(opts.redirect, 'error');
    assert.equal(opts.cache, 'no-store');
    if (opts.method === 'GET') {
      assert.equal(url, endpoint + '?ref=main');
      assert.equal(opts.headers.Authorization, undefined);
      return json({ sha, encoding: 'base64', content: encoded(initial).match(/.{1,60}/g).join('\n') });
    }
    assert.equal(url, endpoint);
    assert.equal(opts.method, 'PUT');
    assert.equal(opts.headers.Authorization, 'Bearer ' + token);
    const dto = JSON.parse(opts.body);
    assert.equal(dto.sha, sha);
    assert.equal(dto.branch, 'main');
    const written = JSON.parse(Buffer.from(dto.content, 'base64').toString('utf8'));
    assert.deepEqual(written, record);
    assert.ok(!Object.hasOwn(written.public.exams[0], 'checks'));
    assert.ok(!JSON.stringify(written).includes(token));
    return json({ content: { sha: nextSha } });
  });
  assert.deepEqual(await readRemote(), { sha, record: initial });
  assert.deepEqual(await writeRemote(token, sha, record), { sha: nextSha, record });
  assert.equal(fetch.mock.callCount(), 2);
});

test('a racing update reports conflict without retry, auth and availability errors do not echo the credential', async t => {
  let status = 409;
  const fetch = t.mock.method(globalThis, 'fetch', async () => new Response(token, { status }));
  await assert.rejects(writeRemote(token, sha, locked), { code: 'conflict', status: 409 });
  assert.equal(fetch.mock.callCount(), 1);
  status = 401;
  await assert.rejects(readRemote(token), err => err.code === 'auth' && !err.message.includes(token));
  status = 503;
  await assert.rejects(readRemote(), { code: 'unavailable', status });
  fetch.mock.mockImplementation(async () => { throw new Error(token); });
  await assert.rejects(readRemote(token), err => err.code === 'unavailable' && !err.message.includes(token));
});

test('unexpected private/public fields and unprotected initial records cannot be written', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => {
    const wrong = { ...initial, public: { ...initial.public, visible: true } };
    return json({ sha, encoding: 'base64', content: encoded(wrong) });
  });
  await assert.rejects(readRemote(), { code: 'invalid' });
  await assert.rejects(writeRemote(token, sha, initial), { code: 'invalid' });
  await assert.rejects(writeRemote(token, sha, { ...locked, token }), { code: 'invalid' });
  await assert.rejects(writeRemote(token, '', locked), { code: 'invalid' });
  await assert.rejects(writeRemote('', sha, locked), { code: 'auth' });
  assert.equal(fetch.mock.callCount(), 1);
});
