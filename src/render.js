// Pure rendering: no I/O, safe in any runtime (Node, Bun, edge, browser).

import { wireSubscribe } from './subscribe.js';

export const RENDERER = 1;

export const DEFAULT_RING = {
  slug: 'profullstack',
  name: 'Profullstack',
  host: 'https://rssamplifier.com',
};

export const DEFAULT_OWNER = { name: 'Profullstack, Inc.', url: 'https://profullstack.com/' };

// The one newsletter endpoint for every Profullstack property (double opt-in, keeps the site's host).
// Fixed here, never taken from the template: a CDN template cannot carry a <form> (sanitizeTemplate
// strips them), so it can only say WHERE the form goes ({{{subscribe}}}), not where it posts.
export const SUBSCRIBE_URL = 'https://pit.world/subscribe';

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** @param {unknown} value */
export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
}

/**
 * The canonical homepage a ring hop is measured from: scheme, host and a
 * trailing slash. `example.com` and `https://example.com/blog?x=1` both give
 * `https://example.com/`.
 * @param {string} site
 */
export function canonicalSite(site) {
  const raw = String(site ?? '').trim();
  if (!raw) throw new TypeError('@profullstack/footer: `site` is required (e.g. "https://example.com/")');
  const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  return `${url.protocol}//${url.host}/`;
}

/**
 * The four ring URLs for a site. Hops are server-side redirects on the ring
 * host, so the order of the ring never lives in a site's code.
 * @param {string} site
 * @param {{ slug?: string, host?: string }} [ring]
 */
export function ringLinks(site, ring = {}) {
  const host = String(ring.host ?? DEFAULT_RING.host).replace(/\/+$/, '');
  const base = `${host}/ring/${encodeURIComponent(ring.slug ?? DEFAULT_RING.slug)}`;
  const from = encodeURIComponent(canonicalSite(site));
  return {
    ring: base,
    previous: `${base}/previous?from=${from}`,
    next: `${base}/next?from=${from}`,
    random: `${base}/random?from=${from}`,
  };
}

/**
 * The low-profile newsletter form: posts the site's hostname so the signup records which property it
 * came from. A small inline script (wireSubscribe, nonce'd when the site passes one) sends it as JSON
 * and says "Email confirmation sent" or "Failed: <why>" in the status line, without leaving the page.
 * With no script it is a plain POST and the endpoint answers with a "check your inbox" page.
 * The status line and script sit INSIDE the form: the template's CSS hides the fallback link with
 * `.pfs-footer__sub+.pfs-footer__sublink`, so nothing may come between them.
 * @param {string} site
 * @param {string} [nonce]
 */
export function subscribeForm(site, nonce) {
  const host = new URL(canonicalSite(site)).hostname;
  return (
    `<form class="pfs-footer__sub" action="${SUBSCRIBE_URL}" method="post" autocomplete="on">` +
    `<input type="hidden" name="site" value="${escapeHtml(host)}">` +
    '<label for="pfs-footer-email">Email</label>' +
    '<input id="pfs-footer-email" type="email" name="email" required maxlength="254" autocomplete="username" placeholder="Email for our newsletter" aria-label="Email address for the Profullstack newsletter">' +
    '<input class="pfs-footer__hp" name="website" type="text" tabindex="-1" autocomplete="off" aria-hidden="true">' +
    '<button type="submit">Subscribe</button>' +
    '<span class="pfs-footer__msg" role="status" aria-live="polite"></span>' +
    `<script${nonce ? ` nonce="${escapeHtml(nonce)}"` : ''}>(${wireSubscribe})(document.currentScript.parentNode)</script>` +
    '</form>'
  );
}

const SAFE_URL = /^\s*(https?:\/\/|\/(?![/\\]))/i;

/**
 * Badges only this site shows: an image link each. Only http(s) or
 * root-relative URLs; anything else is dropped.
 * @param {FooterBadge[] | undefined} badges
 * @param {'site' | 'publisher'} [kind]
 */
export function siteBadges(badges, kind = 'site') {
  const badgeClass = kind === 'publisher' ? 'publisher' : 'site';
  return (badges ?? [])
    .filter((b) => b && b.href && b.src && SAFE_URL.test(b.href) && SAFE_URL.test(b.src))
    .map((b) => {
      const size = ['width', 'height']
        .filter((k) => Number.isFinite(Number(b[k])) && Number(b[k]) > 0)
        .map((k) => ` ${k}="${Math.round(Number(b[k]))}"`)
        .join('');
      return (
        `<a class="pfs-footer__badge pfs-footer__badge--${badgeClass}" href="${escapeHtml(b.href)}">` +
        `<img src="${escapeHtml(b.src)}" alt="${escapeHtml(b.alt ?? '')}"${size} loading="lazy"></a>`
      );
    })
    .join('');
}

