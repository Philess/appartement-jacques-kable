import type { APIRoute } from 'astro';
import { released } from '../data/property';
import { absoluteSiteUrl, sitePath } from '../lib/urls';

export const GET: APIRoute = () => {
  const urls = released ? ['/', '/mentions-legales/', '/confidentialite/'].map((path) =>
    `<url><loc>${absoluteSiteUrl(sitePath(path)).replace(/&/g, '&amp;')}</loc></url>`).join('') : '';
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`,
    { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
