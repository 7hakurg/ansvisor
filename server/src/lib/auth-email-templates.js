/**
 * The Supabase Auth e-mails (sign-up, invite, password reset, magic link,
 * e-mail change, re-authentication, and the account-change notices) in
 * Oppla's shell, so they match what the app server sends.
 *
 * They're Go html/template bodies: Supabase Auth fetches each from the web
 * app (web/public/email/auth/<key>.html, GOTRUE_MAILER_TEMPLATES_*), fills
 * {{ .SiteURL }}, {{ .TokenHash }} and the rest, and escapes each value for
 * where it sits (a link's query, an attribute, text). The links go to the web
 * app's /auth/confirm, which verifies the token server-side, sets the session
 * cookies and goes on to {{ .RedirectTo }}: the page the app asked for.
 *
 * `npm run email:auth` writes the files; a test fails when they drift.
 */

import { BRAND_NAME } from './brand.js';
import {
  EMAIL_LOGO_PATH,
  emailButton,
  emailCode,
  emailFallbackLink,
  emailHeading,
  emailNote,
  emailParagraph,
  renderEmailLayout,
} from './email-layout.js';

/** Where the files live under the web app's public folder. */
export const AUTH_EMAIL_DIR = 'email/auth';

const SITE = '{{ .SiteURL }}';
const EMAIL = '<strong style="color:#0c0c0f;font-weight:600;">{{ .Email }}</strong>';
const NEW_EMAIL = '<strong style="color:#0c0c0f;font-weight:600;">{{ .NewEmail }}</strong>';
const OLD_EMAIL = '<strong style="color:#0c0c0f;font-weight:600;">{{ .OldEmail }}</strong>';
const EXPIRY = 'The link works once and expires in 24 hours.';
const NOT_YOU = `If you didn't make this change, <a href="${SITE}/forgot-password" target="_blank" style="color:#0c0c0f;text-decoration:underline;">reset your password</a> right away to secure your account.`;

/**
 * The link an action e-mail opens: /auth/confirm with the token hash and the
 * OTP type supabase.auth.verifyOtp expects for it.
 *
 * @param {'signup' | 'invite' | 'recovery' | 'magiclink' | 'email_change'} type
 */
export function confirmLink(type) {
  return `${SITE}/auth/confirm?token_hash={{ .TokenHash }}&amp;type=${type}&amp;redirect_to={{ .RedirectTo }}`;
}

function action({ heading, intro, button, type, note }) {
  const href = confirmLink(type);
  return [
    emailHeading(heading),
    ...intro.map(emailParagraph),
    emailButton(href, button, { raw: true }),
    emailFallbackLink(href, { raw: true }),
    emailNote(note),
  ].join('\n');
}

function notice({ heading, lines }) {
  return [emailHeading(heading), ...lines.map(emailParagraph), emailNote(NOT_YOU)].join('\n');
}

/**
 * Each template: its Supabase key (the file name and the env suffix), the
 * subject, the inbox preview line and the card's content.
 */
