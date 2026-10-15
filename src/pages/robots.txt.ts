import type { APIRoute } from 'astro';
import { config, released } from '../data/property';

export const GET: APIRoute = () => new Response(
  released
    ? `User-agent: *\nAllow: /\nSitemap: ${new URL('/sitemap.xml', config.siteUrl).href}\n`
    : 'User-agent: *\nDisallow: /\n',
  { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
);
