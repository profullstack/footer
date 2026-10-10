import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { footerHtml, latestTemplate, resetTemplateCache, bundledTemplate, descriptorResponse } from '../src/index.js';

beforeEach(() => resetTemplateCache());

const remote = { ...bundledTemplate, version: '9.9.9', houseLinks: [{ label: 'Status', href: 'https://status.profullstack.com/' }] };
const ok = (body) => async () => new Response(JSON.stringify(body), { status: 200 });

test('uses the fetched @latest template', async () => {
  const t = await latestTemplate({ fetch: ok(remote) });
  assert.equal(t.version, '9.9.9');
  const html = await footerHtml({ site: 'a.test' });
  assert.ok(html.includes('data-pfs-footer="9.9.9"'));
  assert.ok(html.includes('>Status</a>'));
});

test('caches within the ttl', async () => {
  let calls = 0;
  const f = async () => (calls++, new Response(JSON.stringify(remote)));
  let now = 1000;
  await latestTemplate({ fetch: f, now: () => now });
  await latestTemplate({ fetch: f, now: () => now + 1000 });
  assert.equal(calls, 1);
});

test('falls back to the bundled template on error, timeout or a newer renderer', async () => {
  assert.equal(await latestTemplate({ fetch: async () => new Response('nope', { status: 500 }) }), bundledTemplate);
  resetTemplateCache();
  assert.equal(await latestTemplate({ fetch: async () => { throw new Error('offline'); } }), bundledTemplate);
  resetTemplateCache();
  assert.equal(await latestTemplate({ fetch: ok({ ...remote, renderer: 99 }) }), bundledTemplate);
  resetTemplateCache();
  const hang = (_u, init) => new Promise((_, rej) => init.signal.addEventListener('abort', () => rej(new Error('abort'))));
  assert.equal(await latestTemplate({ fetch: hang, timeoutMs: 20 }), bundledTemplate);
});

test('a remote template cannot inject script', async () => {
  await latestTemplate({ fetch: ok({ ...remote, footer: remote.footer.replace('</footer>', '<script>alert(1)</script></footer>') }) });
  const html = await footerHtml({ site: 'a.test' });
  assert.ok(!html.includes('<script'));
});

test('descriptorResponse is json', async () => {
  const res = descriptorResponse({ site: 'https://a.test/' });
  assert.match(res.headers.get('content-type'), /application\/json/);
  assert.equal((await res.json()).rings[0].slug, 'a-test');
});

test('under Next.js every call goes through fetch so each route revalidates', async () => {
  let calls = 0;
  const real = globalThis.fetch;
  globalThis.fetch = async () => (calls++, new Response(JSON.stringify(remote)));
  process.env.NEXT_RUNTIME = 'nodejs';
  try {
    await latestTemplate();
    await latestTemplate();
    assert.equal(calls, 2);
    assert.equal((await latestTemplate()).version, '9.9.9');
  } finally {
    delete process.env.NEXT_RUNTIME;
    globalThis.fetch = real;
  }
});
