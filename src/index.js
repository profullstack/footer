// @profullstack/footer: one footer for every Profullstack site.
//
// The markup lives in template.js and ships as template.json. `footerHtml`
// fetches the @latest template from the CDN at render time (cached, with the
// bundled copy as the fallback), so publishing a release is the whole
// rollout: no site has to bump, rebuild or redeploy.

import bundled from './template.js';
import { RENDERER, renderFooter, descriptor } from './render.js';

export {
  RENDERER,
  DEFAULT_OWNER,
  DEFAULT_RING,
  canonicalSite,
  descriptor,
  escapeHtml,
  renderFooter,
  ringLinks,
  sanitizeTemplate,
} from './render.js';
export { bundled as bundledTemplate };

export const TEMPLATE_URL = 'https://cdn.jsdelivr.net/npm/@profullstack/footer@latest/template.json';

// 15 min: a page cache (ISR, 1 h) and Next's fetch cache both sit in front of
// this one and each serves one stale copy before refreshing, so the layers add up.
const DEFAULT_TTL_MS = 15 * 60 * 1000;
const NEXT_REVALIDATE_S = 300;
const FAILURE_TTL_MS = 5 * 60 * 1000;

/** @type {{ template: any, until: number, pending: Promise<any> | null }} */
const cache = { template: null, until: 0, pending: null };

/** @param {any} t */
function usable(t) {
  return (
    t &&
    typeof t === 'object' &&
    typeof t.footer === 'string' &&
    typeof t.link === 'string' &&
    typeof t.css === 'string' &&
    Number(t.renderer ?? 1) <= RENDERER
  );
}

/**
 * The newest template this install can render. Never throws and never waits
 * longer than `timeoutMs`: a slow or broken CDN gives the bundled template.
 *
 * @param {{ url?: string, ttlMs?: number, timeoutMs?: number, fetch?: typeof fetch, now?: () => number }} [opts]
 */
export async function latestTemplate(opts = {}) {
  const env = typeof process !== 'undefined' ? process.env ?? {} : {};
  if (env.PROFULLSTACK_FOOTER_OFFLINE === '1') return bundled;
  const now = (opts.now ?? Date.now)();
  // Under Next.js, always go through fetch: Next caches it (revalidate 300 s)
  // AND marks the route as revalidating. Answering from memory instead left
  // every page rendered after the first at build time fully static
  // (s-maxage=31536000), so it never saw a template release.
  if (!opts.fetch && underNext()) return fetchFresh(opts, env, now);
  if (cache.template && now < cache.until) return cache.template;
  // Stale while revalidating: hand back what we have, refresh once.
  if (cache.template && cache.pending) return cache.template;

  const doFetch = opts.fetch ?? globalThis.fetch;
  if (typeof doFetch !== 'function') return bundled;
  const url = opts.url ?? env.PROFULLSTACK_FOOTER_TEMPLATE_URL ?? TEMPLATE_URL;
  const ttl = opts.ttlMs ?? DEFAULT_TTL_MS;

  cache.pending = (async () => {
    try {
      const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
      const timer = ctrl ? setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 1500) : null;
      /** @type {RequestInit & { next?: { revalidate: number } }} */
      const init = { signal: ctrl?.signal, headers: { accept: 'application/json' }, next: { revalidate: NEXT_REVALIDATE_S } };
      const res = await doFetch(url, init).finally(() => timer && clearTimeout(timer));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const t = await res.json();
      if (!usable(t)) throw new Error('template not usable by this renderer');
      cache.template = t;
      cache.until = (opts.now ?? Date.now)() + ttl;
    } catch {
      cache.template = cache.template ?? bundled;
      cache.until = (opts.now ?? Date.now)() + FAILURE_TTL_MS;
    } finally {
      cache.pending = null;
    }
    return cache.template;
  })();

  return cache.template ?? cache.pending;
}

/** Next.js patches fetch (and marks it) and sets NEXT_RUNTIME in its servers. */
function underNext() {
  // @ts-ignore Next's marker on its patched fetch
  if (globalThis.fetch && globalThis.fetch.__nextPatched) return true;
  // Written out literally so Next's compile-time define can replace it.
  return typeof process !== 'undefined' && !!process.env.NEXT_RUNTIME;
}

/** One uncached-by-us fetch, for runtimes (Next) that cache fetch themselves. */
async function fetchFresh(opts, env, now) {
  try {
    const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 1500) : null;
    const res = await globalThis
      .fetch(opts.url ?? env.PROFULLSTACK_FOOTER_TEMPLATE_URL ?? TEMPLATE_URL, {
        signal: ctrl?.signal,
        headers: { accept: 'application/json' },
        // @ts-ignore Next's fetch extension
        next: { revalidate: NEXT_REVALIDATE_S },
      })
      .finally(() => timer && clearTimeout(timer));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const t = await res.json();
    if (!usable(t)) throw new Error('template not usable by this renderer');
    cache.template = t;
    cache.until = now + (opts.ttlMs ?? DEFAULT_TTL_MS);
    return t;
  } catch {
    return cache.template ?? bundled;
  }
}

/** Forget the cached template (tests, or a manual refresh hook). */
export function resetTemplateCache() {
  cache.template = null;
  cache.until = 0;
  cache.pending = null;
}

/**
 * The footer HTML using the @latest template. Use this on the server.
 * @param {import('./render.js').FooterOptions & { template?: import('./render.js').FooterTemplate }} opts
 */
export async function footerHtml(opts) {
  const template = opts.template ?? (await latestTemplate());
  return renderFooter(template, opts);
}

/**
 * The footer HTML from the template bundled in this install, with no network.
 * For build-time rendering and places that cannot await.
 * @param {import('./render.js').FooterOptions} opts
 */
export function footerHtmlSync(opts) {
  return renderFooter(bundled, opts);
}

/**
 * A ready Response for a /.well-known/openwebring.json route (Next route
 * handlers, Hono, Bun.serve, Workers).
 * @param {Parameters<typeof descriptor>[0]} opts
 */
export function descriptorResponse(opts) {
  return new Response(JSON.stringify(descriptor(opts), null, 2) + '\n', {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=3600',
      'access-control-allow-origin': '*',
    },
  });
}
