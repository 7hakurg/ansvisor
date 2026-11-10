import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The provider's answer (Cloudflare or Resend), told apart: accepted, refused (nothing went out), or no
 * answer at all (it may have gone out), and nothing to do without config.
 */

vi.mock('./logger.js', () => ({ logger: { warn: vi.fn() } }));

const { deliverEmail, deliverEmailWithId, senderOf, sendEmail, ATTACHMENTS_MAX_BYTES } =
  await import('./email.js');

const message = { to: ['team@acme.example'], subject: 'Hi', html: '<p>Hi</p>' };
const answer = (status, body = '{}') => ({ ok: status < 300, status, text: async () => body });
const fetchMock = vi.fn();

beforeEach(() => {
  // Blank first, so a developer's own settings never pick the transport here.
  for (const key of [
    'EMAIL_PROVIDER',
    'EMAIL_FROM',
    'CLOUDFLARE_ACCOUNT_ID',
    'CLOUDFLARE_EMAIL_API_TOKEN',
    'PUBLIC_APP_URL',
  ]) {
    vi.stubEnv(key, '');
  }
  vi.stubEnv('RESEND_API_KEY', 're_test');
  vi.stubEnv('RESEND_FROM_EMAIL', 'Oppla <hello@acme.example>');
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('deliverEmail', () => {
  it('says sent when Resend accepts it, and refused when it answers with an error', async () => {
    fetchMock.mockResolvedValueOnce(answer(200, '{"id":"e1"}'));
    expect(await deliverEmail(message)).toBe('sent');
    fetchMock.mockResolvedValueOnce(answer(422, '{"message":"invalid"}'));
    expect(await deliverEmail(message)).toBe('refused');
  });

  it('sends from another address and with files when asked', async () => {
    fetchMock.mockResolvedValueOnce(answer(200));
    await deliverEmail({
      ...message,
      from: 'Oppla <reports@acme.example>',
      attachments: [{ filename: 'card.pdf', content: 'JVBERi0=' }],
    });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.from).toBe('Oppla <reports@acme.example>');
    expect(body.attachments).toEqual([{ filename: 'card.pdf', content: 'JVBERi0=' }]);
    fetchMock.mockResolvedValueOnce(answer(200));
    await deliverEmail(message);
    const plain = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(plain.from).toBe('Oppla <hello@acme.example>');
    expect(plain).not.toHaveProperty('attachments');
  });

  it('says unknown when no answer came: a timeout or a dropped connection', async () => {
    fetchMock.mockRejectedValueOnce(Object.assign(new Error('aborted'), { name: 'TimeoutError' }));
    expect(await deliverEmail(message)).toBe('unknown');
  });

  it('sends a reply to replyTo when given', async () => {
    fetchMock.mockResolvedValue(answer(200));
    await deliverEmail({ ...message, replyTo: 'ada@customer.example' });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).reply_to).toBe('ada@customer.example');
    await deliverEmail(message);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).not.toHaveProperty('reply_to');
  });

  it('skips without config or recipients', async () => {
    expect(await deliverEmail({ ...message, to: [] })).toBe('skipped');
    vi.stubEnv('RESEND_API_KEY', '');
    expect(await deliverEmail(message)).toBe('skipped');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('sendEmail', () => {
  it('is true only when Resend accepted it', async () => {
    fetchMock.mockResolvedValueOnce(answer(200));
    expect(await sendEmail(message)).toBe(true);
    fetchMock.mockRejectedValueOnce(new Error('socket hang up'));
    expect(await sendEmail(message)).toBe(false);
  });
});

describe('deliverEmailWithId', () => {
  it('answers Resend’s id, sends attachments and a display name on the configured address', async () => {
    fetchMock.mockResolvedValueOnce(answer(200, '{"id":"e1"}'));
    const outcome = await deliverEmailWithId({
      ...message,
      fromName: 'Northwind "Agency"',
      attachments: [{ filename: 'report.pdf', content: 'aGk=' }],
    });
    expect(outcome).toEqual({ status: 'sent', id: 'e1' });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.from).toBe('"Northwind Agency" <hello@acme.example>');
    expect(body.attachments).toEqual([{ filename: 'report.pdf', content: 'aGk=' }]);
    expect(senderOf('hello@acme.example', 'Acme')).toBe('"Acme" <hello@acme.example>');
    expect(senderOf('Oppla <hello@acme.example>', null)).toBe('Oppla <hello@acme.example>');
  });

  it('refuses attachments past the limit without calling Resend, and sends none it isn’t given', async () => {
    const big = Buffer.alloc(ATTACHMENTS_MAX_BYTES + 1, 1).toString('base64');
    expect(
      await deliverEmailWithId({ ...message, attachments: [{ filename: 'a.pdf', content: big }] }),
    ).toEqual({ status: 'refused', id: null });
    expect(fetchMock).not.toHaveBeenCalled();
    fetchMock.mockResolvedValueOnce(answer(200, 'not json'));
    expect(await deliverEmailWithId(message)).toEqual({ status: 'sent', id: null });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).not.toHaveProperty('attachments');
  });
});