/** @param {number} since @param {number} year */
export function years(since, year) {
  return since && since < year ? `${since}–${year}` : String(year);
}

// ---------------------------------------------------------------------------
// Template sanitizer: an ALLOWLIST, not a blacklist.
//
// Templates arrive over the network from the CDN (@latest by default) and are
// rendered server-side into same-origin HTML on every site, so a bad publish
// must not be able to run script there. The sanitizer below tokenizes the
// filled HTML the way a browser does and rebuilds it from scratch: only the
// tags and attributes listed here survive, every attribute value is decoded
// and re-escaped (so what was checked is exactly what the browser sees), URLs
// must be http(s), mailto, tel (links only) or relative, comments and everything else are
// dropped, and text is re-escaped. Unknown tags are removed but their text is
// kept; script-like containers are removed with their content.
// ---------------------------------------------------------------------------

const TAGS = new Set([
  'footer', 'div', 'nav', 'section', 'aside', 'header', 'p', 'span', 'small', 'strong', 'em', 'b', 'i',
  'ul', 'ol', 'li', 'a', 'img', 'br', 'hr', 'h2', 'h3', 'h4', 'h5', 'h6', 'style',
]);
const VOID = new Set(['img', 'br', 'hr']);
/** Containers dropped together with everything up to their end tag. */
const DROP_WITH_CONTENT = new Set([
  'script', 'style', 'iframe', 'noscript', 'template', 'textarea', 'title', 'xmp', 'noembed', 'noframes',
  'object', 'svg', 'math', 'select', 'frameset', 'head', 'applet', 'audio', 'video', 'canvas',
]);
const GLOBAL_ATTRS = new Set(['class', 'title', 'role', 'lang', 'dir']);
/** @type {Record<string, Set<string>>} */
const TAG_ATTRS = {
  a: new Set(['href', 'rel', 'target', 'hreflang']),
  img: new Set(['src', 'alt', 'width', 'height', 'loading', 'decoding']),
};
const URL_ATTRS = new Set(['href', 'src']);
const URL_SCHEMES = new Set(['http', 'https', 'mailto', 'tel']);
/** @type {Record<string, RegExp>} */
const ATTR_VALUES = {
  target: /^(_blank|_self|_parent|_top)$/i,
  loading: /^(lazy|eager)$/i,
  decoding: /^(async|sync|auto)$/i,
  width: /^\d{1,5}$/,
  height: /^\d{1,5}$/,
  dir: /^(ltr|rtl|auto)$/i,
};
const WS = /[\t\n\f\r ]/;

const NAMED = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', colon: ':', tab: '\t', newline: '\n',
  sol: '/', bsol: '\\', lpar: '(', rpar: ')', period: '.', comma: ',', semi: ';', equals: '=', num: '#',
  excl: '!', quest: '?', commat: '@', percnt: '%', plus: '+', lowbar: '_', grave: '`', copy: '©',
  middot: '·', ndash: '–', mdash: '—', hellip: '…', laquo: '«', raquo: '»',
};

/** Decode character references the way an attribute value is read. Unknown ones stay literal. */
function decodeEntities(value) {
  return value.replace(/&(#[xX][0-9a-fA-F]+|#\d+|[a-zA-Z][a-zA-Z0-9]*);?/g, (m, ref) => {
    if (ref[0] === '#') {
      const cp = ref[1] === 'x' || ref[1] === 'X' ? parseInt(ref.slice(2), 16) : parseInt(ref.slice(1), 10);
      if (!Number.isFinite(cp) || cp === 0 || cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff)) return '�';
      return String.fromCodePoint(cp);
    }
    const ch = NAMED[ref.toLowerCase()];
    return ch === undefined ? m : ch;
  });
}

