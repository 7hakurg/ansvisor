import { logger } from './logger.js';
import { cloudflareConfig, sendViaCloudflare } from './email-cloudflare.js';
import { withEmailLayout } from './email-layout.js';

/**
 * The most an e-mail's attachments may weigh together, decoded: under
 * Resend's 40 MB and Cloudflare's 25 MiB whole message.
 */
export const ATTACHMENTS_MAX_BYTES = 10 * 1024 * 1024;

/**
 * The sender, with a display name in place of the configured one when
 * given (a white label kit's company): `"Acme Agency" <hello@oppla.ai>`.
 * The address is always the configured sender's own (EMAIL_FROM).
 */
export function senderOf(from, fromName) {
  if (!fromName) return from;
  const address = /<([^>]+)>/.exec(from)?.[1] ?? from.trim();
  const name = String(fromName)
    .replace(/[\r\n"<>\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100);
  return name ? `"${name}" <${address}>` : from;
}

/** Decoded size of a base64 text, in bytes. */
const base64Bytes = (text) => {
  const clean = String(text ?? '').replace(/\s/g, '');
  const padding = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((clean.length * 3) / 4) - padding);
};

const PROVIDERS = ['cloudflare', 'resend'];

/** The configured sender: EMAIL_FROM, else RESEND_FROM_EMAIL (older deployments). */
function configuredSender() {
  return process.env.EMAIL_FROM || process.env.RESEND_FROM_EMAIL || '';
}

function configured(provider) {
  if (provider === 'cloudflare') return cloudflareConfig(process.env) !== null;
  return Boolean(process.env.RESEND_API_KEY);
}

/**
 * The transport e-mail goes through, or null when none is set up.
 * EMAIL_PROVIDER ('cloudflare' or 'resend') picks one, and then only that one
 * is used: a chosen provider without its settings sends nothing rather than
 * going out another way. Unset (or unknown), Cloudflare Email Sending wins
 * when CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_EMAIL_API_TOKEN are set, then
 * Resend (RESEND_API_KEY).
 *
 * @returns {'cloudflare' | 'resend' | null}
 */
export function emailProvider() {
  const chosen = String(process.env.EMAIL_PROVIDER ?? '')
    .trim()
    .toLowerCase();
  if (PROVIDERS.includes(chosen)) return configured(chosen) ? chosen : null;
  return PROVIDERS.find(configured) ?? null;
}

async function sendViaResend({ from, to, subject, html, headers, replyTo, attachments }) {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to,
        subject,
        html,
        ...(headers ? { headers } : {}),
        ...(replyTo ? { reply_to: replyTo } : {}),
        ...(attachments.length
          ? { attachments: attachments.map(({ filename, content }) => ({ filename, content })) }
          : {}),
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      logger.warn({ status: res.status, body: body.slice(0, 500) }, 'resend send failed');
      return { status: 'refused', id: null };
    }
    const body = await res.text().catch(() => '');
    let id = null;
    try {
      const parsed = JSON.parse(body);
      id = typeof parsed?.id === 'string' ? parsed.id.slice(0, 200) : null;
    } catch {
      id = null;
    }
    return { status: 'sent', id };
  } catch (err) {
    logger.warn({ err }, 'resend send errored');
    return { status: 'unknown', id: null };
  }
}

/**
 * Send one email and say what became of it, with the provider's id when it
 * was accepted. It goes through emailProvider()'s transport (Cloudflare Email
 * Sending or Resend), from EMAIL_FROM, inside the Oppla layout when the HTML
 * is a fragment (email-layout.js; a whole document goes as it is):
 *   - 'sent': the provider accepted it;
 *   - 'refused': the provider answered with an error, so nothing went out;
 *   - 'unknown': no answer (the 15 s timeout, a dropped connection), and
 *     the provider may have sent it all the same;
 *   - 'skipped': not configured or no recipients. Missing config is a silent
 *     no-op, so self-host and misconfigured environments never fail a caller.
 * `replyTo`, when given, is where a reply goes instead of the sender;
 * `from` sends from another address than the configured one (it must be on
 * a domain the provider has verified: the report card's own sender);
 * `fromName` the sender's display name (senderOf); `attachments`
 * ({ filename, content: base64 }) go with it, refused as a whole past
 * ATTACHMENTS_MAX_BYTES.
 */
export async function deliverEmailWithId({
  to,
  subject,
  html,
  headers,
  replyTo,
  from: sender,
  fromName,
  attachments,
}) {
  const provider = emailProvider();
  const from = sender || configuredSender();
  if (!provider || !from || !to.length) return { status: 'skipped', id: null };
  const files = (attachments ?? []).filter((file) => file?.filename && file?.content);
  if (files.reduce((sum, file) => sum + base64Bytes(file.content), 0) > ATTACHMENTS_MAX_BYTES) {
    logger.warn({ files: files.length, provider }, 'email send refused: attachments too large');
    return { status: 'refused', id: null };
  }

  const message = {
    from: senderOf(from, fromName),
    to,
    subject,
    html: withEmailLayout(html, subject),
    headers,
    replyTo,
    attachments: files,
  };
  if (provider === 'cloudflare') {
    return sendViaCloudflare(message, cloudflareConfig(process.env));
  }
  return sendViaResend(message);
}

/** deliverEmailWithId's outcome alone (above). */
export async function deliverEmail(message) {
  return (await deliverEmailWithId(message)).status;
}

/** deliverEmail as a yes or no: true when the provider accepted it. */
export async function sendEmail(message) {
  return (await deliverEmail(message)) === 'sent';
}
