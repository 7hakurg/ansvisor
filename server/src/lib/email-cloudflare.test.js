import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Cloudflare Email Sending's REST API, told apart the way email.js tells
 * Resend's: accepted, refused (nothing went out), or no answer at all.
 */

vi.mock('./logger.js', () => ({ logger: { warn: vi.fn() } }));

const {
  allowedHeaders,
  cloudflareConfig,
  mimeTypeOf,
  parseSender,
  sendViaCloudflare,
  CLOUDFLARE_MAX_RECIPIENTS,
} = await import('./email-cloudflare.js');

const ACCOUNT = '0123456789abcdef'.repeat(2);
const config = { accountId: ACCOUNT, apiToken: 'cf-token' };
const message = {
  from: 'Oppla <noreply@notify.example>',
  to: ['ada@customer.example'],
  subject: 'Hi',
  html: '<p>Hi</p>',
};
const answer = (status, body) => ({
  ok: status < 300,
  status,
  text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
});
const accepted = (result = {}) =>
  answer(200, {
    success: true,
    errors: [],
    result: {
      message_id: '<m1@notify.example>',
      delivered: [],
      queued: ['ada@customer.example'],
      permanent_bounces: [],
      ...result,
    },
  });
const fetchMock = vi.fn();
const sentBody = (call = 0) => JSON.parse(fetchMock.mock.calls[call][1].body);

beforeEach(() => fetchMock.mockReset());

describe('cloudflareConfig', () => {
  it('needs both the account and the token', () => {
    expect(
      cloudflareConfig({ CLOUDFLARE_ACCOUNT_ID: ACCOUNT, CLOUDFLARE_EMAIL_API_TOKEN: 't' }),
    ).toEqual({ accountId: ACCOUNT, apiToken: 't' });
    expect(cloudflareConfig({ CLOUDFLARE_ACCOUNT_ID: ACCOUNT })).toBeNull();
    expect(cloudflareConfig({ CLOUDFLARE_EMAIL_API_TOKEN: 't' })).toBeNull();
    expect(
      cloudflareConfig({ CLOUDFLARE_ACCOUNT_ID: ' ', CLOUDFLARE_EMAIL_API_TOKEN: 't' }),
    ).toBeNull();
  });

  it('turns down an account id that is not one', () => {
    expect(
      cloudflareConfig({ CLOUDFLARE_ACCOUNT_ID: '../x', CLOUDFLARE_EMAIL_API_TOKEN: 't' }),
    ).toBeNull();
  });
});

describe('parseSender', () => {
  it('splits a display name from the address', () => {
    expect(parseSender('Oppla <noreply@notify.example>')).toEqual({
      name: 'Oppla',
      address: 'noreply@notify.example',
    });
    expect(parseSender('"Acme Agency" <hello@notify.example>')).toEqual({
      name: 'Acme Agency',
      address: 'hello@notify.example',
    });
  });

  it('keeps a bare address bare', () => {
    expect(parseSender(' noreply@notify.example ')).toEqual({ address: 'noreply@notify.example' });
    expect(parseSender('<noreply@notify.example>')).toEqual({ address: 'noreply@notify.example' });
  });
});

describe('mimeTypeOf', () => {
  it('names common attachment types and falls back to octet-stream', () => {
    expect(mimeTypeOf('card.PDF')).toBe('application/pdf');
    expect(mimeTypeOf('rows.csv')).toBe('text/csv');
    expect(mimeTypeOf('shot.png')).toBe('image/png');
    expect(mimeTypeOf('blob')).toBe('application/octet-stream');
  });
});

describe('allowedHeaders', () => {
  it('keeps the headers Cloudflare takes and drops the ones that would refuse the whole e-mail', () => {
    expect(
      allowedHeaders({
        'List-Unsubscribe': '<https://app.example/settings>',
        'X-Entity-Ref-ID': 'r1',
        'Idempotency-Key': 'k1',
        'Content-Type': 'text/html',
        From: 'x@y.example',
      }),
    ).toEqual({ 'List-Unsubscribe': '<https://app.example/settings>', 'X-Entity-Ref-ID': 'r1' });
  });

  it('drops an unsubscribe link Cloudflare would refuse: plain http, or none at all', () => {
    expect(allowedHeaders({ 'List-Unsubscribe': '<http://localhost:3000/settings>' })).toEqual({});
    expect(allowedHeaders({ 'List-Unsubscribe': '<mailto:unsubscribe@x.example>' })).toEqual({
      'List-Unsubscribe': '<mailto:unsubscribe@x.example>',
    });
    expect(allowedHeaders(undefined)).toEqual({});
  });
});

