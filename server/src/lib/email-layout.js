/**
 * The one shell every Oppla e-mail wears: the mark and name on top, a white
 * card for the message, a quiet footer. Built for mail clients, not browsers:
 * tables for layout, inline styles only, a PNG mark (Gmail and Outlook drop
 * SVG), and light colours pinned so clients that invert for dark mode leave
 * the monochrome brand alone.
 *
 * The same pieces draw the Supabase Auth templates (auth-email-templates.js),
 * so sign-up, invite and reset mail match what the app server sends.
 */

import { BRAND_NAME, BRAND_URL, BRAND_HOST, httpUrl } from './brand.js';

/** Oppla's monochrome palette, as the web app's light theme draws it. */
export const EMAIL_THEME = Object.freeze({
  canvas: '#f4f4f2',
  card: '#ffffff',
  border: '#e7e7e3',
  ink: '#0c0c0f',
  text: '#3f3f46',
  muted: '#71717a',
  faint: '#a1a1aa',
  wash: '#f4f4f2',
  font: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Helvetica,Arial,sans-serif",
  mono: "'SFMono-Regular',ui-monospace,Menlo,Consolas,'Liberation Mono',monospace",
});

/** Where the mark lives on the web app (web/public/email/oppla-mark.png). */
export const EMAIL_LOGO_PATH = '/email/oppla-mark.png';

const FULL_DOCUMENT = /^\s*(<!doctype[^>]*>\s*)?<html[\s>]/i;

/** @param {unknown} value */
export function escapeEmailHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Whether the HTML is already a whole document (it draws its own shell). */
export function isFullDocument(html) {
  return FULL_DOCUMENT.test(String(html ?? ''));
}

/** The mark's absolute URL on this deployment's web app, or null. */
export function emailLogoUrl() {
  const app = httpUrl(process.env.PUBLIC_APP_URL);
  if (!app) return null;
  return `${new URL(app).origin}${EMAIL_LOGO_PATH}`;
}

/**
 * A call-to-action button that renders in every client, Outlook included: a
 * table cell carries the colour, the link carries the padding.
 * `raw` keeps the href as given, for template placeholders like {{ .SiteURL }}.
 *
 * @param {string} href
 * @param {string} label
 * @param {{ raw?: boolean }} [options]
 */
export function emailButton(href, label, { raw = false } = {}) {
  const link = raw ? href : escapeEmailHtml(href);
  const t = EMAIL_THEME;
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 8px 0;">
  <tr>
    <td align="center" bgcolor="${t.ink}" style="background-color:${t.ink};border-radius:10px;">
      <a href="${link}" target="_blank" style="display:inline-block;padding:13px 24px;font-family:${t.font};font-size:15px;font-weight:600;line-height:20px;color:#ffffff;text-decoration:none;border-radius:10px;">${escapeEmailHtml(label)}</a>
    </td>
  </tr>
</table>`;
}

/**
 * The link the button opens, written out for clients that block buttons.
 *
 * @param {string} href
 * @param {{ raw?: boolean }} [options]
 */
export function emailFallbackLink(href, { raw = false } = {}) {
  const link = raw ? href : escapeEmailHtml(href);
  const t = EMAIL_THEME;
  return `<p style="margin:20px 0 0 0;font-family:${t.font};font-size:13px;line-height:20px;color:${t.muted};">If the button doesn't work, paste this link into your browser:<br><a href="${link}" target="_blank" style="color:${t.ink};text-decoration:underline;word-break:break-all;">${link}</a></p>`;
}

