import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  EMAIL_THEME,
  emailButton,
  emailCode,
  emailLogoUrl,
  escapeEmailHtml,
  isFullDocument,
  renderEmailLayout,
  withEmailLayout,
} from './email-layout.js';

/**
 * Every e-mail Oppla sends wears one shell: the mark and name on top, a white
 * card for the message, and a quiet footer. Messages that already draw their
 * own document keep it.
 */

afterEach(() => vi.unstubAllEnvs());

describe('escapeEmailHtml', () => {
  it('escapes markup and quotes', () => {
    expect(escapeEmailHtml(`<a href="x">'&'</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;',
    );
    expect(escapeEmailHtml(null)).toBe('');
  });
});

describe('renderEmailLayout', () => {
  const page = renderEmailLayout({
    title: 'Confirm your email',
    preheader: 'One click and you are in.',
    contentHtml: '<p>Body</p>',
    logoUrl: 'https://app.example.com/email/oppla-mark.png',
  });

  it('is a complete, light-only HTML document', () => {
    expect(page.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(page).toContain('<meta name="color-scheme" content="light">');
    expect(page).toContain('<title>Confirm your email</title>');
    expect(page.trimEnd().endsWith('</html>')).toBe(true);
  });

  it('carries the mark, the message and the footer', () => {
    expect(page).toContain('src="https://app.example.com/email/oppla-mark.png"');
    expect(page).toContain('alt="Oppla"');
    expect(page).toContain('<p>Body</p>');
    expect(page).toContain('https://oppla.ai');
  });

  it('hides the preheader from the body but keeps it for the inbox preview', () => {
    expect(page).toMatch(/display:none[^>]*>One click and you are in\./);
  });

  it('escapes the title and preheader it is given', () => {
    const risky = renderEmailLayout({ title: '<b>x</b>', preheader: '"y"', contentHtml: '' });
    expect(risky).toContain('<title>&lt;b&gt;x&lt;/b&gt;</title>');
    expect(risky).toContain('&quot;y&quot;');
  });

  it('can take a footer note in place of the default one', () => {
    const custom = renderEmailLayout({
      title: 't',
      contentHtml: '',
      footerNote: 'Why you got this.',
    });
    expect(custom).toContain('Why you got this.');
  });
});

describe('emailButton and emailCode', () => {
  it('draws a bulletproof button with the link escaped', () => {
    const button = emailButton('https://app.example.com/a?b=1&c=2', 'Open "Oppla"');
    expect(button).toContain('href="https://app.example.com/a?b=1&amp;c=2"');
    expect(button).toContain('Open &quot;Oppla&quot;');
    expect(button).toContain(`background-color:${EMAIL_THEME.ink}`);
  });

  it('leaves a template placeholder in a link untouched when told to', () => {
    const button = emailButton('{{ .SiteURL }}/auth/confirm', 'Go', { raw: true });
    expect(button).toContain('href="{{ .SiteURL }}/auth/confirm"');
  });

  it('draws a one-time code large and spaced', () => {
    expect(emailCode('123456')).toMatch(/letter-spacing:[^;]+;[^>]*>123456</);
  });
});

describe('emailLogoUrl', () => {
  it("points at the mark on the app's own site", () => {
    vi.stubEnv('PUBLIC_APP_URL', 'https://app.example.com/dashboard');
    expect(emailLogoUrl()).toBe('https://app.example.com/email/oppla-mark.png');
  });

  it('has none without a usable app address', () => {
    vi.stubEnv('PUBLIC_APP_URL', 'not a url');
    expect(emailLogoUrl()).toBeNull();
  });
});

describe('withEmailLayout', () => {
  it('puts a fragment inside the shell, with the subject as its title', () => {
    vi.stubEnv('PUBLIC_APP_URL', 'https://app.example.com');
    const html = withEmailLayout('<div>Your first results are ready</div>', 'Results');
    expect(isFullDocument(html)).toBe(true);
    expect(html).toContain('<div>Your first results are ready</div>');
    expect(html).toContain('<title>Results</title>');
    expect(html).toContain('https://app.example.com/email/oppla-mark.png');
  });

  it('keeps a message that is already a whole document as it is', () => {
    const own = '<!doctype html><html><body>Pulse</body></html>';
    expect(withEmailLayout(own, 'Pulse')).toBe(own);
    expect(withEmailLayout('<HTML lang="en"><body>x</body></HTML>', 's')).toMatch(/^<HTML/);
  });

  it('leaves an empty message empty', () => {
    expect(withEmailLayout('', 's')).toBe('');
    expect(withEmailLayout(undefined, 's')).toBeUndefined();
  });
});
