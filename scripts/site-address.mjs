import { isIP } from 'node:net';

/** @param {unknown} value */
export function normalizeBase(value = '/') {
  if (typeof value !== 'string') throw new TypeError('basePath doit être un chemin texte.');
  const base = value.trim();
  if (base === '' || base === '/') return '/';
  if (!/^\/[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*\/?$/.test(base) ||
      base.split('/').some((part) => part === '.' || part === '..')) {
    throw new TypeError('basePath doit être un sous-chemin absolu simple, sans URL, encodage ni traversée.');
  }
  return base.endsWith('/') ? base : `${base}/`;
}

/** @param {unknown} value */
export function normalizeSiteUrl(value) {
  if (typeof value !== 'string') throw new TypeError('siteUrl doit être une origine HTTPS publique.');
  const url = new URL(value.trim());
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash ||
      url.pathname !== '/' || url.port || !url.hostname.includes('.') ||
      isIP(url.hostname.replace(/^\[|\]$/g, '')) !== 0 ||
      /(^localhost$|:|\.(local|localhost|lan|internal|test|invalid|example)$|(^|\.)example\.(com|org|net)$)/i.test(url.hostname)) {
    throw new TypeError('siteUrl doit être le domaine HTTPS public réel, sans chemin ni identifiants.');
  }
  return url.origin;
}

/** @param {unknown} configured @param {boolean} release @param {string | undefined} override */
export function buildBase(configured, release, override) {
  const base = normalizeBase(configured);
  return normalizeBase(override ?? (release ? base : '/'));
}