describe('sendViaCloudflare', () => {
  it('posts to the account’s send endpoint with the token and answers the message id', async () => {
    fetchMock.mockResolvedValueOnce(accepted());
    const outcome = await sendViaCloudflare(message, config, fetchMock);

    expect(outcome).toEqual({ status: 'sent', id: '<m1@notify.example>' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/email/sending/send`);
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer cf-token');
    expect(sentBody()).toEqual({
      from: { address: 'noreply@notify.example', name: 'Oppla' },
      to: ['ada@customer.example'],
      subject: 'Hi',
      html: '<p>Hi</p>',
    });
  });

  it('sends the reply address, headers, text and files in Cloudflare’s shape', async () => {
    fetchMock.mockResolvedValueOnce(accepted());
    await sendViaCloudflare(
      {
        ...message,
        text: 'Hi',
        replyTo: 'team@customer.example',
        headers: { 'List-Unsubscribe': '<https://app.example/settings>' },
        attachments: [{ filename: 'card.pdf', content: 'JVBERi0=' }],
      },
      config,
      fetchMock,
    );
    expect(sentBody()).toMatchObject({
      text: 'Hi',
      reply_to: 'team@customer.example',
      headers: { 'List-Unsubscribe': '<https://app.example/settings>' },
      attachments: [
        {
          filename: 'card.pdf',
          content: 'JVBERi0=',
          type: 'application/pdf',
          disposition: 'attachment',
        },
      ],
    });
  });

  it('says refused when Cloudflare answers with an error, and when every address bounced', async () => {
    fetchMock.mockResolvedValueOnce(
      answer(403, {
        success: false,
        errors: [{ code: 10203, message: 'email.sending.error.email.sending_disabled' }],
      }),
    );
    expect(await sendViaCloudflare(message, config, fetchMock)).toEqual({
      status: 'refused',
      id: null,
    });

    fetchMock.mockResolvedValueOnce(
      accepted({ queued: [], delivered: [], permanent_bounces: ['ada@customer.example'] }),
    );
    expect((await sendViaCloudflare(message, config, fetchMock)).status).toBe('refused');

    fetchMock.mockResolvedValueOnce(answer(200, { success: false, errors: [], result: null }));
    expect((await sendViaCloudflare(message, config, fetchMock)).status).toBe('refused');
  });

  it('counts an e-mail delivered to some addresses as sent', async () => {
    fetchMock.mockResolvedValueOnce(
      accepted({ queued: [], delivered: ['a@x.example'], permanent_bounces: ['b@x.example'] }),
    );
    expect((await sendViaCloudflare(message, config, fetchMock)).status).toBe('sent');
  });

  it('says sent with no id when a 2xx answer is not JSON it can read', async () => {
    // A 2xx is Cloudflare taking the message, as with Resend.
    fetchMock.mockResolvedValueOnce(answer(200, 'not json'));
    expect(await sendViaCloudflare(message, config, fetchMock)).toEqual({
      status: 'sent',
      id: null,
    });
  });

  it('says unknown when no answer came', async () => {
    fetchMock.mockRejectedValueOnce(Object.assign(new Error('aborted'), { name: 'TimeoutError' }));
    expect(await sendViaCloudflare(message, config, fetchMock)).toEqual({
      status: 'unknown',
      id: null,
    });
  });

  it('refuses past Cloudflare’s recipient limit without calling it', async () => {
    const to = Array.from({ length: CLOUDFLARE_MAX_RECIPIENTS + 1 }, (_, i) => `u${i}@x.example`);
    expect(await sendViaCloudflare({ ...message, to }, config, fetchMock)).toEqual({
      status: 'refused',
      id: null,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
