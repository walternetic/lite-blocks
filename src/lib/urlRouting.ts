/**
 * URL Routing & Deep Linking for Lite Blocks (Block-Based Editor)
 *
 * Architecture:
 * - Workspaces are isolated virtual sites routed by path:
 *     /w/:workspaceId
 * - Individual pages are routed by permanent algorithmic ID (UUID):
 *     /w/:workspaceId/p/:pageId
 * - The human-readable semantic title is appended as a URL fragment (hash):
 *     #slug-titolo-pagina
 *
 * Why this format is resilient to future changes:
 * 1. Path Namespace (/w/... and /p/...): Prevents route collision with future app-level
 *    endpoints like /settings, /templates, /trash, /search, /share.
 * 2. Immutable Algorithmic ID (:pageId): Page renaming never breaks bookmarks, backlinks,
 *    or shared links.
 * 3. Title in Fragment (#slug): Title updates modify the URL fragment in-place via
 *    history.replaceState without re-rendering or creating unwanted browser history states.
 * 4. Extensible Sub-resources: Allows future paths like /w/:workspaceId/p/:pageId/history
 *    or /w/:workspaceId/views/table without breaking existing links.
 */

export function slugify(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accent diacritics
    .replace(/[^a-z0-9\s-]/g, '')     // keep letters, numbers, spaces, hyphens
    .trim()
    .replace(/[\s_-]+/g, '-')         // collapse spaces and underscores into single hyphens
    .replace(/^-+|-+$/g, '');         // trim hyphens
}

export function generateUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export interface RouteState {
  workspaceId: string | null;
  pageId: string | null;
  slug: string | null;
}

export function parseRouteUrl(): RouteState {
  if (typeof window === 'undefined') {
    return { workspaceId: null, pageId: null, slug: null };
  }

  const pathname = window.location.pathname;
  const hash = window.location.hash.replace(/^#/, '');

  // 1. Match /w/:workspaceId/p/:pageId
  const pageMatch = pathname.match(/^\/w\/([^\/]+)\/p\/([^\/]+)\/?$/);
  if (pageMatch) {
    return {
      workspaceId: decodeURIComponent(pageMatch[1]),
      pageId: decodeURIComponent(pageMatch[2]),
      slug: hash || null,
    };
  }

  // 2. Match /w/:workspaceId
  const wsMatch = pathname.match(/^\/w\/([^\/]+)\/?$/);
  if (wsMatch) {
    return {
      workspaceId: decodeURIComponent(wsMatch[1]),
      pageId: null,
      slug: hash || null,
    };
  }

  // 3. Backward Compatibility: query param ?ws=...&note=... or ?ws=...&page=...
  const params = new URLSearchParams(window.location.search);
  const queryWs = params.get('ws');
  const queryPage = params.get('note') || params.get('page') || params.get('p');
  if (queryWs) {
    return {
      workspaceId: queryWs,
      pageId: queryPage,
      slug: hash || null,
    };
  }

  return { workspaceId: null, pageId: null, slug: hash || null };
}

export function buildRouteUrl(
  workspaceId: string,
  pageId?: string | null,
  title?: string
): string {
  let url = `/w/${encodeURIComponent(workspaceId)}`;
  if (pageId) {
    url += `/p/${encodeURIComponent(pageId)}`;
    if (title) {
      const slug = slugify(title);
      if (slug) {
        url += `#${slug}`;
      }
    }
  }
  return url;
}

export function syncBrowserUrl(
  workspaceId: string,
  pageId?: string | null,
  title?: string,
  replace: boolean = false
): void {
  if (typeof window === 'undefined') return;

  const targetUrl = buildRouteUrl(workspaceId, pageId, title);
  const currentUrl = window.location.pathname + window.location.search + window.location.hash;

  if (targetUrl === currentUrl) return;

  if (replace) {
    window.history.replaceState({ workspaceId, pageId }, '', targetUrl);
  } else {
    window.history.pushState({ workspaceId, pageId }, '', targetUrl);
  }
}
