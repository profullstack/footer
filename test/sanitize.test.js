import { test } from 'node:test';
import assert from 'node:assert/strict';
import template from '../src/template.js';
import { renderFooter, sanitizeHtml, sanitizeCss, safeUrl } from '../src/render.js';
import { footerHtml, latestTemplate, resetTemplateCache, templateUrl, bundledTemplate } from '../src/index.js';

// Nothing executable may survive: no script-ish tags, no on* handlers, no dangerous schemes.
const EXEC = /<\s*(script|iframe|svg|math|object|embed|form|button|input|style|base|meta|link|template|textarea)\b|\son[a-z]+\s*=|javascript:|vbscript:|data:|srcdoc|formaction|xlink/i;
const clean = (html) => {
  const out = sanitizeHtml(html);
  assert.doesNotMatch(out, EXEC, `${html}\n=> ${out}`);
  return out;
};

test('attribute handlers without whitespace before them are dropped', () => {
  assert.equal(clean('<img/onerror=alert(1) src=x>'), '<img src="x">');
  assert.equal(clean('<img src=x/onerror=alert(1)>'), '<img src="x/onerror=alert(1)">');
  clean('<img src="x"/onerror="alert(1)">');
  clean('<img src=x ONERROR=alert(1)>');
  clean('<img\tsrc=x\nonerror\f=\ralert(1)>');
  clean('<a href=/ onmouseover=`alert(1)`>x</a>');
});

test('svg, math and script-like containers go with their content', () => {
  assert.equal(clean('<svg/onload=alert(1)><circle/></svg>ok'), 'ok');
  assert.equal(clean('<svg><script>alert(1)</script></svg>'), '');
  assert.equal(clean('<math><mtext><img src=x onerror=alert(1)></mtext></math>'), '');
  assert.equal(clean('<script>alert(1)</script>after'), 'after');
  assert.equal(clean('<SCRIPT SRC=//e.test/x.js></SCRIPT>'), '');
  clean('<noscript><p title="</noscript><img src=x onerror=alert(1)>"></noscript>');
});

test('nested-tag reassembly cannot produce a tag', () => {
  const out = clean('<scr<script>ipt>alert(1)</scr</script>ipt>');
  assert.doesNotMatch(out, /<script/i);
  clean('<<script>script>alert(1)<</script>/script>');
});

