import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { maxPhotoBytes, photoPath, prepareSchedulePhoto } from '../assets/schedule-photo.js';

const sample = Buffer.from('UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==', 'base64');
const imageFile = new Blob([sample], { type: 'image/webp' });
const path = './src/images/schedule/' + createHash('sha256').update(sample).digest('hex') + '.webp';

test('rejects oversized inputs and unsupported or mislabeled images before decoding', async () => {
  await assert.rejects(prepareSchedulePhoto(new Blob([sample], { type: 'image/png' })), { code: 'photo-type' });
  await assert.rejects(prepareSchedulePhoto(new Blob(['<svg/>'], { type: 'image/webp' })), { code: 'photo-type' });
  await assert.rejects(prepareSchedulePhoto(new Blob([new Uint8Array(12 * 1024 * 1024 + 1)])), { code: 'photo-size' });
  await assert.rejects(photoPath(new Uint8Array(maxPhotoBytes + 1)), { code: 'invalid' });
  assert.equal(await photoPath(sample), path);
});

test('bounds output size and dimensions and produces a self-contained preview matching its digest', async t => {
  const draws = [];
  let dimensions = [4000, 3000];
  class DecodedImage {
    set src(url) {
      assert.ok(url.startsWith('blob:'));
      [this.naturalWidth, this.naturalHeight] = dimensions;
      queueMicrotask(() => this.onload());
    }
  }
  const canvas = {
    width: 0, height: 0,
    getContext: () => ({ drawImage(image, x, y, width, height) { draws.push([width, height]); } }),
    toBlob(callback) { callback(draws.length === 1 ? new Blob([new Uint8Array(maxPhotoBytes + 1)], {type:'image/webp'}) : imageFile); }
  };
  globalThis.Image = DecodedImage;
  globalThis.document = { createElement: () => canvas };
  t.after(() => { delete globalThis.Image; delete globalThis.document; });
  const revoke = t.mock.method(URL, 'revokeObjectURL');
  const photo = await prepareSchedulePhoto(imageFile);
  assert.equal(photo.path, path);
  assert.deepEqual(Buffer.from(photo.bytes), sample);
  assert.equal(photo.previewUrl, 'data:image/webp;base64,' + sample.toString('base64'));
  assert.deepEqual(draws, [[1600,1200],[1152,864]]);
  assert.equal(revoke.mock.callCount(), 1);
  dimensions = [10_000, 10_000];
  await assert.rejects(prepareSchedulePhoto(imageFile), {code:'photo-size'});
  assert.equal(revoke.mock.callCount(), 2);
});
