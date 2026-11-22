// For static HTML sites with no server to render on. Load from the CDN:
//
//   <footer data-profullstack-footer data-site="https://example.com/"
//           data-links='[{"label":"Docs","href":"/docs"}]'>
//     ...the ring links, server-rendered, as the fallback crawlers see...
//   </footer>
//   <script type="module" src="https://cdn.jsdelivr.net/npm/@profullstack/footer@latest/src/embed.js"></script>
//
// Keep real ring links inside the element: the ring's verifier reads the HTML
// and never runs this script. `profullstack-footer html --site ...` prints them.
//
// data-c0mpute-badge (empty, "true", "light" or "dark") adds the c0mpute gallery
// badge. Its verifier reads the HTML too, so keep the printed badge
// (`--c0mpute-badge`) in the fallback markup as well.

import { footerHtml } from './index.js';
import { wireSubscribe } from './subscribe.js';

/**
 * data-c0mpute-badge: absent or "false" is off; "dark" is the dark badge; anything else is on.
 * @param {string | undefined} raw
 */
export function c0mputeOption(raw) {
  if (raw === undefined || raw === null) return undefined;
  const v = String(raw).trim().toLowerCase();
  if (v === 'false' || v === 'off' || v === '0') return false;
  return v === 'dark' ? { theme: 'dark' } : true;
}

/** @param {string | undefined} raw */
function parse(raw) {
  try {
    return raw ? JSON.parse(raw) : undefined;
  } catch {
    return undefined;
  }
}

export async function mount(root = document) {
  const nodes = root.querySelectorAll('[data-profullstack-footer]');
  for (const el of nodes) {
    const d = /** @type {HTMLElement} */ (el).dataset;
    const site = d.site || location.origin + '/';
    const html = await footerHtml({
      site,
      name: d.name,
      tagline: d.tagline,
      since: d.since ? Number(d.since) : undefined,
      links: parse(d.links),
      owner: parse(d.owner),
      badges: parse(d.badges),
      c0mputeBadge: c0mputeOption(d.c0mputeBadge),
    });
    const tpl = document.createElement('template');
    tpl.innerHTML = html;
    // Scripts parsed by innerHTML never run, so wire the newsletter form here.
    tpl.content.querySelectorAll('.pfs-footer__sub').forEach((form) => wireSubscribe(/** @type {HTMLFormElement} */ (form)));
    el.replaceWith(tpl.content);
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => mount());
  else mount();
}
