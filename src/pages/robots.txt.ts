import type { APIRoute } from 'astro';
import { released } from '../data/property';
import { absoluteSiteUrl, sitePath } from '../lib/urls';

export const GET: APIRoute = () => new Response(
  released
    ? `User-agent: *\nAllow: ${sitePath()}\nSitemap: ${absoluteSiteUrl(sitePath('sitemap.xml'))}\n`
    : 'User-agent: *\nDisallow: /\n',
  { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
);
