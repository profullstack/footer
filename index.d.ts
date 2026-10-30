export interface FooterLink { label: string; href: string; rel?: string }
export interface FooterBadge {
  href: string;
  /** Image URL (http(s) or root-relative). */
  src: string;
  alt: string;
  width?: number;
  height?: number;
}
export interface RingOptions { slug?: string; name?: string; host?: string }
export interface FooterOptions {
  /** The site's homepage; hops are measured from it. */
  site: string;
  name?: string;
  /** The site's own links, shown before any house links. */
  links?: FooterLink[];
  /** Defaults to Profullstack, Inc. / https://profullstack.com/ */
  owner?: { name?: string; url?: string };
  /** First copyright year: renders "since–year". */
  since?: number;
  /** Override the copyright year (defaults to the current UTC year). */
  year?: number;
  tagline?: string;
  ring?: RingOptions;
  /** false leaves the <style> out (bring your own CSS). */
  css?: boolean;
  /** false hides the template's house links. */
  houseLinks?: boolean;
  /** CSP nonce for the inline <style> (style-src 'nonce-...'). */
  nonce?: string;
  /** false hides the newsletter form (it posts to SUBSCRIBE_URL; CSP form-action must allow https://pit.world). */
  subscribe?: boolean;
  /** Badges only this site shows, after the house badges (e.g. a game's Foundplay badge). */
  badges?: FooterBadge[];
  /** Destination for the shared PwaMart badge; defaults to the site's PwaMart listing. */
  pwamartHref?: string;
}
export interface FooterTemplate {
  version: string;
  renderer: number;
  css: string;
  link: string;
  footer: string;
  houseLinks?: FooterLink[];
}
export interface RingLinks { ring: string; previous: string; next: string; random: string }
export interface Descriptor {
  openwebring: '0.1';
  site: { url: string; name: string };
  made_by: 'human' | 'ai' | 'both';
  rings: { ring: string; slug: string }[];
}
export interface DescriptorOptions {
  site: string;
  name?: string;
  slug?: string;
  madeBy?: 'human' | 'ai' | 'both';
  ring?: RingOptions;
}

export declare const RENDERER: number;
export declare const TEMPLATE_URL: string;
export declare const SUBSCRIBE_URL: string;
export declare function subscribeForm(site: string, nonce?: string): string;
/** The form's browser half: posts JSON to pit.world/api/subscribe and reports inline. Inlined by subscribeForm. */
export declare function wireSubscribe(form: HTMLFormElement | null): void;
export declare function siteBadges(badges?: FooterBadge[]): string;
export declare const DEFAULT_RING: Required<RingOptions>;
export declare const DEFAULT_OWNER: { name: string; url: string };
export declare const bundledTemplate: FooterTemplate;

export interface TemplateSourceOptions {
  /**
   * Pin the CDN template: an exact version ('0.6.1') is immutable on jsDelivr, so a later (or
   * compromised) publish cannot change this site's footer; 'bundled' never fetches; default 'latest'.
   * Fleet-wide alternative: the PROFULLSTACK_FOOTER_VERSION env var.
   */
  version?: string;
  /** Full template URL; wins over `version`. */
  templateUrl?: string;
}
export declare function templateUrl(version?: string): string;
export declare function footerHtml(opts: FooterOptions & TemplateSourceOptions & { template?: FooterTemplate }): Promise<string>;
export declare function footerHtmlSync(opts: FooterOptions): string;
export declare function renderFooter(template: FooterTemplate, opts: FooterOptions): string;
export declare function latestTemplate(opts?: {
  url?: string;
  /** '0.6.1', 'latest' (default) or 'bundled'. */
  version?: string;
  ttlMs?: number;
  timeoutMs?: number;
  fetch?: typeof fetch;
  now?: () => number;
}): Promise<FooterTemplate>;
export declare function resetTemplateCache(): void;
export declare function ringLinks(site: string, ring?: RingOptions): RingLinks;
export declare function canonicalSite(site: string): string;
export declare function descriptor(opts: DescriptorOptions): Descriptor;
export declare function descriptorResponse(opts: DescriptorOptions): Response;
export declare function escapeHtml(value: unknown): string;
/** Allowlist HTML sanitizer used on every CDN template. */
export declare function sanitizeTemplate(html: string): string;
export declare function sanitizeHtml(html: string, opts?: { styleToken?: string; textTokens?: string[] }): string;
export declare function sanitizeCss(css: string): string;
/** http(s), mailto or relative URL, normalized; null when anything else. */
export declare function safeUrl(url: string): string | null;
