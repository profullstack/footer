import { test } from 'node:test';
import assert from 'node:assert/strict';
import template from '../src/template.js';
import { renderFooter } from '../src/render.js';
import { wireSubscribe } from '../src/subscribe.js';

test('the form reports inline: status line + a nonce-able script inside the form, fallback link still adjacent', () => {
  const html = renderFooter(template, { site: 'a.test', nonce: 'n0nce' });
  const form = html.slice(html.indexOf('<form class="pfs-footer__sub"'), html.indexOf('</form>') + 7);
  assert.ok(form.includes('<span class="pfs-footer__msg" role="status" aria-live="polite"></span>'));
  assert.ok(form.includes('<script nonce="n0nce">(function wireSubscribe(form)'));
  assert.ok(form.includes('})(document.currentScript.parentNode)</script></form>'));
  assert.ok(html.includes('</form><a class="pfs-footer__sublink"'));
  assert.ok(!renderFooter(template, { site: 'a.test' }).includes('nonce='));
});

test('the inlined script is valid JS that wires the form it sits in', () => {
  const html = renderFooter(template, { site: 'a.test' });
  const src = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  const { form } = fakeForm({});
  new Function('document', src)({ currentScript: { parentNode: form } });
  assert.equal(form.attrs['data-pfs-wired'], '1');
  assert.equal(typeof form.submit, 'function');
});

// A form just real enough for wireSubscribe: FormData is stubbed to read `fields`.
function fakeForm(fields) {
  const msg = { textContent: '', attrs: {}, setAttribute(k, v) { this.attrs[k] = v; } };
  const button = { disabled: false };
  const form = {
    action: 'https://pit.world/subscribe',
    fields,
    attrs: {},
    reset() { this.wasReset = true; },
    getAttribute(k) { return this.attrs[k]; },
    setAttribute(k, v) { this.attrs[k] = v; },
    querySelector: (sel) => (sel === 'button' ? button : msg),
    addEventListener(_, fn) { this.submit = fn; },
  };
  return { form, msg, button };
}

async function submitWith(fetchImpl, fields = { email: 'a@b.test', site: 'a.test', website: '' }) {
  const saved = { fetch: globalThis.fetch, FormData: globalThis.FormData };
  const calls = [];
  globalThis.fetch = (url, init) => (calls.push({ url, init }), fetchImpl());
  globalThis.FormData = class {
    constructor(f) { this.f = f.fields; }
    get(k) { return this.f[k] ?? null; }
  };
  try {
    const t = fakeForm(fields);
    wireSubscribe(t.form);
    wireSubscribe(t.form); // a second call is a no-op
    let prevented = false;
    t.form.submit({ preventDefault: () => (prevented = true) });
    await new Promise((r) => setTimeout(r, 10));
    return { ...t, calls, prevented };
  } finally {
    Object.assign(globalThis, saved);
  }
}

const reply = (status, body) => () => Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) });

test('success says the confirmation email was sent', async () => {
  const r = await submitWith(reply(200, { ok: true, status: 'check-inbox' }));
  assert.equal(r.prevented, true);
  assert.equal(r.calls.length, 1);
  assert.equal(r.calls[0].url, 'https://pit.world/api/subscribe');
  assert.deepEqual(JSON.parse(r.calls[0].init.body), { email: 'a@b.test', site: 'a.test' });
  assert.equal(r.msg.textContent, 'Email confirmation sent to a@b.test. Check your inbox.');
  assert.equal(r.msg.attrs['data-state'], 'ok');
  assert.equal(r.form.wasReset, true);
  assert.equal(r.button.disabled, false);
});

test('a refusal says Failed with the reason', async () => {
  assert.equal((await submitWith(reply(400, { ok: false, status: 'undeliverable' }))).msg.textContent, "Failed: that address's domain can't receive email");
  assert.equal((await submitWith(reply(429, { error: 'Too many requests. Try again shortly.' }))).msg.textContent, 'Failed: Too many requests. Try again shortly.');
  const r = await submitWith(reply(502, {}));
  assert.equal(r.msg.textContent, 'Failed: pit.world answered 502');
  assert.equal(r.msg.attrs['data-state'], 'error');
});

test('a blocked or failed request says so instead of doing nothing', async () => {
  const r = await submitWith(() => Promise.reject(new TypeError('Failed to fetch')));
  assert.equal(r.msg.textContent, 'Failed: could not reach pit.world (Failed to fetch)');
  assert.equal(r.button.disabled, false);
});

test('a filled honeypot sends nothing', async () => {
  const r = await submitWith(reply(200, { ok: true }), { email: 'a@b.test', site: 'a.test', website: 'spam' });
  assert.equal(r.calls.length, 0);
  assert.equal(r.msg.attrs['data-state'], 'ok');
});
