// The footer itself, as data. This object is what changes between releases:
// it is published as template.json and every installed copy fetches the
// @latest one at render time (see index.js), so a release reaches every site
// without a redeploy. Placeholders: {{name}} is escaped, {{{name}}} is raw
// (only for values this package builds itself), {{#name}}...{{/name}} keeps
// the block when the value is non-empty.
//
// Bump `renderer` only when the template needs placeholders an older
// render.js does not fill; older installs then keep their bundled template.

export default {
  version: '0.2.5',
  renderer: 1,
  css: [
    '.pfs-footer{--pfs-footer-muted:color-mix(in srgb,currentColor 62%,transparent);--pfs-footer-gap:.5rem 1.25rem;--pfs-footer-size:.875rem;',
    'border-top:1px solid color-mix(in srgb,currentColor 14%,transparent);font-size:var(--pfs-footer-size);line-height:1.5;color:inherit}',
    '.pfs-footer__inner{max-width:72rem;margin:0 auto;padding:1.5rem 1rem;display:flex;flex-direction:column;align-items:center;gap:.75rem;text-align:center}',
    '.pfs-footer a{color:var(--pfs-footer-muted);text-decoration:none}',
    '.pfs-footer a:hover,.pfs-footer a:focus-visible{color:inherit;text-decoration:underline}',
    '.pfs-footer__links{display:flex;flex-wrap:wrap;justify-content:center;gap:var(--pfs-footer-gap)}',
    '.pfs-footer__ring{display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:.6rem}',
    '.pfs-footer a.pfs-footer__badge{display:inline-block;line-height:0}',
    '.pfs-footer__badge img{display:block;width:200px;height:44px;max-width:100%}',
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
    '</nav>',
    '<a class="pfs-footer__badge" href="https://built.indie.pit.world/for?site={{site}}"><img src="https://built.indie.pit.world/for.svg?site={{site}}" alt="Listed on built.indie" width="200" height="44" loading="lazy"></a>',
    '<p class="pfs-footer__copy">&copy; {{years}} <a href="{{owner_url}}">{{owner_name}}</a>{{#tagline}} &middot; {{tagline}}{{/tagline}}</p>',
    '</div>',
    '</footer>',
  ].join(''),
  // Links every site shows after its own, e.g. a house status page.
  houseLinks: [],
};
