import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  AUTH_EMAILS,
  AUTH_EMAIL_DIR,
  authEmailEnv,
  confirmLink,
  renderAuthEmail,
} from './auth-email-templates.js';

/**
 * The Supabase Auth e-mails, in Oppla's shell. Supabase fetches each body
 * from the web app (web/public/email/auth) and fills its Go template
 * placeholders; the links go to the web app's /auth/confirm, which verifies
 * the token server-side and signs the person in.
 */

const here = dirname(fileURLToPath(import.meta.url));
const publicDir = join(here, '..', '..', '..', 'web', 'public');

const byKey = Object.fromEntries(AUTH_EMAILS.map((email) => [email.key, email]));

describe('AUTH_EMAILS', () => {
  it('covers every template Supabase Auth sends', () => {
    expect(AUTH_EMAILS.map((email) => email.key).sort()).toEqual(
      [
        'confirmation',
        'email_change',
        'email_changed_notification',
        'identity_linked_notification',
        'identity_unlinked_notification',
        'invite',
        'magic_link',
        'mfa_factor_enrolled_notification',
        'mfa_factor_unenrolled_notification',
        'password_changed_notification',
        'phone_changed_notification',
        'reauthentication',
        'recovery',
      ].sort(),
    );
  });

  it('gives each one an Oppla subject', () => {
    for (const email of AUTH_EMAILS) {
      expect(email.subject, email.key).toMatch(/Oppla|{{ \.Token }}/);
    }
  });
});

describe('confirmLink', () => {
  it("verifies on the web app's /auth/confirm, then goes where Supabase was told", () => {
    expect(confirmLink('invite')).toBe(
      '{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&amp;type=invite&amp;redirect_to={{ .RedirectTo }}',
    );
  });
});

describe('renderAuthEmail', () => {
  it('links each action e-mail to /auth/confirm with its own OTP type', () => {
    const types = {
      confirmation: 'signup',
      invite: 'invite',
      recovery: 'recovery',
      magic_link: 'magiclink',
      email_change: 'email_change',
    };
    for (const [key, type] of Object.entries(types)) {
      const html = renderAuthEmail(byKey[key]);
      expect(html, key).toContain(
        `/auth/confirm?token_hash={{ .TokenHash }}&amp;type=${type}&amp;`,
      );
      expect(html, key).not.toContain('ConfirmationURL');
    }
  });

  it('shows the code, not a link, for re-authentication', () => {
    const html = renderAuthEmail(byKey.reauthentication);
    expect(html).toContain('{{ .Token }}');
    expect(html).not.toContain('/auth/confirm');
  });

  it('names the addresses an e-mail change is between', () => {
    expect(renderAuthEmail(byKey.email_change)).toContain('{{ .NewEmail }}');
    expect(renderAuthEmail(byKey.email_changed_notification)).toContain('{{ .OldEmail }}');
  });

  it("draws the mark from the web app and the brand's shell", () => {
    const html = renderAuthEmail(byKey.confirmation);
    expect(html).toContain('src="{{ .SiteURL }}/email/oppla-mark.png"');
    expect(html).toMatch(/^<!DOCTYPE html>/);
    expect(html).toContain('<title>Confirm your Oppla account</title>');
  });
});

describe('authEmailEnv', () => {
  it('points Supabase at each template on the web app and sets its subject', () => {
    const env = authEmailEnv('https://app.example.com/');
    expect(env.GOTRUE_MAILER_TEMPLATES_INVITE).toBe(
      'https://app.example.com/email/auth/invite.html',
    );
    expect(env.GOTRUE_MAILER_TEMPLATES_PASSWORD_CHANGED_NOTIFICATION).toBe(
      'https://app.example.com/email/auth/password_changed_notification.html',
    );
    expect(env.GOTRUE_MAILER_SUBJECTS_MAGIC_LINK).toBe(byKey.magic_link.subject);
    expect(Object.keys(env)).toHaveLength(AUTH_EMAILS.length * 2);
  });
});

describe('the files the web app serves', () => {
  it('match what renderAuthEmail draws (run `npm run email:auth` after a change)', () => {
    for (const email of AUTH_EMAILS) {
      const file = join(publicDir, AUTH_EMAIL_DIR, `${email.key}.html`);
      expect(readFileSync(file, 'utf8'), email.key).toBe(renderAuthEmail(email));
    }
  });
});
