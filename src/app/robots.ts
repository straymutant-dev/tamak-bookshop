// STRAYMUTANT.DEV — Tamak Bookshop
import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';

// The admin host must never appear in search results; the shop host may, except for private areas.
export default async function robots(): Promise<MetadataRoute.Robots> {
  const host = ((await headers()).get('host') ?? '').split(':')[0];

  if (host.startsWith('admin.')) {
    return { rules: { userAgent: '*', disallow: '/' } };
  }

  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '');
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/account', '/vendor', '/auth', '/store/cart', '/store/track', '/api'],
    },
    ...(base ? { sitemap: `${base}/sitemap.xml` } : {}),
  };
}