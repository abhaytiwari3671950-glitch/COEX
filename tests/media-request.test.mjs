import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mediaRequest } from '../lib/media-request.ts';

const json = (value, status = 200) => Response.json(value, { status });
test('authorizes before processing and shares the request deadline', async t => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (path, options) => {
    calls.push({path, options});
    return path.endsWith('media-token') ? json({token:'test-token'}) : json({pages:1, mediaType:'application/pdf'});
  });
  assert.equal((await mediaRequest({action:'inspect', data:'test'})).pages, 1);
  assert.equal(calls.length, 2);
  assert.deepEqual(JSON.parse(calls[0].options.body), {action:'inspect'});
  assert.equal(calls[1].options.headers.Authorization, 'Bearer test-token');
  assert.equal(calls[0].options.signal, calls[1].options.signal);
});
for (const [name, response, message] of [
  ['expired login', () => json({},401), /Sign in again/],
  ['oversized upload', () => new Response('large',{status:413}), /smaller than 2 MB/],
  ['rate limit', () => json({},429), /Wait a moment/],
  ['HTML error page', () => new Response('<html>Error</html>',{status:502}), /temporarily unavailable/],
  ['broken JSON', () => new Response('{',{headers:{'content-type':'application/json'}}), /invalid response/],
  ['missing authorization token', () => json({}), /Unable to authorize/],
]) test(name, async t => {
  let calls = 0;
  t.mock.method(globalThis,'fetch',async () => {calls++;return response();});
  await assert.rejects(mediaRequest({action:'inspect'}), message);
  assert.equal(calls,1);
});
test('preserves Python validation errors', async t => {
  let calls=0;
  t.mock.method(globalThis,'fetch',async () => ++calls===1 ? json({token:'test'}) : json({error:'Please upload an unlocked PDF.'},400));
  await assert.rejects(mediaRequest({action:'inspect'}), /unlocked PDF/);
});
test('network failure allows a useful retry', async t => {
  t.mock.method(globalThis,'fetch',async () => {throw new TypeError('Failed to fetch');});
  await assert.rejects(mediaRequest({action:'inspect'}), /Check your connection/);
});
test('processing abort is reported as a timeout', async t => {
  const controller=new AbortController();
  t.mock.method(AbortSignal,'timeout',()=>controller.signal);
  t.mock.method(globalThis,'fetch',async () => {
    controller.abort();
    throw new DOMException('aborted','AbortError');
  });
  await assert.rejects(mediaRequest({action:'inspect'}), /timed out/);
});
