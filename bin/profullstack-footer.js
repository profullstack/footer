#!/usr/bin/env node
// profullstack-footer: print the footer or the ring descriptor for a site.
//
//   profullstack-footer html --site https://example.com/ [--name Example] [--link Docs=/docs]... [--since 2024] [--no-css]
//   profullstack-footer json --site https://example.com/      the ring URLs
//   profullstack-footer descriptor --site https://example.com/ [--slug example-com] [--name Example]
//   profullstack-footer template                               the @latest template this install would use
//   profullstack-footer check https://example.com/             does the live page carry prev/next/random?

import { parseArgs } from 'node:util';
import { footerHtml, footerHtmlSync, ringLinks, descriptor, latestTemplate, canonicalSite } from '../src/index.js';

const HELP = `usage: profullstack-footer <html|json|descriptor|template|check> [options]

  --site <url>        the site's homepage (required except for template)
  --name <name>       site name (descriptor, data attribute)
  --link Label=href   a footer link; repeat for more
  --since <year>      first copyright year
  --tagline <text>    short line after the copyright
  --slug <slug>       ring member slug (descriptor; default host with dashes)
  --offline           use the bundled template, do not fetch @latest
  --no-css            leave the <style> out
`;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    site: { type: 'string' },
    name: { type: 'string' },
    link: { type: 'string', multiple: true },
    since: { type: 'string' },
    tagline: { type: 'string' },
    slug: { type: 'string' },
    offline: { type: 'boolean' },
    'no-css': { type: 'boolean' },
    help: { type: 'boolean', short: 'h' },
  },
});

const [cmd, arg] = positionals;
if (values.help || !cmd) {
  process.stdout.write(HELP);
  process.exit(cmd || values.help ? 0 : 2);
}

const site = values.site ?? arg;
const need = () => {
  if (!site) {
    process.stderr.write('profullstack-footer: --site is required\n');
    process.exit(2);
  }
  return site;
};
const links = (values.link ?? []).map((s) => {
  const i = s.indexOf('=');
  return { label: s.slice(0, i), href: s.slice(i + 1) };
});
const opts = () => ({
  site: need(),
  name: values.name,
  links,
  since: values.since ? Number(values.since) : undefined,
  tagline: values.tagline,
  css: !values['no-css'],
});

switch (cmd) {
  case 'html':
    process.stdout.write((values.offline ? footerHtmlSync(opts()) : await footerHtml(opts())) + '\n');
    break;
  case 'json':
    process.stdout.write(JSON.stringify(ringLinks(need()), null, 2) + '\n');
    break;
  case 'descriptor':
    process.stdout.write(JSON.stringify(descriptor({ site: need(), name: values.name, slug: values.slug }), null, 2) + '\n');
    break;
  case 'template':
    process.stdout.write(JSON.stringify(await latestTemplate(), null, 2) + '\n');
    break;
  case 'check': {
    const home = canonicalSite(need());
    const res = await fetch(home, { redirect: 'follow', headers: { 'user-agent': 'profullstack-footer-check' } });
    const html = (await res.text()).replace(/&amp;/g, '&');
    const want = ringLinks(home);
    let ok = res.ok;
    for (const k of /** @type {const} */ (['previous', 'next', 'random'])) {
      const has = html.includes(want[k]);
      ok &&= has;
      process.stdout.write(`${has ? 'ok  ' : 'MISS'} ${k} ${want[k]}\n`);
    }
    process.stdout.write(`${home} ${res.status} ${ok ? 'links the ring' : 'does NOT link the ring'}\n`);
    process.exit(ok ? 0 : 1);
  }
  default:
    process.stderr.write(`profullstack-footer: unknown command ${cmd}\n${HELP}`);
    process.exit(2);
}
