# @profullstack/footer

One footer for every Profullstack site: your links, the copyright line, and the
`<<  Profullstack  >>` webring nav (previous, ring, next).

**Publish once, every site updates.** The markup and CSS ship as data
(`template.json`). At render time each site fetches
`https://cdn.jsdelivr.net/npm/@profullstack/footer@latest/template.json`
(15 min cache, 1.5 s timeout, the bundled copy as the fallback), so a release reaches
every site within about an hour (sooner on sites without a page cache) with no bump, rebuild or redeploy. Install it as
`"@profullstack/footer": "latest"` too, so the render code follows on the next install.

It renders on the server: the ring's verifier reads your HTML and never runs
script, so a client-only footer would never count as a ring member.

## Install

```sh
pnpm add @profullstack/footer@latest   # or npm i / bun add
```

## Next.js (App Router)

```jsx
// app/layout.jsx (a server component)
import { Footer } from '@profullstack/footer/react';

<Footer site="https://example.com/" links={[{ label: 'Docs', href: '/docs' }]} since={2025} />
```

and the ring descriptor:

```js
// app/.well-known/openwebring.json/route.js
import { descriptorResponse } from '@profullstack/footer';
export const GET = () => descriptorResponse({ site: 'https://example.com/', name: 'Example' });
```

## Hono / Express / Bun / SvelteKit

```js
import { footerHtml } from '@profullstack/footer';
const footer = await footerHtml({ site: 'https://example.com/', links: [{ label: 'Docs', href: '/docs' }] });
// Svelte: {@html footer}   Hono: c.html(`...${footer}`)
```

## Static HTML (no server)

Print the footer once and keep it in the page (that is what the verifier sees),
then let the embed swap in the @latest one in the browser:

```sh
npx @profullstack/footer html --site https://example.com/ --link Docs=/docs
```

```html
<footer data-profullstack-footer data-site="https://example.com/" data-links='[{"label":"Docs","href":"/docs"}]'>
  …output of the command above…
</footer>
<script type="module" src="https://cdn.jsdelivr.net/npm/@profullstack/footer@latest/src/embed.js"></script>
```

## Options

| option | default | |
|---|---|---|
| `site` | required | your homepage; `from=` on every hop |
| `links` | `[]` | `{ label, href, rel? }[]`, shown before house links |
| `since` | | first year: `© 2024–2026` |
| `owner` | `Profullstack, Inc.` → profullstack.com | `{ name, url }` |
| `tagline` | | after the copyright, e.g. `MIT licensed` |
| `ring` | `{ slug: 'profullstack', name: 'Profullstack', host: 'https://rssamplifier.com' }` | |
| `css` | `true` | `false` drops the `<style>`; style `.pfs-footer*` yourself |
| `houseLinks` | `true` | `false` hides the shared Terms, Privacy, Media, GitHub, Discord, X, Events, event registration, PairUX and Moshcoding links |
| `subscribe` | `true` | `false` hides the newsletter form |
| `badges` | `[]` | `{ href, src, alt, width?, height? }[]`: badges only this site shows, after the house badges |
| `pwamartHref` | site's PwaMart listing | Override the shared PwaMart badge destination, e.g. a publisher profile |
| `nonce` | | CSP nonce for the inline `<style>`; or `css: false` and style `.pfs-footer*` yourself |
| `version` | `latest` | which CDN template to render: `'0.6.4'` pins one (see below), `'bundled'` never fetches |
| `templateUrl` | | full template URL; wins over `version` |

## Pinning the template version

By default every site follows `@latest`, which is the point of the package, but it also means a bad
or compromised npm publish reaches every site within the cache window. A site that holds secrets
(a secret manager, an admin app) should pin an exact version instead. jsDelivr serves an exact
version immutably, so later publishes cannot change that site's footer:

```js
import { footerHtml } from '@profullstack/footer';
const footer = await footerHtml({ site: 'https://app.example.com/', version: '0.6.4' });
```

```jsx
<Footer site="https://app.example.com/" version="0.6.4" />
```

Or for a whole deployment without code changes: `PROFULLSTACK_FOOTER_VERSION=0.6.4`
(`PROFULLSTACK_FOOTER_VERSION=bundled` renders the copy in the install and never fetches).
`latestTemplate({ version })` and `templateUrl(version)` are exported too; the CLI takes
`--template-version 0.6.4`. Bump the pin when you want a new footer.

