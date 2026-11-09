import { afterEach, describe, expect, it, vi } from 'vitest';

async function loadModule() {
  vi.resetModules();
  return import('./stripe');
}

describe('lib/stripe', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('loads without STRIPE_SECRET_KEY so self-hosted builds and routes can import it', async () => {
    vi.stubEnv('STRIPE_SECRET_KEY', '');
    await expect(loadModule()).resolves.toHaveProperty('stripe');
  });

  it('throws a clear error when Stripe is used without a key', async () => {
    vi.stubEnv('STRIPE_SECRET_KEY', '');
    const { stripe } = await loadModule();
    expect(() => stripe.customers).toThrow(/STRIPE_SECRET_KEY is not set/);
  });

  it('creates the client on first use and reuses it', async () => {
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_dummy');
    const { stripe } = await loadModule();
    const first = stripe.customers;
    expect(first).toBeDefined();
    expect(stripe.customers).toBe(first);
  });

  it('keeps methods bound to the real client', async () => {
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_dummy');
    const { stripe } = await loadModule();
    const { constructEvent } = stripe.webhooks;
    expect(typeof constructEvent).toBe('function');
  });
});
