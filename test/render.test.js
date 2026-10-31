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
  const html = renderFooter(template, { site: 'https://diskpush.com/', year: 2026, tagline: 'Free, open source (MIT)' });
  assert.match(html, /rel="prev"[^>]*>&lt;&lt;<\/a>/);
  assert.match(html, />Profullstack<\/a>/);
  assert.match(html, /rel="next"[^>]*>&gt;&gt;<\/a>/);
  assert.ok(!/random\?from=|Random site|\/vote"|Vote for this site|pfs-footer__icon/.test(html));
  assert.ok(!/<svg/i.test(html), 'icons are CSS masks, never inline svg');
  assert.ok(html.includes('next?from=https%3A%2F%2Fdiskpush.com%2F'));
  assert.match(
    html,
    /&copy; 2026 <a class="pfs-footer__brand" href="https:\/\/profullstack.com\/" title="Profullstack, Inc\."><img src="https:\/\/profullstack.com\/assets\/logo\.svg"[^>]*><\/a> <a href="https:\/\/profullstack.com\/">Profullstack, Inc\.<\/a>/,
  );
  assert.ok(html.includes('<span class="pfs-footer__tagline">&middot; Free, open source (MIT)</span>'));
  assert.ok(template.css.includes('.pfs-footer__tagline{display:inline-block;white-space:nowrap}'));
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
    houseLinks: false,
    css: false,
  });
  assert.ok(html.includes('<nav class="pfs-footer__links" aria-label="Footer"><a href="/docs">Docs</a><a href="https://github.com/x" rel="me">GH</a></nav>'));
  assert.ok(!html.includes('javascript:'));
  assert.ok(html.includes('2024–2026'));
  assert.ok(html.includes('Acme &lt;Co&gt;'));
  assert.ok(html.includes(' <span class="pfs-footer__tagline">&middot; MIT licensed</span>'));
  assert.ok(!html.includes('<style>'));
});

test('no links means no links nav', () => {
  const html = renderFooter(template, { site: 'a.test', houseLinks: false });
  assert.ok(!html.includes('<nav class="pfs-footer__links" aria-label="Footer"'));
  assert.ok(html.includes('<nav class="pfs-footer__links" aria-label="Profullstack products"><a href="https://profullstack.com/stack/build">Agentic site builder</a><a href="https://crawlproof.com/surveys">CrawlProof Surveys</a></nav>'));
});

