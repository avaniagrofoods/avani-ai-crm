/**
 * AVANI LOAN SERVICES — HOSTNAME & SURFACE ROUTING POLICY
 *
 * Separates the public business website (`avanifinserv.com`, `www.avanifinserv.com`)
 * from the private AVANI AI CRM (`avani-ai-crm.vercel.app`, `crm.avanifinserv.com`)
 * while keeping ALL CRM application and API routes strictly protected on every domain.
 */

export type AppSurface = 'public' | 'crm';

/**
 * Exact public marketing, resource, legal, and SEO routes allowed WITHOUT authentication
 * strictly on public website hosts (`surface === 'public'`).
 */
export const PUBLIC_WEBSITE_PATHS = new Set<string>([
  '/',
  '/about',
  '/services',
  '/blog',
  '/contact',
  '/enquiry',
  '/privacy',
  '/terms',
  '/disclaimer'
]);

/**
 * Dynamic public content route prefixes allowed on public website hosts.
 */
export const PUBLIC_WEBSITE_PREFIXES = ['/services/', '/blog/'] as const;

/**
 * Technical SEO metadata endpoints always accessible to search engines without login redirect.
 */
export const PUBLIC_SEO_METADATA_PATHS = new Set<string>(['/robots.txt', '/sitemap.xml']);

/**
 * CRM routes that MUST ALWAYS require authentication regardless of hostname.
 */
export const PROTECTED_CRM_PAGE_PREFIXES = [
  '/crm',
  '/leads',
  '/contacts',
  '/inbox',
  '/broadcasts',
  '/campaigns',
  '/schedule',
  '/templates',
  '/forms',
  '/conversational-components',
  '/tags',
  '/columns',
  '/opts',
  '/webhooks',
  '/gallery',
  '/faq',
  '/assistant',
  '/flows',
  '/projects',
  '/tasks',
  '/settings',
  '/knowledge',
  '/developers',
  '/guide'
] as const;

export function normalizeHostname(rawHost?: string | null): string {
  if (!rawHost) return '';
  const first = String(rawHost).split(',')[0].trim().toLowerCase();
  return first.replace(/:\d+$/, '');
}

/**
 * Classifies a request hostname into either the `public` AVANI LOAN SERVICES website
 * surface or the private `crm` AVANI AI CRM surface.
 *
 * Rules:
 * 1. Explicit `APP_SURFACE_MODE` env override (`'crm'` or `'public'`) is respected when set.
 * 2. `avani-ai-crm.vercel.app`, `*.vercel.app` CRM previews, and `crm.avanifinserv.com` -> `'crm'`.
 * 3. `avanifinserv.com`, `www.avanifinserv.com`, `localhost`, `127.0.0.1` -> `'public'`.
 * 4. Unknown custom hostnames fail closed to `'crm'` unless explicitly public.
 */
export function resolveAppSurface(rawHost?: string | null): AppSurface {
  const envOverride = String(process.env.APP_SURFACE_MODE || '').trim().toLowerCase();
  if (envOverride === 'crm') return 'crm';
  if (envOverride === 'public') return 'public';

  const host = normalizeHostname(rawHost);
  if (!host) return 'public';

  if (
    host === 'avani-ai-crm.vercel.app' ||
    host === 'crm.avanifinserv.com' ||
    host.endsWith('.vercel.app')
  ) {
    return 'crm';
  }

  if (
    host === 'avanifinserv.com' ||
    host === 'www.avanifinserv.com' ||
    host === 'localhost' ||
    host === '127.0.0.1'
  ) {
    return 'public';
  }

  // Unknown hostnames fail closed to CRM auth surface
  return 'crm';
}

export function isPublicWebsitePath(pathname: string): boolean {
  if (!pathname) return false;
  const clean = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  if (PUBLIC_WEBSITE_PATHS.has(clean)) return true;
  if (isProtectedCrmPath(clean)) return false;
  return PUBLIC_WEBSITE_PREFIXES.some(
    (prefix) => clean.startsWith(prefix) && clean.length > prefix.length && !clean.includes('..')
  );
}

export function isProtectedCrmPath(pathname: string): boolean {
  if (!pathname) return false;
  return PROTECTED_CRM_PAGE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

/**
 * Determines whether an incoming request on `pathname` and `rawHost` is allowed
 * to render a public website page without authentication.
 *
 * - On CRM hosts (`avani-ai-crm.vercel.app`, `crm.avanifinserv.com`): ONLY `/login` (and SEO metadata)
 *   is unauthenticated; `/` and all other pages require an active ADMIN session.
 * - On public website hosts (`avanifinserv.com`, `www.avanifinserv.com`): `/`, `/about`, `/services`,
 *   `/services/<slug>`, `/blog`, `/blog/<slug>`, `/contact`, `/enquiry`, `/privacy`, `/terms`,
 *   `/disclaimer`, and `/login` are reachable; ALL CRM routes (`/crm`, `/leads`, etc.) and private
 *   `/api/*` endpoints remain strictly protected.
 */
export function isPubliclyAccessiblePage(pathname: string, rawHost?: string | null): boolean {
  const clean = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  if (clean === '/login' || PUBLIC_SEO_METADATA_PATHS.has(clean)) return true;
  if (isProtectedCrmPath(clean)) return false;
  const surface = resolveAppSurface(rawHost);
  if (surface === 'public' && isPublicWebsitePath(clean)) {
    return true;
  }
  return false;
}
