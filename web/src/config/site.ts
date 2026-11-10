/**
 * The product's own brand: its name and the public addresses the app links
 * to. Every visible mention of the product reads from here, so a rebrand is
 * this file and the logo files in /public, not a search through the app.
 *
 * Addresses can be set per deployment with NEXT_PUBLIC_* variables (baked in
 * at build time). A legal page left unset is not linked at all, rather than
 * linked to a page that doesn't exist.
 */

/** A trimmed http(s) URL, or null for one that is unset or isn't one. */
export function publicUrl(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    return url.protocol === 'https:' || url.protocol === 'http:' ? trimmed.replace(/\/+$/, '') : null;
  } catch {
    return null;
  }
}

/** A plain e-mail address, or null. */
export function publicEmail(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(trimmed) ? trimmed : null;
}

export const BRAND_NAME = 'Oppla';

const marketingUrl = publicUrl(process.env.NEXT_PUBLIC_MARKETING_URL) ?? 'https://oppla.ai';
const appUrl = publicUrl(process.env.NEXT_PUBLIC_APP_URL) ?? 'https://aeo.oppla.ai';
const supportEmail = publicEmail(process.env.NEXT_PUBLIC_SUPPORT_EMAIL) ?? 'support@oppla.ai';
const contactUrl = publicUrl(process.env.NEXT_PUBLIC_CONTACT_SALES_URL) ?? `mailto:${supportEmail}`;

export const siteConfig = {
  name: BRAND_NAME,
  /** The word a download's file name starts with, e.g. "oppla_prompts.csv". */
  fileWord: BRAND_NAME.toLowerCase(),
  description:
    "Monitor, analyze, and optimize your brand's visibility in AI-powered search engines like ChatGPT, Gemini, Google AI, and more.",
  url: marketingUrl,
  /** The marketing site's host as people write it, e.g. "oppla.ai". */
  host: new URL(marketingUrl).host.replace(/^www\./, ''),
  appUrl,
  ogImage: `${appUrl}/opengraph-image`,
  supportEmail,
  links: {
    docs: publicUrl(process.env.NEXT_PUBLIC_DOCS_URL) ?? 'https://docs.oppla.ai',
    feedback: publicUrl(process.env.NEXT_PUBLIC_FEEDBACK_URL) ?? `mailto:${supportEmail}`,
    contactSales: contactUrl,
    /** A page with every plan's features, or null: no link is shown then. */
    pricing: publicUrl(process.env.NEXT_PUBLIC_PRICING_URL),
  },
  legal: {
    privacy: publicUrl(process.env.NEXT_PUBLIC_PRIVACY_URL),
    terms: publicUrl(process.env.NEXT_PUBLIC_TERMS_URL),
  },
} as const;

export type SiteConfig = typeof siteConfig;