Theme it with `--pfs-footer-muted`, `--pfs-footer-gap` and `--pfs-footer-size` on
`.pfs-footer`; colors otherwise inherit from the page.

## Newsletter form

Every footer carries a small email field and a Subscribe button that posts the site's hostname to
pit.world. pit.world runs the double opt-in (confirmation email, nothing kept until the click) and
records which property each subscriber came from (`https://pit.world/admin/subscribers`). The
endpoint is fixed in render.js, never in the template.

Since 0.4.0 a small inline script inside the form (`wireSubscribe`) sends it as JSON to
`https://pit.world/api/subscribe` and reports in place: "Email confirmation sent to you@x. Check your
inbox." or "Failed: <why>" (bad address, domain takes no mail, rate limit, mail provider down, or
the request was blocked). With no script it is a plain POST to `https://pit.world/subscribe`, which
answers with a "check your inbox" page that links back to the site. `embed.js` wires the form itself.

**CSP:** pass the page's `nonce` so the script runs, and allow pit.world:
`connect-src 'self' https://pit.world; form-action 'self' https://pit.world`. If the request is
blocked anyway, the form says "Failed: could not reach pit.world" instead of doing nothing.
Turn it off with `subscribe: false` (`--no-subscribe`). Installs before 0.3.0 cannot render the
form; their footer shows a plain "Newsletter" link to the same page instead, from the @latest template.

## CLI

```sh
profullstack-footer html --site https://example.com/ [--link Docs=/docs] [--since 2024] [--offline] [--no-css]
profullstack-footer json --site https://example.com/          # the four ring URLs
profullstack-footer descriptor --site https://example.com/    # /.well-known/openwebring.json
profullstack-footer template                                  # the @latest template
profullstack-footer check https://example.com/                # does the live page link the ring?
```

## Shared contact and links

Every site gets a CrawlProof Surveys link, plus links to Profullstack's Terms,
Privacy and Media pages, GitHub, Discord and X, the Events calendar on Luma, a
Luma event registration link, and the PairUX and Moshcoding profiles. The
copyright line includes the small Profullstack icon.
The shared footer links square PwaMart and built.indie marks to the site's listing on each service. The Profullstack
homepage uses those service marks to link to its publisher profiles. The footer also shows the Telnyx toll-free number
`+1-888-526-4640` as a click-to-call link. Pass `pwamartHref:
'https://pwamart.com/publishers/profullstack'` to point the PwaMart badge at a publisher
profile. The ten Profullstack links can be hidden with `houseLinks: false`; the
CrawlProof Surveys link and phone line are part of the global footer.

## Changing the footer for every site

Edit `src/template.js`, bump the version in it and in package.json, `npm run build`,
open a PR, merge, and publish a GitHub release `vX.Y.Z`. The publish workflow puts it
on npm and purges jsDelivr's `@latest` so sites pick it up on their next cache refresh.
Bump `renderer` (and `RENDERER` in render.js) only when the template needs a
placeholder older installs cannot fill; they keep their bundled template until
reinstalled.

**Safety:** since 0.5.0 the filled template goes through an **allowlist** sanitizer
(`sanitizeHtml`), not a regex blacklist. It tokenizes the HTML the way a browser does and
rebuilds it: only `footer div nav section aside header p span small strong em b i ul ol li a img
br hr h2-h6` survive; attributes are limited to `class title role lang dir aria-* data-pfs-*`
plus `href rel target hreflang` on `a` and `src alt width height loading decoding` on `img`;
every value is entity-decoded, checked and re-escaped, so what was checked is what the browser
sees; `href` accepts `http:`, `https:`, `mailto:`, `tel:` or relative URLs; `src` accepts
`http:`, `https:`, `mailto:` or relative URLs, after decoding and removing control characters.
Comments, unknown tags (text kept, escaped), and `script`/`style`/`iframe`/
`svg`/`math`/`noscript`/`template`/... with their contents are dropped. The only `<style>` and
`<form>` in the output are the ones render.js builds. CSS (`sanitizeCss`) loses markup, escapes,
comments, `@import`, `expression(`, `behavior:`, `-moz-binding` and any `url()` that is not
https or relative. Option values are always escaped.

Env: `PROFULLSTACK_FOOTER_OFFLINE=1` never fetches; `PROFULLSTACK_FOOTER_VERSION` pins the
template version; `PROFULLSTACK_FOOTER_TEMPLATE_URL` overrides the CDN URL.

MIT © Profullstack, Inc.
