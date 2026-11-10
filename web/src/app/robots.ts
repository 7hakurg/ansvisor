import type { MetadataRoute } from 'next';

/**
 * Block search engines from indexing the application subdomain.
 *
 * The marketing site (siteConfig.url) is hosted separately and
 * is the surface that should be indexed. The Next.js app at `aeo.oppla.ai`
 * is purely the authenticated product UI and provides no value in search.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        disallow: '/',
      },
    ],
  };
}
