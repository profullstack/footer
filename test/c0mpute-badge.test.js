import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import module from 'node:module';
import template from '../src/template.js';
import { c0mputeBadge, c0mputeSiteUrl, renderFooter } from '../src/render.js';
import { footerHtmlSync } from '../src/index.js';
import { c0mputeOption } from '../src/embed.js';

const HREF = 'https://c0mpute.com/gallery?ref=https%3A%2F%2Fexample.com';
const SRC = 'https://c0mpute.com/badge.svg?url=https%3A%2F%2Fexample.com';
const EXACT =
  `<a class="pfs-footer__badge pfs-footer__badge--c0mpute" href="${HREF}" rel="noopener" data-c0mpute-badge>` +
  `<img src="${SRC}" alt="Listed on the c0mpute gallery" width="170" height="36" loading="lazy" decoding="async"></a>`;

test('c0mpute badge is off by default', () => {
  const html = renderFooter(template, { site: 'https://example.com/' });
  assert.doesNotMatch(html, /c0mpute\.com|data-c0mpute-badge/);
  assert.doesNotMatch(renderFooter(template, { site: 'https://example.com/', c0mputeBadge: false }), /c0mpute\.com/);
});

test('c0mputeBadge: true renders the exact link and image with the encoded site URL', () => {
  const html = renderFooter(template, { site: 'https://example.com/some/page?x=1', c0mputeBadge: true });
  assert.ok(html.includes(EXACT), html);
  // Inside the footer's own badge row, after the house icons, and only once.
  assert.match(html, /<div class="pfs-footer__badges">[\s\S]*data-c0mpute-badge[\s\S]*?<\/div>/);
  assert.equal(html.split('data-c0mpute-badge').length, 2);
  assert.doesNotMatch(html, /data-cp-ad/);
  // The webring row is untouched.
  assert.ok(html.includes('next?from=https%3A%2F%2Fexample.com%2F'));
});

test('a bare host becomes https://<host>; http and ports are kept', () => {
  assert.equal(c0mputeSiteUrl('example.com'), 'https://example.com');
  assert.equal(c0mputeSiteUrl('http://a.test:8080/x'), 'http://a.test:8080');
  assert.equal(c0mputeSiteUrl('localhost:3000'), 'https://localhost:3000');
  assert.ok(c0mputeBadge('example.com').includes(`href="${HREF}"`));
});

test('theme: dark adds &theme=dark (escaped as &amp; in the attribute); light adds nothing', () => {
  const dark = renderFooter(template, { site: 'example.com', c0mputeBadge: { theme: 'dark' } });
  assert.ok(dark.includes(`src="${SRC}&amp;theme=dark"`), dark);
  const light = c0mputeBadge('example.com', { theme: 'light' });
  assert.ok(light.includes(`src="${SRC}"`));
  assert.doesNotMatch(light, /theme=/);
});

test('a site that is not http(s) renders no badge', () => {
  for (const bad of ['javascript:alert(1)', 'ftp://example.com', 'data:text/html,x', 'mailto:a@b.c', '', '"><script>', 'https://u:p@example.com']) {
    assert.equal(c0mputeBadge(bad, true), '', bad);
    assert.equal(c0mputeSiteUrl(bad), '', bad);
  }
  const html = renderFooter(template, { site: 'ftp://example.com', c0mputeBadge: true });
  assert.doesNotMatch(html, /c0mpute\.com|data-c0mpute-badge/);
});

test('the site URL is escaped in attributes', () => {
  const html = c0mputeBadge('https://xn--e1afmkfd.xn--p1ai/');
  assert.ok(html.includes('ref=https%3A%2F%2Fxn--e1afmkfd.xn--p1ai"'));
  assert.doesNotMatch(c0mputeBadge('https://a.test/"onload="x'), /onload="/);
});

test('embed data-c0mpute-badge parsing', () => {
  assert.equal(c0mputeOption(undefined), undefined);
  assert.equal(c0mputeOption(''), true);
  assert.equal(c0mputeOption('true'), true);
  assert.equal(c0mputeOption('light'), true);
  assert.deepEqual(c0mputeOption('dark'), { theme: 'dark' });
  assert.equal(c0mputeOption('false'), false);
});

test('CLI --c0mpute-badge prints the badge', () => {
  const bin = fileURLToPath(new URL('../bin/profullstack-footer.js', import.meta.url));
  const on = execFileSync(process.execPath, [bin, 'html', '--offline', '--site', 'https://example.com/', '--c0mpute-badge'], { encoding: 'utf8' });
  assert.ok(on.includes(EXACT));
  const dark = execFileSync(process.execPath, [bin, 'html', '--offline', '--site', 'example.com', '--c0mpute-badge-theme', 'dark'], { encoding: 'utf8' });
  assert.ok(dark.includes('&amp;theme=dark'));
  const off = execFileSync(process.execPath, [bin, 'html', '--offline', '--site', 'https://example.com/'], { encoding: 'utf8' });
  assert.doesNotMatch(off, /c0mpute\.com|data-c0mpute-badge/);
});

// React has no install here (the package has no dependencies), so resolve `react` to a stub whose
// createElement returns its arguments; that is enough to read the HTML the component server-renders.
test('React Footer and FooterSync server-render the badge into the HTML', async (t) => {
  if (typeof module.registerHooks !== 'function') return t.skip('module.registerHooks needs Node 22.15+');
  const stub = 'data:text/javascript,export function createElement(type, props){return {type, props}}';
  module.registerHooks({
    resolve(specifier, context, next) {
      if (specifier === 'react') return { url: stub, shortCircuit: true, format: 'module' };
      return next(specifier, context);
    },
  });
  const { Footer, FooterSync } = await import('../src/react.js');
  const sync = FooterSync({ site: 'https://example.com/', c0mputeBadge: true });
  assert.ok(sync.props.dangerouslySetInnerHTML.__html.includes(EXACT));
  const off = FooterSync({ site: 'https://example.com/' });
  assert.doesNotMatch(off.props.dangerouslySetInnerHTML.__html, /c0mpute\.com|data-c0mpute-badge/);
  const el = await Footer({ site: 'https://example.com/', c0mputeBadge: { theme: 'dark' }, version: 'bundled' });
  assert.ok(el.props.dangerouslySetInnerHTML.__html.includes('&amp;theme=dark'));
  assert.equal(footerHtmlSync({ site: 'https://example.com/', c0mputeBadge: true }), sync.props.dangerouslySetInnerHTML.__html);
});
