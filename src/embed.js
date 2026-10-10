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

import { footerHtml } from './index.js';

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
    });
    const tpl = document.createElement('template');
    tpl.innerHTML = html;
    el.replaceWith(tpl.content);
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => mount());
  else mount();
}
