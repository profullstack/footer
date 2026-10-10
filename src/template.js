// The footer itself, as data. This object is what changes between releases:
// it is published as template.json and every installed copy fetches the
// @latest one at render time (see index.js), so a release reaches every site
// without a redeploy. Placeholders: {{name}} is escaped, {{{name}}} is raw
// (only for values this package builds itself), {{#name}}...{{/name}} keeps
// the block when the value is non-empty.
//
// Bump `renderer` only when the template needs placeholders an older
// render.js does not fill; older installs then keep their bundled template.

// OpenIcon line glyphs (github.com/profullstack/openicon, keys `random` and
// `vote`) as CSS masks. A template may not carry <svg> (sanitizeTemplate strips
// it), and a mask over currentColor keeps the icon the colour of the link.
const glyph = (body) =>
  `url("data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'>${body}</svg>`,
  )}")`;
const RANDOM = glyph(
  "<rect x='3' y='3' width='18' height='18' rx='3'/><circle cx='8' cy='8' r='1'/><circle cx='16' cy='8' r='1'/><circle cx='12' cy='12' r='1'/><circle cx='8' cy='16' r='1'/><circle cx='16' cy='16' r='1'/>",
);
const VOTE = glyph("<path d='M12 4 21 19H3z'/>");

export default {
  version: '0.2.1',
  renderer: 1,
  css: [
    '.pfs-footer{--pfs-footer-muted:color-mix(in srgb,currentColor 62%,transparent);--pfs-footer-gap:.5rem 1.25rem;--pfs-footer-size:.875rem;',
    'border-top:1px solid color-mix(in srgb,currentColor 14%,transparent);font-size:var(--pfs-footer-size);line-height:1.5;color:inherit}',
    '.pfs-footer__inner{max-width:72rem;margin:0 auto;padding:1.5rem 1rem;display:flex;flex-direction:column;align-items:center;gap:.75rem;text-align:center}',
    '.pfs-footer a{color:var(--pfs-footer-muted);text-decoration:none}',
    '.pfs-footer a:hover,.pfs-footer a:focus-visible{color:inherit;text-decoration:underline}',
    '.pfs-footer__links{display:flex;flex-wrap:wrap;justify-content:center;gap:var(--pfs-footer-gap)}',
    '.pfs-footer__ring{display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:.6rem}',
    '.pfs-footer__icon{display:inline-block;width:1em;height:1em;vertical-align:-.125em;background-color:currentColor;',
    '-webkit-mask:var(--pfs-footer-glyph) center/contain no-repeat;mask:var(--pfs-footer-glyph) center/contain no-repeat}',
    `.pfs-footer__icon--random{--pfs-footer-glyph:${RANDOM}}`,
    `.pfs-footer__icon--vote{--pfs-footer-glyph:${VOTE}}`,
    '.pfs-footer__copy{margin:0;color:var(--pfs-footer-muted)}',
    '.pfs-footer__copy a{color:inherit}',
  ].join(''),
  link: '<a href="{{href}}"{{#rel}} rel="{{rel}}"{{/rel}}>{{label}}</a>',
  footer: [
    '<footer class="pfs-footer" data-pfs-footer="{{version}}">',
    '{{#css}}<style{{#nonce}} nonce="{{nonce}}"{{/nonce}}>{{{css}}}</style>{{/css}}',
    '<div class="pfs-footer__inner">',
    '{{#links}}<nav class="pfs-footer__links" aria-label="Footer">{{{links}}}</nav>{{/links}}',
    '<nav class="webring pfs-footer__ring" aria-label="{{ring_name}} webring">',
    '<a href="{{previous}}" rel="prev" title="Previous site">&lt;&lt;</a>',
    '<a href="{{ring}}">{{ring_name}}</a>',
    '<a href="{{next}}" rel="next" title="Next site">&gt;&gt;</a>',
    '<a href="{{random}}" title="Random site" aria-label="Random site"><span class="pfs-footer__icon pfs-footer__icon--random" aria-hidden="true"></span></a>',
    // Anonymous, throttled vote for this site. A bare URL because a new
    // placeholder would need a renderer bump; the ring host finds the site
    // from the Referer, and referrerpolicy keeps the origin on sites whose
    // own policy is no-referrer.
    '<a href="{{ring}}/vote" referrerpolicy="origin" title="Vote for this site" aria-label="Vote for this site"><span class="pfs-footer__icon pfs-footer__icon--vote" aria-hidden="true"></span></a>',
    '</nav>',
    '<p class="pfs-footer__copy">&copy; {{years}} <a href="{{owner_url}}">{{owner_name}}</a>{{#tagline}} &middot; {{tagline}}{{/tagline}}</p>',
    '</div>',
    '</footer>',
  ].join(''),
  // Links every site shows after its own, e.g. a house status page.
  houseLinks: [],
};
