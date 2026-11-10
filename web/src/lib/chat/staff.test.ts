// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isChatStaff, staffEmails } from './staff';

/**
 * Oppla staff for Chat's Debug view (CHAT-03 items 25–26; W1-15): a
 * confirmed sign-in e-mail in STAFF_EMAILS, in any case; nobody without it.
 */

const CONFIRMED = '2026-10-01T09:00:00.000Z';

afterEach(() => vi.unstubAllEnvs());

describe('isChatStaff', () => {
  it('is nobody while STAFF_EMAILS is unset or empty', () => {
    vi.stubEnv('STAFF_EMAILS', '');
    expect(staffEmails()).toEqual([]);
    expect(isChatStaff({ email: 'ops@oppla.ai', email_confirmed_at: CONFIRMED })).toBe(false);
  });

  it('reads the list trimmed, in any case, blanks dropped', () => {
    vi.stubEnv('STAFF_EMAILS', ' Ops@Oppla.ai, ,support@oppla.ai ');
    expect(staffEmails()).toEqual(['ops@oppla.ai', 'support@oppla.ai']);
    expect(isChatStaff({ email: 'OPS@oppla.ai', email_confirmed_at: CONFIRMED })).toBe(true);
    expect(isChatStaff({ email: 'admin@customer.com', email_confirmed_at: CONFIRMED })).toBe(false);
  });

  it('needs a confirmed e-mail, and a person', () => {
    vi.stubEnv('STAFF_EMAILS', 'ops@oppla.ai');
    expect(isChatStaff({ email: 'ops@oppla.ai', email_confirmed_at: null })).toBe(false);
    expect(isChatStaff({ email: 'ops@oppla.ai' })).toBe(false);
    expect(isChatStaff(null)).toBe(false);
  });
});