const ATTR_ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' };
/** @param {string} v */
function escapeAttr(v) {
  return v.replace(/[&<>"'`]/g, (c) => ATTR_ESC[c]);
}

/** Text: escape markup, keep well-formed character references (they can never open a tag). */
function escapeText(t) {
  return t
    .replace(/&(?!(#[xX][0-9a-fA-F]{1,6}|#\d{1,7}|[a-zA-Z][a-zA-Z0-9]{1,31});)/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * A URL that can only navigate or load: http(s), mailto, tel, or relative (path, ?query, #fragment).
 * Returns the normalized URL to emit, or null to drop the attribute.
 * @param {string} raw the DECODED attribute value
 */
export function safeUrl(raw) {
  // Browsers strip leading/trailing C0 controls + space and remove tab/CR/LF anywhere.
  // Remove every control char so the scheme we check is the scheme the browser uses.
  const u = String(raw ?? '').replace(/[\u0000-\u001f\u007f-\u009f]/g, '').replace(/^[\s ﻿]+|[\s ﻿]+$/g, '');
  const m = /^([^/?#\\]*?):/.exec(u);
  if (m && !URL_SCHEMES.has(m[1].toLowerCase())) return null;
  return u;
}

/**
 * Allowlist HTML sanitizer.
 * @param {string} html
 * @param {{ styleToken?: string, textTokens?: string[] }} [opts]
 *   styleToken: the only content a <style> may have (render.js swaps the sanitized CSS in afterwards);
 *   textTokens: placeholders allowed in text only (never in attributes).
 */
export function sanitizeHtml(html, opts = {}) {
  const src = String(html ?? '');
  const styleToken = opts.styleToken || '';
  const tokens = [styleToken, ...(opts.textTokens ?? [])].filter(Boolean);
  const stripTokens = (s) => tokens.reduce((acc, t) => acc.split(t).join(''), s);
  const n = src.length;
  /** @type {string[]} */
  const out = [];
  /** @type {string[]} */
  const stack = [];
  let i = 0;

  const text = (t) => {
    if (!t) return;
    if (styleToken) t = t.split(styleToken).join('');
    out.push(escapeText(t));
  };
  /** Index just past the end tag `</name ...>` from `from`, or n if there is none. */
  const skipPastEndTag = (name, from) => {
    const re = new RegExp(`</${name}(?=[\\t\\n\\f\\r />])`, 'gi');
    re.lastIndex = from;
    const m = re.exec(src);
    if (!m) return { start: n, end: n };
    const gt = src.indexOf('>', m.index);
    return { start: m.index, end: gt === -1 ? n : gt + 1 };
  };

  while (i < n) {
    const lt = src.indexOf('<', i);
    if (lt === -1) {
      text(src.slice(i));
      break;
    }
    text(src.slice(i, lt));
    i = lt;
    const c1 = src[i + 1] ?? '';

    // Comments, doctype, CDATA, processing instructions: never emitted.
    if (c1 === '!' || c1 === '?') {
      if (src.startsWith('<!--', i)) {
        const end = src.indexOf('-->', i + 4);
        i = end === -1 ? n : end + 3;
      } else {
        const end = src.indexOf('>', i);
        i = end === -1 ? n : end + 1;
      }
      continue;
    }

    // End tag.
    if (c1 === '/') {
      const m = /^<\/([a-zA-Z][^\t\n\f\r />]*)/.exec(src.slice(i, i + 256));
      const end = src.indexOf('>', i);
      i = end === -1 ? n : end + 1;
      if (!m) continue; // `</>` or a bogus comment
      const name = m[1].toLowerCase();
      const at = stack.lastIndexOf(name);
      if (at !== -1) while (stack.length > at) out.push(`</${stack.pop()}>`);
      continue;
    }

    // Anything but `<letter` is text.
    if (!/[a-zA-Z]/.test(c1)) {
      out.push('&lt;');
      i += 1;
      continue;
    }

    // Start tag: parse name and attributes per the HTML tokenizer.
    let j = i + 1;
    while (j < n && !WS.test(src[j]) && src[j] !== '/' && src[j] !== '>') j++;
    const name = src.slice(i + 1, j).toLowerCase();
    /** @type {[string, string][]} */
    const attrs = [];
    let closed = false;
    while (j < n) {
      while (j < n && (WS.test(src[j]) || src[j] === '/')) j++;
      if (j >= n) break;
      if (src[j] === '>') {
        closed = true;
        j++;
        break;
      }
      const ns = j;
      j++; // the first char of a name may be anything, `=` included
      while (j < n && !WS.test(src[j]) && src[j] !== '/' && src[j] !== '>' && src[j] !== '=') j++;
      const attrName = src.slice(ns, j).toLowerCase();
      while (j < n && WS.test(src[j])) j++;
      let value = '';
      if (src[j] === '=') {
        j++;
        while (j < n && WS.test(src[j])) j++;
        const q = src[j];
        if (q === '"' || q === "'") {
          const e = src.indexOf(q, j + 1);
          if (e === -1) {
            j = n;
            break;
          }
          value = src.slice(j + 1, e);
          j = e + 1;
        } else {
          const vs = j;
          while (j < n && !WS.test(src[j]) && src[j] !== '>') j++;
          value = src.slice(vs, j);
        }
      }
      attrs.push([attrName, value]);
    }
    if (!closed) {
      // EOF inside a tag: the browser drops the tag, so do we (and everything after it).
      i = n;
      break;
    }
    i = j;

    if (name === 'style') {
      const { start, end } = skipPastEndTag('style', i);
      const body = src.slice(i, start);
      i = end;
      if (!styleToken || body.trim() !== styleToken) continue;
      const nonce = attrs.find(([k]) => k === 'nonce');
      const nv = nonce ? stripTokens(decodeEntities(nonce[1])) : '';
      out.push(`<style${nv ? ` nonce="${escapeAttr(nv)}"` : ''}>${styleToken}</style>`);
      continue;
    }
    if (DROP_WITH_CONTENT.has(name)) {
      i = skipPastEndTag(name, i).end;
      continue;
    }
    if (name === 'plaintext') {
      i = n;
      continue;
    }
    if (!TAGS.has(name)) continue; // unknown tag: dropped, its text is kept

    const seen = new Set();
    let built = `<${name}`;
    for (const [k, raw] of attrs) {
      if (seen.has(k)) continue; // the browser keeps the first
      seen.add(k);
      const allowed =
        GLOBAL_ATTRS.has(k) ||
        TAG_ATTRS[name]?.has(k) ||
        /^aria-[a-z]+$/.test(k) ||
        /^data-pfs(-[a-z0-9]+)*$/.test(k);
      if (!allowed) continue;
      let v = stripTokens(decodeEntities(raw));
      if (URL_ATTRS.has(k)) {
        const u = safeUrl(v);
        if (u === null || (k === 'src' && /^tel:/i.test(u))) continue;
        v = u;
      }
      if (ATTR_VALUES[k] && !ATTR_VALUES[k].test(v)) continue;
      built += ` ${k}="${escapeAttr(v)}"`;
    }
    out.push(built + '>');
    if (!VOID.has(name)) stack.push(name);
  }
  while (stack.length) out.push(`</${stack.pop()}>`);
  return out.join('');
}

/**
 * Sanitize template HTML with the allowlist. Kept for compatibility; render
 * code sanitizes the FILLED template (see renderFooter), which is stricter
 * than sanitizing before placeholders are filled.
 * @param {string} html
 */
export function sanitizeTemplate(html) {
  return sanitizeHtml(html);
}

/**
 * The template's CSS, made safe to sit inside <style>: no markup, no escapes
 * or comments (they can spell keywords), no @import, no expression(), no
 * behavior / -moz-binding, and url() only for https or relative URLs.
 * @param {string} css
 */
export function sanitizeCss(css) {
  return String(css ?? '')
    .replace(/\/\*[\s\S]*?(\*\/|$)/g, '')
    .replace(/[<\\]/g, '')
    .replace(/@import\b[^;{}]*;?/gi, '')
    .replace(/expression\s*\(/gi, '(')
    .replace(/(behavior|-moz-binding)\s*:/gi, 'x-blocked:')
    .replace(/url\s*\(\s*(["']?)([^"')]*)\1\s*\)/gi, (m, _q, u) => {
      const v = u.trim();
      const ok = /^https:\/\//i.test(v) || (!/^[^/?#]*:/.test(v) && !/^\/\//.test(v));
      return ok ? m : 'none';
    })
    .replace(/url\s*\(/gi, (m, off, s) => (/^url\s*\(\s*(["']?)[^"')]*\1\s*\)/i.test(s.slice(off)) ? m : 'none('));
}

/**
 * Fill `{{x}}`, `{{{x}}}` and `{{#x}}...{{/x}}`. Unknown names render empty.
 * @param {string} tpl
 * @param {Record<string, unknown>} vars
 */
export function fill(tpl, vars) {
  const sections = /\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g;
  let out = String(tpl);
  // Sections first (twice handles one level of nesting).
  for (let i = 0; i < 2; i++) {
    out = out.replace(sections, (_, name, body) => {
      const v = vars[name];
      return v === undefined || v === null || v === false || v === '' || (Array.isArray(v) && !v.length) ? '' : body;
    });
  }
  return out
    .replace(/\{\{\{(\w+)\}\}\}/g, (_, name) => String(vars[name] ?? ''))
    .replace(/\{\{(\w+)\}\}/g, (_, name) => escapeHtml(vars[name]));
}

/**
 * @typedef {{ label: string, href: string, rel?: string }} FooterLink
 * @typedef {{ href: string, src: string, alt: string, width?: number, height?: number }} FooterBadge
 * @typedef {{
 *   site: string,
 *   name?: string,
 *   links?: FooterLink[],
 *   owner?: { name?: string, url?: string },
 *   since?: number,
 *   year?: number,
 *   tagline?: string,
 *   ring?: { slug?: string, name?: string, host?: string },
 *   css?: boolean,
 *   houseLinks?: boolean,
 *   nonce?: string,
 *   subscribe?: boolean,
 *   badges?: FooterBadge[],
 *   pwamartHref?: string,
 *   builtIndieHref?: string,
 * }} FooterOptions
 * @typedef {{ version: string, renderer: number, css: string, link: string, footer: string, houseLinks?: FooterLink[] }} FooterTemplate
 */

/**
 * Render the footer from a template. Synchronous and pure.
 * @param {FooterTemplate} template
 * @param {FooterOptions} opts
 */
export function renderFooter(template, opts) {
  const ring = { ...DEFAULT_RING, ...(opts.ring ?? {}) };
  const owner = { ...DEFAULT_OWNER, ...(opts.owner ?? {}) };
  const hops = ringLinks(opts.site, ring);
  const year = opts.year ?? new Date().getUTCFullYear();
  const publisherBadges = [
    opts.builtIndieHref && {
      href: opts.builtIndieHref,
      src: 'https://logicsrc.com/openicon/set/hq/svg/built-indie.svg',
      alt: 'Find this site on built.indie',
      width: 32,
      height: 32,
    },
    opts.pwamartHref && {
      href: opts.pwamartHref,
      src: 'https://logicsrc.com/openicon/set/hq/svg/pwamart.svg',
      alt: 'Find this site on PwaMart',
      width: 32,
      height: 32,
    },
  ].filter(Boolean);
  const all = [...(opts.links ?? []), ...(opts.houseLinks === false ? [] : (template.houseLinks ?? []))];
  const links = all
    .filter((l) => l && l.href && l.label && safeUrl(l.href) !== null)
    .map((l) => fill(String(template.link ?? ''), { href: l.href, label: l.label, rel: l.rel ?? '' }))
    .join('');
  // The two values this package builds and the template may not touch (the CSS, and the form with its
  // script) go in as random placeholders: the sanitizer only lets them stand as the whole <style> body
  // and as text, and they are swapped in after. Everything else, links and badges included, is sanitized.
  const tok = rawToken();
  const cssTok = `${tok}css`;
  const subTok = `${tok}sub`;
  const css = opts.css === false ? '' : sanitizeCss(template.css);
  const subscribe = opts.subscribe === false ? '' : subscribeForm(opts.site, opts.nonce);
  const filled = fill(String(template.footer ?? ''), {
    version: template.version,
    css: css ? cssTok : '',
    links,
    ...hops,
    ring_name: ring.name,
    years: years(opts.since ?? 0, year),
    owner_name: owner.name,
    owner_url: owner.url,
    tagline: opts.tagline ?? '',
    site: canonicalSite(opts.site),
    name: opts.name ?? '',
    nonce: opts.nonce ?? '',
    subscribe: subscribe ? subTok : '',
    badges: siteBadges(publisherBadges, 'publisher') + siteBadges(opts.badges),
  });
  return sanitizeHtml(filled, { styleToken: cssTok, textTokens: [subTok] }).split(cssTok).join(css).split(subTok).join(subscribe);
}

let tokenSeq = 0;
/** An unguessable per-render placeholder (letters and digits only, so escaping leaves it alone). */
function rawToken() {
  const c = globalThis.crypto;
  const r = typeof c?.randomUUID === 'function' ? c.randomUUID() : `${Math.random()}${Math.random()}${Date.now()}`;
  return `pfsraw${r.replace(/[^a-z0-9]/gi, '')}${(tokenSeq++).toString(36)}x`;
}

/**
 * The /.well-known/openwebring.json body that states the site's membership.
 * @param {{ site: string, name?: string, slug?: string, madeBy?: 'human'|'ai'|'both', ring?: { slug?: string, host?: string } }} opts
 */
export function descriptor(opts) {
  const site = canonicalSite(opts.site);
  const { ring } = ringLinks(site, opts.ring);
  return {
    openwebring: '0.1',
    site: { url: site, name: opts.name ?? new URL(site).host },
    made_by: opts.madeBy ?? 'both',
    rings: [{ ring, slug: opts.slug ?? new URL(site).host.replace(/^www\./, '').replace(/\./g, '-') }],
  };
}