test('escaping: options can never inject markup', () => {
  const html = renderFooter(template, { site: 'a.test', links: [{ label: '<img src=x onerror=alert(1)>', href: '"><script>x</script>' }] });
  // The newsletter form's own script is the one allowed.
  assert.ok(!/<img src=x|<script/i.test(html.replace(/<script>\(function wireSubscribe[\s\S]*?<\/script>/, '')));
});

test('publisher badges stay out of the shared footer until a site opts in', () => {
  const html = renderFooter(template, { site: 'https://www.a.test/blog' });
  assert.ok(!html.includes('<div class="pfs-footer__badges">'));
  assert.ok(!html.includes('pfs-footer__badge--built-indie'));
  assert.ok(!html.includes('pfs-footer__badge--pwamart'));
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

test('the newsletter form posts the hostname to the fixed endpoint, no script needed', () => {
  const html = renderFooter(template, { site: 'https://www.a.test/blog' });
  assert.ok(html.includes('<form class="pfs-footer__sub" action="https://pit.world/subscribe" method="post" autocomplete="on">'));
  assert.ok(html.includes('<input type="hidden" name="site" value="www.a.test">'));
  assert.ok(html.includes('<label for="pfs-footer-email">Email</label><input id="pfs-footer-email" type="email" name="email" required maxlength="254" autocomplete="username"'));
  assert.ok(html.indexOf('name="email"') < html.indexOf('name="website"'), 'keep the honeypot after the real email field for password managers');
  assert.ok(html.includes('<button type="submit">Subscribe</button>'));
  // The fallback link is in the markup too; CSS hides it next to the form.
  assert.ok(html.includes('class="pfs-footer__sublink" href="https://pit.world/subscribe?site=https://www.a.test/"'));
  assert.ok(template.css.includes('.pfs-footer__sub+.pfs-footer__sublink{display:none}'));
  assert.ok(!renderFooter(template, { site: 'a.test', subscribe: false }).includes('<form'));
});

test('a template cannot add a form or point one elsewhere', () => {
  const evil = { ...template, footer: template.footer.replace('{{{subscribe}}}', '<form action="https://evil.test/"><input name="email"></form>{{{subscribe}}}') };
  const html = renderFooter(evil, { site: 'a.test' });
  assert.ok(!html.includes('evil.test'));
  assert.equal((html.match(/<form/g) ?? []).length, 1);
});

test('an install that predates the form (no {{{subscribe}}} filler) shows the plain link', () => {
  const old = fill(sanitizeTemplate(template.footer), { site: 'https://a.test/' });
  assert.ok(!old.includes('<form'));
  assert.ok(old.includes('<a class="pfs-footer__sublink" href="https://pit.world/subscribe?site=https://a.test/">Newsletter</a>'));
});

test('publisher badges are absent by default and can opt into OpenIcon HQ marks', () => {
  const defaults = renderFooter(template, { site: 'https://a.test/', year: 2026 });
  assert.ok(!defaults.includes('<div class="pfs-footer__badges">'));
  assert.ok(!defaults.includes('pfs-footer__badge--pwamart'));
  assert.ok(!defaults.includes('pfs-footer__badge--built-indie'));

  const html = renderFooter(template, {
    site: 'https://a.test/',
    year: 2026,
    pwamartHref: 'https://pwamart.com/publishers/a',
    builtIndieHref: 'https://built.indie.pit.world/p/a',
  });
  assert.ok(html.includes('class="pfs-footer__badge pfs-footer__badge--publisher" href="https://pwamart.com/publishers/a"'));
  assert.ok(html.includes('src="https://logicsrc.com/openicon/set/hq/svg/pwamart.svg"'));
  assert.ok(html.includes('class="pfs-footer__badge pfs-footer__badge--publisher" href="https://built.indie.pit.world/p/a"'));
  assert.ok(html.includes('src="https://logicsrc.com/openicon/set/hq/svg/built-indie.svg"'));
  assert.ok(template.css.includes('.pfs-footer__badge--publisher img{width:32px;height:32px'));
});

test('shared footer includes the Profullstack pro directory', () => {
  const html = renderFooter(template, { site: 'https://a.test/', year: 2026 });
  assert.ok(html.includes('href="https://pit.world/pro">Find a pro</a>'));
});

test('site badges render only on the site that passes them', () => {
  const badge = {
    href: 'https://foundplay.io/games/g?utm_source=badge',
    src: 'https://foundplay.io/badge/g.svg',
    alt: 'Play G on Foundplay',
    width: 242,
    height: 28,
  };
  const html = renderFooter(template, { site: 'https://a.test/', year: 2026, badges: [badge] });
  const at = html.indexOf('<a class="pfs-footer__badge pfs-footer__badge--site" href="https://foundplay.io/games/g?utm_source=badge">');
  assert.ok(at > -1);
  assert.ok(html.includes('<img src="https://foundplay.io/badge/g.svg" alt="Play G on Foundplay" width="242" height="28" loading="lazy">'));
  assert.ok(!renderFooter(template, { site: 'https://a.test/', year: 2026 }).includes('pfs-footer__badge--site"'));
});

test('site badges drop unsafe URLs and escape attributes', () => {
  const html = renderFooter(template, {
    site: 'https://a.test/',
    year: 2026,
    badges: [
      { href: 'javascript:alert(1)', src: 'https://x.test/b.svg', alt: 'x' },
      { href: 'https://x.test/', src: 'data:image/svg+xml,<svg>', alt: 'x' },
      { href: 'https://x.test/?a="b"', src: '/b.svg', alt: '"><script>', width: 'nope' },
    ],
  });
  assert.equal(html.split('pfs-footer__badge--site"').length - 1, 1);
  assert.ok(html.includes('href="https://x.test/?a=&quot;b&quot;"'));
  assert.ok(html.includes('alt="&quot;&gt;&lt;script&gt;" loading="lazy"'));
});

test('publisher badge destinations reject unsafe URLs', () => {
  const html = renderFooter(template, {
    site: 'https://profullstack.com/',
    year: 2026,
    pwamartHref: 'javascript:alert(1)',
    builtIndieHref: 'data:text/html,evil',
  });
  assert.ok(!html.includes('javascript:'));
  assert.ok(!html.includes('data:text/html'));
  assert.ok(!html.includes('<div class="pfs-footer__badges">'));
});
