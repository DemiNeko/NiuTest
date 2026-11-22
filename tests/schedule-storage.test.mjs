import test from 'node:test';
import assert from 'node:assert/strict';
import { createSchedule, publicSchedule } from '../assets/schedule-model.js';
import { checkedRecord, openCredential, openPlan, readRemote, sealCredential, sealPlan, writeRemote } from '../assets/schedule-storage.js';
import { photoPath } from '../assets/schedule-photo.js';

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
  const background = { id: 'exam', title: 'Exam', date: '2026-12-04', image: '', priority: 1, timing: 'day' };
  assert.throws(() => checkedRecord({ ...initial, public: { ...initial.public, backgrounds: [background] } }), {code:'invalid'});
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

const imageBytes = Buffer.from('UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==', 'base64');
const photo = { path: await photoPath(imageBytes), bytes: imageBytes };
const head = '1'.repeat(40), baseTree = '2'.repeat(40), imageSha = '3'.repeat(40),
  treeSha = '4'.repeat(40), nextHead = '5'.repeat(40);

function mockPhotoCommit(t, { staleSchedule = false, concurrentPush = false } = {}) {
  const events = [];
  const fetch = t.mock.method(globalThis, 'fetch', async (url, opts) => {
    assert.equal(opts.headers.Authorization, 'Bearer ' + token);
    assert.equal(opts.redirect, 'error');
    const suffix = new URL(url).pathname.replace('/repos/DemiNeko/NiuTest', '');
    events.push(opts.method + ' ' + suffix);
    const body = opts.body ? JSON.parse(opts.body) : undefined;
    if (suffix === '/git/ref/heads/main') return json({object:{sha:head}});
    if (suffix === '/git/commits/' + head) return json({tree:{sha:baseTree}});
    if (suffix === '/contents/src/december-schedule.json') {
      assert.equal(new URL(url).searchParams.get('ref'), head);
      return json({sha:staleSchedule ? nextSha : sha});
    }
    if (suffix === '/git/blobs') {
      assert.equal(body.encoding, 'base64');
      if (body.content === imageBytes.toString('base64')) return json({sha:imageSha});
      assert.deepEqual(JSON.parse(Buffer.from(body.content, 'base64')), locked);
      return json({sha:nextSha});
    }
    if (suffix === '/git/trees') {
      assert.equal(body.base_tree, baseTree);
      assert.deepEqual(body.tree, [
        {path:photo.path.slice(2), mode:'100644', type:'blob', sha:imageSha},
        {path:'src/december-schedule.json', mode:'100644', type:'blob', sha:nextSha}
      ]);
      return json({sha:treeSha});
    }
    if (suffix === '/git/commits') {
      assert.deepEqual(body.parents, [head]);
      assert.equal(body.tree, treeSha);
      return json({sha:nextHead});
    }
    assert.equal(suffix, '/git/refs/heads/main');
    assert.equal(opts.method, 'PATCH');
    assert.deepEqual(body, {sha:nextHead, force:false});
    return concurrentPush ? new Response(null,{status:422}) : json({object:{sha:nextHead}});
  });
  return { events, fetch };
}

test('photo and schedule appear in the same non-forced main update, with identical files deduplicated', async t => {
  const { events } = mockPhotoCommit(t);
  const result = await writeRemote(token, sha, locked, [photo,photo]);
  assert.deepEqual(result, {sha:nextSha, record:locked});
  assert.equal(events.filter(step => step === 'POST /git/blobs').length, 2);
  assert.equal(events.at(-1), 'PATCH /git/refs/heads/main');
});

test('a stale schedule is rejected before any new blobs or commits are written', async t => {
  const { events } = mockPhotoCommit(t, {staleSchedule:true});
  await assert.rejects(writeRemote(token, sha, locked, [photo]), {code:'conflict'});
  assert.ok(events.every(step => step.startsWith('GET ')));
});

test('a concurrent push rejects the atomic update without a forced write or partial publication', async t => {
  const { events } = mockPhotoCommit(t, {concurrentPush:true});
  await assert.rejects(writeRemote(token, sha, locked, [photo]), {code:'conflict'});
  assert.equal(events.filter(step => step.startsWith('PATCH')).length, 1);
});

test('forged image names, paths and payloads make no GitHub requests', async t => {
  const { fetch } = mockPhotoCommit(t);
  for (const path of ['./.github/workflows/release.yml', './src/images/schedule/' + 'f'.repeat(64) + '.webp']) {
    await assert.rejects(writeRemote(token, sha, locked, [{...photo,path}]), {code:'invalid'});
  }
  await assert.rejects(writeRemote(token, sha, locked, [{...photo,bytes:new Uint8Array(22)}]), {code:'invalid'});
  assert.equal(fetch.mock.callCount(), 0);
});
