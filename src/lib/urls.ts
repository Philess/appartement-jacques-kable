import { config } from '../data/property';

export const basePath = import.meta.env.BASE_URL;

export function sitePath(path = '') {
  return `${basePath}${path.replace(/^\//, '')}`;
}

export function absoluteSiteUrl(path = sitePath()) {
  return new URL(path, new URL(config.siteUrl.trim()).origin).href;
}