export const AUTH_EMAILS = Object.freeze([
  {
    key: 'confirmation',
    subject: `Confirm your ${BRAND_NAME} account`,
    preheader: 'One click and your workspace is ready.',
    content: () =>
      action({
        heading: `Welcome to ${BRAND_NAME}`,
        intro: [
          `Confirm ${EMAIL} to finish creating your account.`,
          `Then add your brand and see how ChatGPT, Gemini and Google's AI answers talk about it, next to your competitors.`,
        ],
        button: 'Confirm email',
        type: 'signup',
        note: `${EXPIRY} If you didn't sign up for ${BRAND_NAME}, you can ignore this email and no account will be created.`,
      }),
  },
  {
    key: 'invite',
    subject: `You’re invited to ${BRAND_NAME}`,
    preheader: `Join your team on ${BRAND_NAME}.`,
    content: () =>
      action({
        heading: 'You’re invited',
        intro: [
          `You've been invited to join a workspace on ${BRAND_NAME}, where your team tracks how AI assistants describe your brand.`,
          'Accept the invitation to set up your account.',
        ],
        button: 'Accept invitation',
        type: 'invite',
        note: `${EXPIRY} If you weren't expecting this invitation, you can ignore this email.`,
      }),
  },
  {
    key: 'recovery',
    subject: `Reset your ${BRAND_NAME} password`,
    preheader: 'Choose a new password for your account.',
    content: () =>
      action({
        heading: 'Reset your password',
        intro: [`We received a request to reset the password for ${EMAIL}.`],
        button: 'Choose a new password',
        type: 'recovery',
        note: `${EXPIRY} If you didn't ask for this, you can ignore this email; your password stays the same.`,
      }),
  },
  {
    key: 'magic_link',
    subject: `Your ${BRAND_NAME} sign-in link`,
    preheader: `Sign in to ${BRAND_NAME} with one click.`,
    content: () =>
      action({
        heading: `Sign in to ${BRAND_NAME}`,
        intro: [`Use the button below to sign in as ${EMAIL}. No password needed.`],
        button: `Sign in to ${BRAND_NAME}`,
        type: 'magiclink',
        note: `${EXPIRY} If you didn't try to sign in, you can ignore this email.`,
      }),
  },
  {
    key: 'email_change',
    subject: `Confirm your new ${BRAND_NAME} email`,
    preheader: 'Confirm the change to your account email.',
    content: () =>
      action({
        heading: 'Confirm your new email',
        intro: [
          `Confirm that your ${BRAND_NAME} account should use ${NEW_EMAIL} from now on, in place of ${EMAIL}.`,
        ],
        button: 'Confirm new email',
        type: 'email_change',
        note: `${EXPIRY} If you didn't ask for this change, ignore this email and your account email stays the same.`,
      }),
  },
  {
    key: 'reauthentication',
    subject: `{{ .Token }} is your ${BRAND_NAME} verification code`,
    preheader: 'Your one-time verification code.',
    content: () =>
      [
        emailHeading('Your verification code'),
        emailParagraph(`Enter this code in ${BRAND_NAME} to confirm it's you.`),
        emailCode('{{ .Token }}'),
        emailNote(
          "The code works once and expires shortly. If you didn't ask for it, someone may know your password: change it right away.",
        ),
      ].join('\n'),
  },
  {
    key: 'password_changed_notification',
    subject: `Your ${BRAND_NAME} password was changed`,
    preheader: 'A security notice about your account.',
    content: () =>
      notice({
        heading: 'Your password was changed',
        lines: [`The password for ${EMAIL} was just changed.`],
      }),
  },
  {
    key: 'email_changed_notification',
    subject: `Your ${BRAND_NAME} email was changed`,
    preheader: 'A security notice about your account.',
    content: () =>
      notice({
        heading: 'Your email was changed',
        lines: [`Your ${BRAND_NAME} account email was changed from ${OLD_EMAIL} to ${EMAIL}.`],
      }),
  },
  {
    key: 'phone_changed_notification',
    subject: `Your ${BRAND_NAME} phone number was changed`,
    preheader: 'A security notice about your account.',
    content: () =>
      notice({
        heading: 'Your phone number was changed',
        lines: [
          'The phone number on your account was changed from {{ .OldPhone }} to {{ .Phone }}.',
        ],
      }),
  },
  {
    key: 'identity_linked_notification',
    subject: `A new sign-in method was added to your ${BRAND_NAME} account`,
    preheader: 'A security notice about your account.',
    content: () =>
      notice({
        heading: 'New sign-in method added',
        lines: [`Your {{ .Provider }} account can now be used to sign in as ${EMAIL}.`],
      }),
  },
  {
    key: 'identity_unlinked_notification',
    subject: `A sign-in method was removed from your ${BRAND_NAME} account`,
    preheader: 'A security notice about your account.',
    content: () =>
      notice({
        heading: 'Sign-in method removed',
        lines: [`Your {{ .Provider }} account can no longer be used to sign in as ${EMAIL}.`],
      }),
  },
  {
    key: 'mfa_factor_enrolled_notification',
    subject: `A verification method was added to your ${BRAND_NAME} account`,
    preheader: 'A security notice about your account.',
    content: () =>
      notice({
        heading: 'Verification method added',
        lines: ['A {{ .FactorType }} verification method was added to your account.'],
      }),
  },
  {
    key: 'mfa_factor_unenrolled_notification',
    subject: `A verification method was removed from your ${BRAND_NAME} account`,
    preheader: 'A security notice about your account.',
    content: () =>
      notice({
        heading: 'Verification method removed',
        lines: ['A {{ .FactorType }} verification method was removed from your account.'],
      }),
  },
]);

/**
 * One template's whole body, as the file the web app serves.
 *
 * @param {(typeof AUTH_EMAILS)[number]} email
 */
export function renderAuthEmail(email) {
  return renderEmailLayout({
    title: email.subject.replace('{{ .Token }} is your', 'Your'),
    preheader: email.preheader,
    contentHtml: email.content(),
    logoUrl: `${SITE}${EMAIL_LOGO_PATH}`,
    footerNote: `You're receiving this because of activity on your ${BRAND_NAME} account.`,
  });
}

/**
 * The Supabase Auth settings that use these templates: a URL and a subject
 * per template, for the auth service's environment.
 *
 * @param {string} webOrigin - where the web app serves web/public
 * @returns {Record<string, string>}
 */
export function authEmailEnv(webOrigin) {
  const origin = String(webOrigin).replace(/\/+$/, '');
  return Object.fromEntries(
    AUTH_EMAILS.flatMap(({ key, subject }) => {
      const suffix = key.toUpperCase();
      return [
        [`GOTRUE_MAILER_TEMPLATES_${suffix}`, `${origin}/${AUTH_EMAIL_DIR}/${key}.html`],
        [`GOTRUE_MAILER_SUBJECTS_${suffix}`, subject],
      ];
    }),
  );
}
