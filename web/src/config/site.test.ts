import { afterEach, describe, expect, it, vi } from 'vitest';
import { publicEmail, publicUrl } from './site';

/** The brand config, read fresh under the environment a test sets. */
async function loadSite() {
  vi.resetModules();
  return (await import('./site')).siteConfig;
}

describe('publicUrl', () => {
  it('keeps an http(s) address, without trailing slashes', () => {
    expect(publicUrl(' https://oppla.ai/terms/ ')).toBe('https://oppla.ai/terms');
    expect(publicUrl('http://localhost:13000')).toBe('http://localhost:13000');
  });

  it('turns down an unset, blank, malformed or non-web address', () => {
    expect(publicUrl(undefined)).toBeNull();
    expect(publicUrl('  ')).toBeNull();
    expect(publicUrl('not a url')).toBeNull();
    expect(publicUrl('javascript:alert(1)')).toBeNull();
  });
});

describe('publicEmail', () => {
  it('keeps a plain address and turns down anything else', () => {
    expect(publicEmail(' hi@oppla.ai ')).toBe('hi@oppla.ai');
    expect(publicEmail('Oppla <hi@oppla.ai>')).toBeNull();
    expect(publicEmail('hi@oppla')).toBeNull();
    expect(publicEmail(undefined)).toBeNull();
  });
});

describe('siteConfig', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('is Oppla, with no Ansvisor address left anywhere in it', async () => {
    const site = await loadSite();
    expect(site.name).toBe('Oppla');
    expect(JSON.stringify(site)).not.toMatch(/ansvisor/i);
  });

  it('sends sales and feedback to the support address by default', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPPORT_EMAIL', 'team@oppla.ai');
    const site = await loadSite();
    expect(site.links.contactSales).toBe('mailto:team@oppla.ai');
    expect(site.links.feedback).toBe('mailto:team@oppla.ai');
    expect(site.links.pricing).toBeNull();
  });

  it('links no legal page until one is set', async () => {
    expect((await loadSite()).legal).toEqual({ privacy: null, terms: null });

    vi.stubEnv('NEXT_PUBLIC_TERMS_URL', 'https://oppla.ai/terms');
    vi.stubEnv('NEXT_PUBLIC_PRIVACY_URL', 'https://oppla.ai/privacy');
    expect((await loadSite()).legal).toEqual({
      privacy: 'https://oppla.ai/privacy',
      terms: 'https://oppla.ai/terms',
    });
  });

  it('builds the share image from the app address', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://app.example.com/');
    expect((await loadSite()).ogImage).toBe('https://app.example.com/opengraph-image');
  });
});
