// React server component. No hooks and no JSX, so it renders on the server in
// Next's App Router (and any React 18+ SSR) and needs no build step here.
// Async: the template is the CDN's @latest, fetched and cached by index.js.

import { createElement } from 'react';
import { footerHtml, footerHtmlSync } from './index.js';

/** @param {import('./render.js').FooterOptions} props */
export async function Footer(props) {
  const html = await footerHtml(props);
  return createElement('div', { style: { display: 'contents' }, dangerouslySetInnerHTML: { __html: html } });
}

/** Synchronous variant from the bundled template, for client components or old React. */
export function FooterSync(props) {
  return createElement('div', { style: { display: 'contents' }, dangerouslySetInnerHTML: { __html: footerHtmlSync(props) } });
}

export default Footer;
