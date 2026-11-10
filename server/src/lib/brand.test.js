import { afterEach, describe, expect, it, vi } from 'vitest';
import { httpUrl } from './brand.js';

async function loadBrand() {
  vi.resetModules();
  return import('./brand.js');
}

describe('httpUrl', () => {
  it('keeps an http(s) address without trailing slashes', () => {
    expect(httpUrl(' https://oppla.ai/ ')).toBe('https://oppla.ai');
  });

  it('turns down anything else', () => {
    expect(httpUrl(undefined)).toBeNull();
    expect(httpUrl('')).toBeNull();
    expect(httpUrl('oppla.ai')).toBeNull();
    expect(httpUrl('ftp://oppla.ai')).toBeNull();
  });
});

describe('brand', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('is Oppla at oppla.ai by default, with nothing of Ansvisor', async () => {
    const brand = await loadBrand();
    expect(brand.BRAND_NAME).toBe('Oppla');
    expect(brand.BRAND_URL).toBe('https://oppla.ai');
    expect(brand.BRAND_HOST).toBe('oppla.ai');
    expect(brand.PRIVACY_URL).toBe('https://oppla.ai');
    expect(brand.BOT_TOKEN).toBe('OpplaBot');
    expect(brand.BOT_USER_AGENT).toBe('Mozilla/5.0 (compatible; OpplaBot/1.0; +https://oppla.ai)');
    expect(brand.productAgent('SiteAudit')).toBe('OpplaSiteAudit/1.0 (+https://oppla.ai)');
    expect(JSON.stringify(Object.values(brand).map(String))).not.toMatch(/ansvisor/i);
  });

  it('takes the site and privacy page from the environment', async () => {
    vi.stubEnv('MARKETING_URL', 'https://www.example.com/');
    vi.stubEnv('PRIVACY_URL', 'https://www.example.com/privacy');
    const brand = await loadBrand();
    expect(brand.BRAND_URL).toBe('https://www.example.com');
    expect(brand.BRAND_HOST).toBe('example.com');
    expect(brand.PRIVACY_URL).toBe('https://www.example.com/privacy');
  });

  it('ignores a malformed site address', async () => {
    vi.stubEnv('MARKETING_URL', 'not a url');
    expect((await loadBrand()).BRAND_URL).toBe('https://oppla.ai');
  });
});
