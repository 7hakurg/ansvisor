/**
 * Cloudflare Email Sending over its REST API: one POST per e-mail to
 * /accounts/{id}/email/sending/send with an API token that holds the
 * "Email Sending: Edit" permission (CLOUDFLARE_ACCOUNT_ID,
 * CLOUDFLARE_EMAIL_API_TOKEN). The sender's domain must be onboarded to
 * Email Sending on that account.
 *
 * Outcomes match email.js's: 'sent' (Cloudflare took it for at least one
 * address), 'refused' (an error answer, or every address bounced), 'unknown'
 * (no answer: a timeout or dropped connection, and it may have gone out).
 */

import { logger } from './logger.js';

const API_BASE = 'https://api.cloudflare.com/client/v4';
const TIMEOUT_MS = 15000;

/** Cloudflare's limit across to, cc and bcc. */
export const CLOUDFLARE_MAX_RECIPIENTS = 50;

/** A Cloudflare account id: 32 hex digits. */
const ACCOUNT_ID = /^[0-9a-f]{32}$/i;

const MIME_TYPES = Object.freeze({
  pdf: 'application/pdf',
  csv: 'text/csv',
  txt: 'text/plain',
  html: 'text/html',
  json: 'application/json',
  zip: 'application/zip',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
});

/**
 * The custom headers Cloudflare accepts besides any X- header
 * (developers.cloudflare.com/email-service/reference/headers). One outside
 * this list, or an invalid List-Unsubscribe, refuses the whole e-mail.
 */
const ALLOWED_HEADERS = new Set(
  [
    'In-Reply-To',
    'References',
    'Thread-Index',
    'Thread-Topic',
    'List-Unsubscribe',
    'List-Unsubscribe-Post',
    'List-Id',
    'List-Archive',
    'List-Help',
    'List-Owner',
    'List-Post',
    'List-Subscribe',
    'Precedence',
    'Auto-Submitted',
    'Content-Language',
    'Keywords',
    'Comments',
    'Importance',
    'Priority',
    'Sensitivity',
    'Organization',
    'Require-Recipient-Valid-Since',
    'Expires',
    'Reply-By',
    'Archived-At',
  ].map((name) => name.toLowerCase()),
);
const X_HEADER = /^X-[A-Za-z0-9_-]{1,98}$/;
const UNSUBSCRIBE_URI = /<(https:\/\/|mailto:)[^>]+>/i;

/**
 * The headers Cloudflare will take, so a header it would refuse costs only
 * that header, not the e-mail: dropped ones are logged by name.
 *
 * @param {Record<string, string> | undefined} headers
 * @returns {Record<string, string>}
 */
export function allowedHeaders(headers) {
  const kept = {};
  const dropped = [];
  for (const [name, value] of Object.entries(headers ?? {})) {
    const lower = name.toLowerCase();
    const known = X_HEADER.test(name) || ALLOWED_HEADERS.has(lower);
    const valid = lower !== 'list-unsubscribe' || UNSUBSCRIBE_URI.test(String(value));
    if (known && valid && value) kept[name] = String(value);
    else dropped.push(name);
  }
  if (dropped.length) logger.warn({ dropped }, 'cloudflare send: headers it would refuse left out');
  return kept;
}

/**
 * The account and token from the environment, or null when either is
 * missing or the account id is not one.
 *
 * @param {Record<string, string | undefined>} env
 * @returns {{ accountId: string, apiToken: string } | null}
 */
export function cloudflareConfig(env) {
  const accountId = String(env.CLOUDFLARE_ACCOUNT_ID ?? '').trim();
  const apiToken = String(env.CLOUDFLARE_EMAIL_API_TOKEN ?? '').trim();
  if (!accountId || !apiToken || !ACCOUNT_ID.test(accountId)) return null;
  return { accountId, apiToken };
}

/**
 * `Name <address>`, `"Name" <address>` or a bare address, as Cloudflare's
 * `from` object.
 *
 * @param {string} sender
 * @returns {{ address: string, name?: string }}
 */
export function parseSender(sender) {
  const text = String(sender ?? '').trim();
  const match = /^(.*?)\s*<([^<>]+)>$/.exec(text);
  if (!match) return { address: text };
  const name = match[1].replace(/^"|"$/g, '').trim();
  const address = match[2].trim();
  return name ? { address, name } : { address };
}

/** The MIME type for a file name's extension. */
export function mimeTypeOf(filename) {
  const ext = /\.([A-Za-z0-9]+)$/.exec(String(filename ?? ''))?.[1]?.toLowerCase();
  return (ext && MIME_TYPES[ext]) || 'application/octet-stream';
}

function requestBody({ from, to, subject, html, text, replyTo, headers, attachments }) {
  const kept = allowedHeaders(headers);
  return {
    from: parseSender(from),
    to,
    subject,
    ...(html ? { html } : {}),
    ...(text ? { text } : {}),
    ...(replyTo ? { reply_to: replyTo } : {}),
    ...(Object.keys(kept).length ? { headers: kept } : {}),
    ...(attachments?.length
      ? {
          attachments: attachments.map(({ filename, content }) => ({
            filename,
            content,
            type: mimeTypeOf(filename),
            disposition: 'attachment',
          })),
        }
      : {}),
  };
}

function readJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** What the API's error list says, as codes alone: no addresses in the log. */
function errorCodes(parsed) {
  return Array.isArray(parsed?.errors)
    ? parsed.errors.map((e) => `${e?.code ?? '?'}:${String(e?.message ?? '').slice(0, 80)}`)
    : [];
}

/**
 * @param {{
 *   from: string, to: string[], subject: string, html?: string, text?: string,
 *   replyTo?: string, headers?: Record<string, string>,
 *   attachments?: Array<{ filename: string, content: string }>,
 * }} message - `from` is the full sender (display name and address)
 * @param {{ accountId: string, apiToken: string }} config
 * @param {typeof fetch} [send] - defaults to the global fetch
 * @returns {Promise<{ status: 'sent' | 'refused' | 'unknown', id: string | null }>}
 */
export async function sendViaCloudflare(message, config, send = globalThis.fetch) {
  if (message.to.length > CLOUDFLARE_MAX_RECIPIENTS) {
    logger.warn({ recipients: message.to.length }, 'cloudflare send refused: too many recipients');
    return { status: 'refused', id: null };
  }

  let res;
  try {
    res = await send(`${API_BASE}/accounts/${config.accountId}/email/sending/send`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody(message)),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    logger.warn({ err }, 'cloudflare send errored');
    return { status: 'unknown', id: null };
  }

  const text = await res.text().catch(() => '');
  const parsed = readJson(text);

  if (!res.ok) {
    logger.warn({ status: res.status, errors: errorCodes(parsed) }, 'cloudflare send failed');
    return { status: 'refused', id: null };
  }
  if (!parsed) return { status: 'sent', id: null };
  if (parsed.success !== true || !parsed.result) {
    logger.warn({ status: res.status, errors: errorCodes(parsed) }, 'cloudflare send not accepted');
    return { status: 'refused', id: null };
  }

  const { delivered = [], queued = [], permanent_bounces: bounced = [] } = parsed.result;
  if (delivered.length + queued.length === 0) {
    logger.warn({ bounced: bounced.length }, 'cloudflare send bounced for every recipient');
    return { status: 'refused', id: null };
  }
  const id =
    typeof parsed.result.message_id === 'string' ? parsed.result.message_id.slice(0, 200) : null;
  return { status: 'sent', id };
}