/** A one-time code, large and spaced so it reads at a glance. */
export function emailCode(code) {
  const t = EMAIL_THEME;
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 8px 0;">
  <tr>
    <td style="background-color:${t.wash};border:1px solid ${t.border};border-radius:12px;padding:16px 28px;font-family:${t.mono};font-size:30px;font-weight:600;letter-spacing:8px;line-height:36px;color:${t.ink};">${escapeEmailHtml(code)}</td>
  </tr>
</table>`;
}

/** A heading for the card. */
export function emailHeading(text) {
  const t = EMAIL_THEME;
  return `<h1 style="margin:0 0 12px 0;font-family:${t.font};font-size:22px;font-weight:600;line-height:30px;letter-spacing:-0.3px;color:${t.ink};">${escapeEmailHtml(text)}</h1>`;
}

/** A paragraph of body copy. `html` is trusted markup, already escaped. */
export function emailParagraph(html) {
  const t = EMAIL_THEME;
  return `<p style="margin:0 0 12px 0;font-family:${t.font};font-size:15px;line-height:24px;color:${t.text};">${html}</p>`;
}

/** Small print under the action: why it came, how long it lasts. */
export function emailNote(html) {
  const t = EMAIL_THEME;
  return `<p style="margin:24px 0 0 0;padding-top:20px;border-top:1px solid ${t.border};font-family:${t.font};font-size:13px;line-height:20px;color:${t.muted};">${html}</p>`;
}

function header(logoUrl) {
  const t = EMAIL_THEME;
  const mark = logoUrl
    ? `<td style="padding-right:10px;vertical-align:middle;"><img src="${escapeEmailHtml(logoUrl)}" width="28" height="28" alt="${BRAND_NAME}" style="display:block;width:28px;height:28px;border:0;outline:none;text-decoration:none;"></td>`
    : '';
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0">
  <tr>
    ${mark}<td style="vertical-align:middle;font-family:${t.font};font-size:18px;font-weight:700;letter-spacing:-0.3px;color:${t.ink};">${BRAND_NAME}</td>
  </tr>
</table>`;
}

function footer(note) {
  const t = EMAIL_THEME;
  const why = note ?? `You're receiving this because of your ${BRAND_NAME} account.`;
  return `<p style="margin:0 0 6px 0;font-family:${t.font};font-size:12px;line-height:18px;color:${t.muted};">${why}</p>
<p style="margin:0;font-family:${t.font};font-size:12px;line-height:18px;color:${t.faint};">${BRAND_NAME} · AI search visibility · <a href="${BRAND_URL}" target="_blank" style="color:${t.faint};text-decoration:underline;">${BRAND_HOST}</a></p>`;
}

/**
 * A whole e-mail document around `contentHtml`.
 *
 * @param {{
 *   title: string,
 *   contentHtml: string,
 *   preheader?: string,
 *   logoUrl?: string | null,
 *   footerNote?: string,
 *   cardPadding?: string,
 * }} parts - `contentHtml` and `footerNote` are trusted markup; `title` and
 *   `preheader` are text and get escaped. `logoUrl` may be a template
 *   placeholder; it is escaped as an attribute either way.
 */
export function renderEmailLayout({
  title,
  contentHtml,
  preheader = '',
  logoUrl = null,
  footerNote,
  cardPadding = '40px 40px 36px 40px',
}) {
  const t = EMAIL_THEME;
  const hidden = preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;font-size:1px;line-height:1px;color:${t.canvas};">${escapeEmailHtml(preheader)}</div>`
    : '';
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeEmailHtml(title)}</title>
<style>
  body { margin:0; padding:0; width:100% !important; -webkit-text-size-adjust:100%; }
  a { color:${t.ink}; }
  @media only screen and (max-width:600px) {
    .oppla-card { padding:28px 24px 26px 24px !important; }
    .oppla-shell { padding:24px 12px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background-color:${t.canvas};">
${hidden}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${t.canvas}" style="background-color:${t.canvas};">
  <tr>
    <td align="center" class="oppla-shell" style="padding:40px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
        <tr>
          <td style="padding:0 4px 20px 4px;">
${header(logoUrl)}
          </td>
        </tr>
        <tr>
          <td class="oppla-card" bgcolor="${t.card}" style="background-color:${t.card};border:1px solid ${t.border};border-radius:16px;padding:${cardPadding};">
${contentHtml}
          </td>
        </tr>
        <tr>
          <td style="padding:24px 4px 0 4px;">
${footer(footerNote)}
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>
`;
}

/**
 * The message as Oppla sends it: a fragment goes into the shell, with the
 * subject as its title and preheader; a whole document (one that draws its
 * own shell, like the Pulse digest) goes as it is.
 *
 * @param {string | undefined} html
 * @param {string} subject
 */
export function withEmailLayout(html, subject) {
  if (!html || isFullDocument(html)) return html;
  return renderEmailLayout({
    title: subject,
    preheader: subject,
    contentHtml: html,
    logoUrl: emailLogoUrl(),
    cardPadding: '16px 16px 12px 16px',
  });
}
