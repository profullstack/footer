import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import template from '../src/template.js';
import {
  canonicalSite,
  descriptor,
  fill,
  renderFooter,
  ringLinks,
  sanitizeCss,
  sanitizeTemplate,
  years,
} from '../src/render.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

test('canonicalSite keeps scheme + host and adds the slash', () => {
  assert.equal(canonicalSite('diskpush.com'), 'https://diskpush.com/');
  assert.equal(canonicalSite('https://bl0ggers.com/blog?x=1#y'), 'https://bl0ggers.com/');
  assert.equal(canonicalSite('http://a.test:8080'), 'http://a.test:8080/');
  assert.throws(() => canonicalSite(''));
});

test('ringLinks encodes the site as from= on all three hops', () => {
  const r = ringLinks('https://hdtilt.com');
  assert.equal(r.ring, 'https://rssamplifier.com/ring/profullstack');
  assert.equal(r.previous, 'https://rssamplifier.com/ring/profullstack/previous?from=https%3A%2F%2Fhdtilt.com%2F');
  assert.equal(r.next, 'https://rssamplifier.com/ring/profullstack/next?from=https%3A%2F%2Fhdtilt.com%2F');
  assert.equal(r.random, 'https://rssamplifier.com/ring/profullstack/random?from=https%3A%2F%2Fhdtilt.com%2F');
  assert.equal(ringLinks('x.test', { slug: 'other', host: 'https://ring.test/' }).next, 'https://ring.test/ring/other/next?from=https%3A%2F%2Fx.test%2F');
});

test('the rendered footer carries << Profullstack >> and no random or vote link', () => {
  const html = renderFooter(template, { site: 'https://diskpush.com/', year: 2026 });
  assert.match(html, /rel="prev"[^>]*>&lt;&lt;<\/a>/);
  assert.match(html, />Profullstack<\/a>/);
  assert.match(html, /rel="next"[^>]*>&gt;&gt;<\/a>/);
  assert.ok(!/random\?from=|Random site|\/vote"|Vote for this site|pfs-footer__icon/.test(html));
  assert.ok(!/<svg/i.test(html), 'icons are CSS masks, never inline svg');
  assert.ok(html.includes('next?from=https%3A%2F%2Fdiskpush.com%2F'));
  assert.match(html, /&copy; 2026 <a href="https:\/\/profullstack.com\/">Profullstack, Inc.<\/a>/);
  assert.match(html, /<style>\.pfs-footer/);
  assert.doesNotMatch(html, /\{\{/);
});

test('links, since, tagline, owner and css:false', () => {
  const html = renderFooter(template, {
    site: 'a.test',
    year: 2026,
    since: 2024,
    tagline: 'MIT licensed',
    owner: { name: 'Acme <Co>' },
    links: [{ label: 'Docs', href: '/docs' }, { label: 'X', href: 'javascript:alert(1)' }, { label: 'GH', href: 'https://github.com/x', rel: 'me' }],
    css: false,
  });
  assert.ok(html.includes('<nav class="pfs-footer__links" aria-label="Footer"><a href="/docs">Docs</a><a href="https://github.com/x" rel="me">GH</a></nav>'));
  assert.ok(!html.includes('javascript:'));
  assert.ok(html.includes('2024–2026'));
  assert.ok(html.includes('Acme &lt;Co&gt;'));
  assert.ok(html.includes(' &middot; MIT licensed'));
  assert.ok(!html.includes('<style>'));
});

test('no links means no links nav', () => {
  assert.ok(!renderFooter(template, { site: 'a.test' }).includes('<nav class="pfs-footer__links"'));
});

test('escaping: options can never inject markup', () => {
  const html = renderFooter(template, { site: 'a.test', links: [{ label: '<img src=x onerror=alert(1)>', href: '"><script>x</script>' }] });
  assert.ok(!/<img src=x|<script/i.test(html));
});

test('the built.indie badge links the listing for this site, server-rendered', () => {
  const html = renderFooter(template, { site: 'https://www.a.test/blog' });
  assert.ok(html.includes('<a class="pfs-footer__badge" href="https://built.indie.pit.world/for?site=https://www.a.test/">'));
  assert.ok(html.includes('src="https://built.indie.pit.world/for.svg?site=https://www.a.test/"'));
});

test('sanitizeTemplate strips script, handlers and javascript: urls', () => {
  const bad = '<footer onclick="x()"><script>alert(1)</script><iframe src="//e"></iframe><a href="javascript:alert(1)">a</a><a href=\'data:text/html,x\'>b</a><img src=x onerror=y></footer>';
  const out = sanitizeTemplate(bad);
  assert.ok(!/script|iframe|onclick|onerror|javascript:|data:/i.test(out), out);
  assert.ok(out.startsWith('<footer>'));
});

test('sanitizeCss cannot close the style tag or import', () => {
  const out = sanitizeCss('a{}</style><script>x</script>@import url(//e.css);b{background:url(javascript:x)}');
  assert.ok(!/<\/?style|@import|javascript:/i.test(out), out);
});

test('fill: sections and unknown names', () => {
  assert.equal(fill('{{#a}}A{{/a}}{{#b}}B{{/b}}[{{c}}]{{{d}}}', { a: 1, b: '', d: '<i>' }), 'A[]<i>');
});

test('years', () => {
  assert.equal(years(0, 2026), '2026');
  assert.equal(years(2026, 2026), '2026');
  assert.equal(years(2023, 2026), '2023–2026');
});

test('descriptor names the ring and a dashed slug', () => {
  assert.deepEqual(descriptor({ site: 'https://www.wx93.me/x', name: 'wx93' }), {
    openwebring: '0.1',
    site: { url: 'https://www.wx93.me/', name: 'wx93' },
    made_by: 'both',
    rings: [{ ring: 'https://rssamplifier.com/ring/profullstack', slug: 'wx93-me' }],
  });
});

test('template.json is built from template.js at the package version', () => {
  assert.equal(template.version, pkg.version, 'bump src/template.js version with package.json');
  const json = JSON.parse(readFileSync(new URL('../template.json', import.meta.url), 'utf8'));
  assert.deepEqual(json, { ...template, version: pkg.version }, 'run `npm run build`');
});

test('nonce lands on the style tag, escaped', () => {
  const html = renderFooter(template, { site: 'a.test', nonce: 'abc"x' });
  assert.ok(html.includes('<style nonce="abc&quot;x">'));
  assert.ok(renderFooter(template, { site: 'a.test' }).includes('<style>'));
});
