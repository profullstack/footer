// Pure rendering: no I/O, safe in any runtime (Node, Bun, edge, browser).

export const RENDERER = 1;

export const DEFAULT_RING = {
  slug: 'profullstack',
  name: 'Profullstack',
  host: 'https://rssamplifier.com',
};

export const DEFAULT_OWNER = { name: 'Profullstack, Inc.', url: 'https://profullstack.com/' };

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

/** @param {number} since @param {number} year */
export function years(since, year) {
  return since && since < year ? `${since}–${year}` : String(year);
}

/**
 * Strip what a template must never carry. Templates arrive over the network
 * from the CDN and land in every site's HTML, so a bad publish must not be
 * able to run script there.
 * @param {string} html
 */
export function sanitizeTemplate(html) {
  return String(html ?? '')
    .replace(/<\s*(script|iframe|object|embed|form|noscript|template|svg|math)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*\/?\s*(script|iframe|object|embed|link|meta|base|form|noscript|template|svg|math)\b[^>]*>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src|action)\s*=\s*("|')\s*(javascript|data|vbscript):[^"']*\2/gi, '$1=$2#$2');
}

/** @param {string} css */
export function sanitizeCss(css) {
  return String(css ?? '')
    .replace(/<\/?\s*style/gi, '')
    .replace(/@import[^;]*;?/gi, '')
    .replace(/expression\s*\(/gi, '(')
    .replace(/url\s*\(\s*(['"]?)\s*javascript:[^)]*\)/gi, 'none');
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
  const linkTpl = sanitizeTemplate(template.link);
  const all = [...(opts.links ?? []), ...(opts.houseLinks === false ? [] : (template.houseLinks ?? []))];
  const links = all
    .filter((l) => l && l.href && l.label && !/^\s*(javascript|data|vbscript):/i.test(l.href))
    .map((l) => fill(linkTpl, { href: l.href, label: l.label, rel: l.rel ?? '' }))
    .join('');
  return fill(sanitizeTemplate(template.footer), {
    version: template.version,
    css: opts.css === false ? '' : sanitizeCss(template.css),
    links,
    ...hops,
    ring_name: ring.name,
    years: years(opts.since ?? 0, year),
    owner_name: owner.name,
    owner_url: owner.url,
    tagline: opts.tagline ?? '',
    site: canonicalSite(opts.site),
    name: opts.name ?? '',
  });
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