test('javascript: urls in every disguise are dropped', () => {
  for (const href of [
    'javascript:alert(1)',
    'jav&#x61;script:alert(1)',
    'jav&#97;script:alert(1)',
    ' javascript:alert(1)',
    '&#x20;javascript:alert(1)',
    'java&#x09;script:alert(1)',
    'java\tscript:alert(1)',
    'java\nscript:alert(1)',
    'JaVaScRiPt:alert(1)',
    'javascript&colon;alert(1)',
    '\u0001javascript:alert(1)',
    'vbscript:x',
    'data:text/html,<script>alert(1)</script>',
  ]) {
    const out = clean(`<a href="${href}">x</a>`);
    assert.ok(out === '<a>x</a>' || !/href="[a-z]+:/i.test(out), out);
  }
  assert.equal(clean('<a href="jav&#x61;script:alert(1)">x</a>'), '<a>x</a>');
  // An entity the sanitizer does not know is emitted literally, so the browser sees it literally too.
  assert.equal(sanitizeHtml('<a href="javascript&unknown;alert(1)">x</a>'), '<a href="javascript&amp;unknown;alert(1)">x</a>');
});

test('safe urls survive and are re-escaped', () => {
  assert.equal(sanitizeHtml('<a href="https://a.test/?a=1&amp;b=2">x</a>'), '<a href="https://a.test/?a=1&amp;b=2">x</a>');
  assert.equal(sanitizeHtml('<a href="mailto:hi@a.test">x</a>'), '<a href="mailto:hi@a.test">x</a>');
  assert.equal(sanitizeHtml('<a href="/p">x</a><a href="#top">y</a><a href="?q=1">z</a>'), '<a href="/p">x</a><a href="#top">y</a><a href="?q=1">z</a>');
  assert.equal(safeUrl('/a:b'), '/a:b');
  assert.equal(safeUrl('  https://a.test/ '), 'https://a.test/');
  assert.equal(safeUrl('ftp://a.test/'), null);
});

test('style blocks, iframes with srcdoc, forms with formaction, xlink are gone', () => {
  assert.equal(clean('<style>*{background:url(javascript:alert(1))}</style>ok'), 'ok');
  assert.equal(clean('<iframe srcdoc="<script>alert(1)</script>"></iframe>ok'), 'ok');
  assert.equal(clean('<form><button formaction="javascript:alert(1)">go</button></form>'), 'go');
  assert.equal(clean('<a xlink:href="javascript:alert(1)" href="/">x</a>'), '<a href="/">x</a>');
  assert.equal(clean('<div style="background:url(x)" id="clobber" name="x">y</div>'), '<div>y</div>');
  clean('<base href="//e.test/"><meta http-equiv=refresh content="0;url=javascript:alert(1)"><link rel=import href=x>');
});

test('backticks and quotes in attributes cannot break out', () => {
  const out = sanitizeHtml('<a title=`x` class="a&quot; onclick=&quot;y" href=/>z</a>');
  assert.equal(out, '<a title="&#96;x&#96;" class="a&quot; onclick=&quot;y" href="/">z</a>');
});

test('comments and unclosed tags are dropped; open tags are closed', () => {
  assert.equal(clean('a<!-- <img src=x onerror=alert(1)> -->b'), 'ab');
  assert.equal(clean('a<!--><img src=x onerror=alert(1)>'), 'a');
  assert.equal(clean('<div><a href="/">x'), '<div><a href="/">x</a></div>');
  assert.equal(clean('ok<img src=x onerror="alert(1)'), 'ok');
  assert.equal(sanitizeHtml('</div>x</p>'), 'x');
});

test('unknown tags are removed but their text is kept, escaped', () => {
  assert.equal(sanitizeHtml('<blink>hi &amp; <b>bye</b></blink> 1 < 2'), 'hi &amp; <b>bye</b> 1 &lt; 2');
});

test('sanitizeCss: no markup, escapes, imports, expression, bindings or unsafe url()', () => {
  const out = sanitizeCss(
    'a{}</style><script>x</script>@import url(//e.css);@\\69mport "x";b{background:url(javascript:x);x:expression(alert(1));behavior:url(a.htc);-moz-binding:url(b.xml)}c{background:url("data:image/svg+xml,x")}/* */d{background:url(https://ok.test/a.png)}e{background:url(/r.png)}',
  );
  assert.doesNotMatch(out, /<|\\|@import|javascript:|expression\(|behavior:|-moz-binding:|data:|\/\/e\.css/i, out);
  assert.ok(out.includes('url(https://ok.test/a.png)'));
  assert.ok(out.includes('url(/r.png)'));
  assert.equal(sanitizeCss(template.css), template.css, 'the real CSS is untouched');
});

test('a hostile remote template renders nothing executable, ring links intact', () => {
  const evil = {
    ...template,
    css: template.css + '</style><img src=x onerror=alert(1)>',
    link: '<a href="{{href}}" onclick=alert(1)>{{label}}</a><img/onerror=alert(2) src=x>',
    footer: template.footer.replace(
      '</footer>',
      '<img/onerror=alert(1) src=x><svg/onload=alert(1)><a href="jav&#x61;script:alert(1)">a</a><scr<script>ipt>alert(1)</scr</script>ipt>' +
        '<style>*{}</style><iframe srcdoc="x"></iframe><form><button formaction="javascript:alert(1)">b</button></form>' +
        '<a title="{{{subscribe}}}">t</a><p>{{{css}}}</p></footer>',
    ),
  };
  const html = renderFooter(evil, { site: 'https://a.test/', links: [{ label: 'Docs', href: '/docs' }] });
  const withoutOwn = html.replace(/<form class="pfs-footer__sub"[\s\S]*?<\/form>/, '').replace(/<style>[^<]*<\/style>/, '');
  assert.doesNotMatch(withoutOwn, EXEC, withoutOwn);
  assert.equal((html.match(/<form/g) ?? []).length, 1, 'only the package-built form');
  assert.equal((html.match(/<style/g) ?? []).length, 1, 'only the package-built style');
  assert.doesNotMatch(html, /pfsraw/, 'no placeholder leaks');
  assert.ok(html.includes('https://rssamplifier.com/ring/profullstack/previous?from='));
  assert.ok(html.includes('https://rssamplifier.com/ring/profullstack/next?from='));
});

test('the real template still renders the ring, badges, form and style', () => {
  const html = renderFooter(template, { site: 'https://a.test/', year: 2026, nonce: 'n' });
  assert.ok(html.startsWith('<footer class="pfs-footer" data-pfs-footer="'));
  assert.ok(html.includes('<a href="https://rssamplifier.com/ring/profullstack/previous?from=https%3A%2F%2Fa.test%2F" rel="prev" title="Previous site">&lt;&lt;</a>'));
  assert.ok(html.includes('<a href="https://rssamplifier.com/ring/profullstack/next?from=https%3A%2F%2Fa.test%2F" rel="next" title="Next site">&gt;&gt;</a>'));
  assert.ok(html.includes(`<style nonce="n">${template.css}</style>`));
  assert.ok(html.includes('<form class="pfs-footer__sub" action="https://pit.world/subscribe" method="post" autocomplete="on">'));
  assert.ok(html.endsWith('</footer>'));
});

test('templateUrl pins a version and rejects junk', () => {
  assert.equal(templateUrl(), 'https://cdn.jsdelivr.net/npm/@profullstack/footer@latest/template.json');
  assert.equal(templateUrl('0.5.0'), 'https://cdn.jsdelivr.net/npm/@profullstack/footer@0.5.0/template.json');
  assert.throws(() => templateUrl('../evil'));
  assert.throws(() => templateUrl('1.0.0/x?'));
});

test('footerHtml({ version }) fetches that exact version; bundled never fetches', async () => {
  resetTemplateCache();
  const real = globalThis.fetch;
  const urls = [];
  globalThis.fetch = async (u) => (urls.push(u), new Response(JSON.stringify({ ...bundledTemplate, version: '0.4.1' })));
  try {
    const html = await footerHtml({ site: 'a.test', version: '0.4.1' });
    assert.deepEqual(urls, ['https://cdn.jsdelivr.net/npm/@profullstack/footer@0.4.1/template.json']);
    assert.ok(html.includes('data-pfs-footer="0.4.1"'));
    assert.equal(await latestTemplate({ version: 'bundled' }), bundledTemplate);
    assert.equal(urls.length, 1);
    process.env.PROFULLSTACK_FOOTER_VERSION = '0.4.2';
    await latestTemplate();
    assert.equal(urls.at(-1), 'https://cdn.jsdelivr.net/npm/@profullstack/footer@0.4.2/template.json');
  } finally {
    delete process.env.PROFULLSTACK_FOOTER_VERSION;
    globalThis.fetch = real;
    resetTemplateCache();
  }
});