describe('the transport', () => {
  const ACCOUNT = '0123456789abcdef'.repeat(2);
  const cloudflareAccepted = () =>
    answer(
      200,
      JSON.stringify({
        success: true,
        result: { message_id: '<m1@x>', delivered: [], queued: ['team@acme.example'] },
      }),
    );

  it('goes through Cloudflare when its account and token are set, from EMAIL_FROM', async () => {
    vi.stubEnv('CLOUDFLARE_ACCOUNT_ID', ACCOUNT);
    vi.stubEnv('CLOUDFLARE_EMAIL_API_TOKEN', 'cf-token');
    vi.stubEnv('EMAIL_FROM', 'Oppla <noreply@notify.acme.example>');
    fetchMock.mockResolvedValueOnce(cloudflareAccepted());

    expect(await deliverEmailWithId(message)).toEqual({ status: 'sent', id: '<m1@x>' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain(`/accounts/${ACCOUNT}/email/sending/send`);
    expect(JSON.parse(init.body).from).toEqual({
      address: 'noreply@notify.acme.example',
      name: 'Oppla',
    });
  });

  it('keeps a white label display name on the configured address through Cloudflare', async () => {
    vi.stubEnv('CLOUDFLARE_ACCOUNT_ID', ACCOUNT);
    vi.stubEnv('CLOUDFLARE_EMAIL_API_TOKEN', 'cf-token');
    vi.stubEnv('EMAIL_FROM', 'Oppla <noreply@notify.acme.example>');
    fetchMock.mockResolvedValueOnce(cloudflareAccepted());
    await deliverEmailWithId({ ...message, fromName: 'Northwind' });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).from).toEqual({
      address: 'noreply@notify.acme.example',
      name: 'Northwind',
    });
  });

  it('stays on Resend when EMAIL_PROVIDER says so, even with Cloudflare set', async () => {
    vi.stubEnv('CLOUDFLARE_ACCOUNT_ID', ACCOUNT);
    vi.stubEnv('CLOUDFLARE_EMAIL_API_TOKEN', 'cf-token');
    vi.stubEnv('EMAIL_PROVIDER', 'resend');
    fetchMock.mockResolvedValueOnce(answer(200, '{"id":"e1"}'));
    expect(await deliverEmailWithId(message)).toEqual({ status: 'sent', id: 'e1' });
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.resend.com/emails');
  });

  it('falls back to RESEND_FROM_EMAIL as the sender on Cloudflare', async () => {
    vi.stubEnv('RESEND_API_KEY', '');
    vi.stubEnv('CLOUDFLARE_ACCOUNT_ID', ACCOUNT);
    vi.stubEnv('CLOUDFLARE_EMAIL_API_TOKEN', 'cf-token');
    fetchMock.mockResolvedValueOnce(cloudflareAccepted());
    await deliverEmail(message);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).from).toEqual({
      address: 'hello@acme.example',
      name: 'Oppla',
    });
  });

  it('skips when no provider is configured, or the chosen one is not', async () => {
    vi.stubEnv('RESEND_API_KEY', '');
    expect(await deliverEmail(message)).toBe('skipped');
    vi.stubEnv('EMAIL_PROVIDER', 'cloudflare');
    vi.stubEnv('RESEND_API_KEY', 're_test');
    expect(await deliverEmail(message)).toBe('skipped');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('names the provider in use', async () => {
    const { emailProvider } = await import('./email.js');
    expect(emailProvider()).toBe('resend');
    vi.stubEnv('CLOUDFLARE_ACCOUNT_ID', ACCOUNT);
    vi.stubEnv('CLOUDFLARE_EMAIL_API_TOKEN', 'cf-token');
    expect(emailProvider()).toBe('cloudflare');
    vi.stubEnv('EMAIL_PROVIDER', 'carrier-pigeon');
    expect(emailProvider()).toBe('cloudflare');
    vi.stubEnv('CLOUDFLARE_EMAIL_API_TOKEN', '');
    vi.stubEnv('RESEND_API_KEY', '');
    expect(emailProvider()).toBeNull();
  });
});

describe('the branded shell', () => {
  it('wraps a fragment in the Oppla layout and keeps a whole document as it is', async () => {
    vi.stubEnv('PUBLIC_APP_URL', 'https://app.acme.example');
    fetchMock.mockResolvedValue(answer(200));
    await deliverEmail(message);
    const wrapped = JSON.parse(fetchMock.mock.calls[0][1].body).html;
    expect(wrapped).toMatch(/^<!DOCTYPE html>/);
    expect(wrapped).toContain('<p>Hi</p>');
    expect(wrapped).toContain('https://app.acme.example/email/oppla-mark.png');

    const own = '<!DOCTYPE html><html><body>Pulse</body></html>';
    await deliverEmail({ ...message, html: own });
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).html).toBe(own);
  });
});
