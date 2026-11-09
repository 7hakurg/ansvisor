import Stripe from 'stripe';

let client: Stripe | undefined;

function getClient(): Stripe {
  if (client) return client;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      'STRIPE_SECRET_KEY is not set: Stripe billing is only available when it is configured (cloud mode).',
    );
  }
  client = new Stripe(key);
  return client;
}

/**
 * The Stripe client, created on first use rather than at import.
 *
 * Self-hosted installs run without Stripe, and `next build` evaluates every
 * route module while collecting page data — an eager `new Stripe(undefined)`
 * would fail the build and any route that merely imports this file. Using the
 * client without a key throws a clear error instead.
 */
export const stripe: Stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    const real = getClient();
    const value = Reflect.get(real, prop, real);
    return typeof value === 'function' ? value.bind(real) : value;
  },
});

export const PRICE_IDS = {
  starter: {
    monthly: process.env.STRIPE_STARTER_MONTHLY_PRICE_ID!,
    annual: process.env.STRIPE_STARTER_ANNUAL_PRICE_ID,
  },
  growth: {
    monthly: process.env.STRIPE_GROWTH_MONTHLY_PRICE_ID!,
    annual: process.env.STRIPE_GROWTH_ANNUAL_PRICE_ID,
  },
} as const;

/** The Stripe price for a plan billed monthly or yearly; undefined when it isn't set up. */
export function priceIdFor(planId: string, interval: 'month' | 'year'): string | undefined {
  const prices = (PRICE_IDS as Record<string, { monthly?: string; annual?: string }>)[planId];
  return (interval === 'year' ? prices?.annual : prices?.monthly) || undefined;
}
