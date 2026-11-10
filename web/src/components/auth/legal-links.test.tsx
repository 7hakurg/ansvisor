import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * The Terms and Privacy links: only the pages the deployment has, never a
 * link to a page that doesn't exist.
 */

async function render() {
  vi.resetModules();
  const { LegalLinks } = await import('./legal-links');
  return renderToStaticMarkup(<LegalLinks terms="Terms" privacy="Privacy" />);
}

describe('LegalLinks', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('shows nothing while neither page is set', async () => {
    expect(await render()).toBe('');
  });

  it('links each page that is set, in a new tab', async () => {
    vi.stubEnv('NEXT_PUBLIC_TERMS_URL', 'https://oppla.ai/terms');
    const html = await render();
    expect(html).toContain('href="https://oppla.ai/terms"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).not.toContain('Privacy');

    vi.stubEnv('NEXT_PUBLIC_PRIVACY_URL', 'https://oppla.ai/privacy');
    expect(await render()).toContain('href="https://oppla.ai/privacy"');
  });
});
