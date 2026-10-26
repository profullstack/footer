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
| `houseLinks` | `true` | `false` hides links the template adds for every site |
| `subscribe` | `true` | `false` hides the newsletter form |
| `badges` | `[]` | `{ href, src, alt, width?, height? }[]`: badges only this site shows, after the house badges |
| `nonce` | | CSP nonce for the inline `<style>`; or `css: false` and style `.pfs-footer*` yourself |

Theme it with `--pfs-footer-muted`, `--pfs-footer-gap` and `--pfs-footer-size` on
`.pfs-footer`; colors otherwise inherit from the page.

## Newsletter form

Every footer carries a small email field and a Subscribe button: a plain HTML form (no script)
that posts to `https://pit.world/subscribe` with the site's hostname. pit.world runs the double
opt-in (confirmation email, nothing kept until the click), answers with a "check your inbox" page
that links back to the site, and records which property each subscriber came from
(`https://pit.world/admin/subscribers`). The endpoint is fixed in render.js, never in the template.

**CSP:** a site that sets `form-action` must allow it: `form-action 'self' https://pit.world`.
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

## Changing the footer for every site

Edit `src/template.js`, bump the version in it and in package.json, `npm run build`,
open a PR, merge, and publish a GitHub release `vX.Y.Z`. The publish workflow puts it
on npm and purges jsDelivr's `@latest` so sites pick it up on their next cache refresh.
Bump `renderer` (and `RENDERER` in render.js) only when the template needs a
placeholder older installs cannot fill; they keep their bundled template until
reinstalled.

**Safety:** remote templates are sanitized before use (no `<script>`, `<iframe>`,
event handlers or `javascript:` URLs; CSS cannot close its `<style>` or `@import`),
and option values are always escaped.

Env: `PROFULLSTACK_FOOTER_OFFLINE=1` never fetches; `PROFULLSTACK_FOOTER_TEMPLATE_URL` overrides the CDN URL.

MIT © Profullstack, Inc.
