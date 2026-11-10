/**
 * The product's own brand on the server: its name, its public site and the
 * names it goes by when it fetches pages or posts webhooks. Everything that
 * says who we are to a person or to another site reads from here.
 *
 * MARKETING_URL and PRIVACY_URL can be set per deployment; an unset or
 * malformed value falls back to the defaults below.
 */

/** A trimmed http(s) URL without trailing slashes, or null. */
export function httpUrl(value) {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    return url.protocol === 'https:' || url.protocol === 'http:' ? trimmed.replace(/\/+$/, '') : null;
  } catch {
    return null;
  }
}

export const BRAND_NAME = 'Oppla';

/** The public marketing site. */
export const BRAND_URL = httpUrl(process.env.MARKETING_URL) ?? 'https://oppla.ai';

/** The site's host as people write it, e.g. "oppla.ai". */
export const BRAND_HOST = new URL(BRAND_URL).host.replace(/^www\./, '');

/** Where e-mails link for how personal details are used. */
export const PRIVACY_URL = httpUrl(process.env.PRIVACY_URL) ?? BRAND_URL;

/** A user agent naming the product and its site: `${product}/1.0 (+site)`. */
export const productAgent = (product) => `${BRAND_NAME}${product}/1.0 (+${BRAND_URL})`;

/** The crawler's name, as robots.txt rules name it (User-agent: OpplaBot). */
export const BOT_TOKEN = `${BRAND_NAME}Bot`;

/** The crawler's user agent, as sites see it when pages are fetched. */
export const BOT_USER_AGENT = `Mozilla/5.0 (compatible; ${BOT_TOKEN}/1.0; +${BRAND_URL})`;
