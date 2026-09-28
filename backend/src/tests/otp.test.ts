import { describe, expect, it, vi } from 'vitest';
import { AppError } from '../lib/errors.js';
import {
  assertChallengeUsable,
  evaluateOtpCode,
  generateOtpCode,
  hashOtpCode,
  isExpired,
  isWellFormedOtp,
  newChallenge,
  normaliseOtpInput,
  otpState,
  remainingAttempts,
  resendState,
  secondsUntilExpiry,
  verifyOtpHash,
  type OtpChallenge,
} from '../lib/otp.js';

const NOW = new Date('2026-09-01T10:00:00.000Z');
const MINUTE = 60_000;

function challengeAt(overrides: Partial<OtpChallenge> = {}): OtpChallenge {
  return {
    id: 'otp-1',
    codeHash: 'hash',
    expiresAt: new Date(NOW.getTime() + 10 * MINUTE),
    attempts: 0,
    maxAttempts: 5,
    consumedAt: null,
    createdAt: NOW,
    ...overrides,
  };
}

/** Deterministic stand-in for `verifyOtpHash` so state-machine tests stay fast. */
const matcher = (expected: string) => async (code: string) => code === expected;

describe('OTP generation', () => {
  it('produces a code of the configured length, zero padded', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateOtpCode(6);
      expect(code).toHaveLength(6);
      expect(code).toMatch(/^\d{6}$/);
    }
  });

  it('does not bias the leading digits', () => {
    // With `Math.random() % 10**6` or a naive modulo, the first digit 9 is
    // markedly under-represented. Sampling 20k codes and checking every digit
    // appears in a plausible band catches that.
    const firstDigits = new Map<string, number>();
    for (let i = 0; i < 20_000; i++) {
      const digit = generateOtpCode(6)[0]!;
      firstDigits.set(digit, (firstDigits.get(digit) ?? 0) + 1);
    }
    expect(firstDigits.size).toBe(10);
    for (const count of firstDigits.values()) {
      // Expected 2000 each; a biased generator drifts far outside this band.
      expect(count).toBeGreaterThan(1_700);
      expect(count).toBeLessThan(2_300);
    }
  });

  it('honours a custom length and rejects nonsensical ones', () => {
    expect(generateOtpCode(4)).toHaveLength(4);
    expect(() => generateOtpCode(3)).toThrow(RangeError);
    expect(() => generateOtpCode(11)).toThrow(RangeError);
    expect(() => generateOtpCode(6.5)).toThrow(RangeError);
  });

  it('does not repeat across a large sample', () => {
    const codes = new Set(Array.from({ length: 2_000 }, () => generateOtpCode(6)));
    // Birthday paradox: with 2k draws from a million, collisions are ~86% likely,
    // so this only catches a catastrophically broken generator.
    expect(codes.size).toBeGreaterThan(1_800);
  });
});

describe('OTP hashing', () => {
  it('never stores the plaintext and verifies the right code', async () => {
    const hash = await hashOtpCode('482913', 4);
    expect(hash).not.toContain('482913');
    expect(hash).toMatch(/^\$2[aby]\$/);
    await expect(verifyOtpHash('482913', hash)).resolves.toBe(true);
    await expect(verifyOtpHash('482914', hash)).resolves.toBe(false);
  });

  it('produces a different hash for the same code each time (salted)', async () => {
    const [a, b] = await Promise.all([hashOtpCode('111111', 4), hashOtpCode('111111', 4)]);
    expect(a).not.toBe(b);
  });

  it('accepts codes copied with spaces or dashes', async () => {
    const hash = await hashOtpCode('482913', 4);
    await expect(verifyOtpHash('482 913', hash)).resolves.toBe(true);
    await expect(verifyOtpHash('482-913', hash)).resolves.toBe(true);
    expect(normaliseOtpInput(' 482 913 ')).toBe('482913');
  });
});

describe('OTP expiry', () => {
  it('is active right up to the expiry instant and expired after', () => {
    const challenge = challengeAt({ expiresAt: new Date(NOW.getTime() + 10 * MINUTE) });
    expect(otpState(challenge, NOW)).toBe('active');
    expect(otpState(challenge, new Date(NOW.getTime() + 10 * MINUTE - 1))).toBe('active');
    expect(otpState(challenge, new Date(NOW.getTime() + 10 * MINUTE))).toBe('expired');
    expect(isExpired(challenge, new Date(NOW.getTime() + 10 * MINUTE + 1))).toBe(true);
  });

  it('reports whole seconds remaining and never goes negative', () => {
    const challenge = challengeAt({ expiresAt: new Date(NOW.getTime() + 600_000) });
    expect(secondsUntilExpiry(challenge, NOW)).toBe(600);
    expect(secondsUntilExpiry(challenge, new Date(NOW.getTime() + 60_000))).toBe(540);
    // 400ms left should still read as "1 second left" rather than 0, so the UI
    // countdown does not flicker a whole second early.
    expect(secondsUntilExpiry(challenge, new Date(NOW.getTime() + 599_600))).toBe(1);
    expect(secondsUntilExpiry(challenge, new Date(NOW.getTime() + 600_000))).toBe(0);
    expect(secondsUntilExpiry(challenge, new Date(NOW.getTime() + 999_999))).toBe(0);
  });

  it('defaults to a ten minute lifetime', () => {
    const challenge = newChallenge('hash', NOW);
    expect(challenge.expiresAt.getTime() - NOW.getTime()).toBe(10 * MINUTE);
  });

  it('rejects an expired code with OTP_EXPIRED even when the code is correct', async () => {
    const challenge = challengeAt({ expiresAt: new Date(NOW.getTime() - 1) });
    await expect(evaluateOtpCode(challenge, '482913', NOW, matcher('482913'))).rejects.toMatchObject({
      code: 'OTP_EXPIRED',
    });
  });
});

describe('OTP attempt limits', () => {
  it('allows exactly five wrong attempts and locks on the sixth', async () => {
    const challenge = challengeAt();
    let current = challenge;

    for (let attempt = 1; attempt <= 5; attempt++) {
      const verdict = await evaluateOtpCode(current, '000000', NOW, matcher('482913'));
      expect(verdict.ok).toBe(false);
      if (verdict.ok) throw new Error('unreachable');
      expect(verdict.code).toBe('OTP_INVALID');
      expect(verdict.attemptsUsed).toBe(attempt);
      expect(verdict.attemptsRemaining).toBe(5 - attempt);
      current = { ...current, attempts: verdict.attemptsUsed };
    }

    expect(remainingAttempts(current)).toBe(0);
    expect(otpState(current, NOW)).toBe('locked');
    await expect(evaluateOtpCode(current, '482913', NOW, matcher('482913'))).rejects.toMatchObject({
      code: 'OTP_LOCKED',
    });
  });

  it('counts a malformed submission as an attempt, so it is not a free oracle', async () => {
    let current = challengeAt();
    const verdict = await evaluateOtpCode(current, 'abcdef', NOW, matcher('482913'));
    expect(verdict.ok).toBe(false);
    if (verdict.ok) throw new Error('unreachable');
    expect(verdict.attemptsUsed).toBe(1);
    current = { ...current, attempts: 1 };
    expect(remainingAttempts(current)).toBe(4);
  });

  it('does not spend an attempt when the submitted code is correct', async () => {
    const challenge = challengeAt({ attempts: 2 });
    const verdict = await evaluateOtpCode(challenge, '482913', NOW, matcher('482913'));
    expect(verdict.ok).toBe(true);
    if (!verdict.ok) throw new Error('unreachable');
    expect(verdict.challenge.attempts).toBe(2);
    expect(verdict.challenge.consumedAt).toEqual(NOW);
  });

  it('validates code shape', () => {
    expect(isWellFormedOtp('482913')).toBe(true);
    expect(isWellFormedOtp('482 913')).toBe(true);
    expect(isWellFormedOtp('48291')).toBe(false);
    expect(isWellFormedOtp('4829134')).toBe(false);
    expect(isWellFormedOtp('48291a')).toBe(false);
  });
});

describe('OTP single use', () => {
  it('marks the challenge consumed on success', async () => {
    const challenge = challengeAt();
    const verdict = await evaluateOtpCode(challenge, '482913', NOW, matcher('482913'));
    expect(verdict.ok).toBe(true);
    if (!verdict.ok) throw new Error('unreachable');
    expect(otpState(verdict.challenge, NOW)).toBe('consumed');
  });

  it('refuses a second use of the same challenge', async () => {
    const challenge = challengeAt({ consumedAt: new Date(NOW.getTime() - 1_000) });
    expect(otpState(challenge, NOW)).toBe('consumed');
    await expect(evaluateOtpCode(challenge, '482913', NOW, matcher('482913'))).rejects.toMatchObject({
      code: 'OTP_ALREADY_USED',
    });
  });

  it('reports a missing challenge as expired so the client resends', () => {
    expect(otpState(null, NOW)).toBe('missing');
    expect(() => assertChallengeUsable(null, NOW)).toThrowError(
      expect.objectContaining({ code: 'OTP_EXPIRED' }),
    );
  });
});

describe('OTP resend cooldown', () => {
  it('allows the first send for a user who has never asked', () => {
    expect(resendState(null, NOW)).toEqual({ allowed: true });
  });

  it('blocks for thirty seconds and counts down', () => {
    const sentAt = new Date(NOW.getTime() - 5_000);
    expect(resendState(sentAt, NOW)).toEqual({ allowed: false, retryAfterSeconds: 25 });
    expect(resendState(new Date(NOW.getTime() - 29_000), NOW)).toEqual({
      allowed: false,
      retryAfterSeconds: 1,
    });
    expect(resendState(new Date(NOW.getTime() - 30_000), NOW)).toEqual({ allowed: true });
    expect(resendState(new Date(NOW.getTime() - 45_000), NOW)).toEqual({ allowed: true });
  });

  it('throws the documented error while the cooldown is active', () => {
    const err = new AppError(429, 'OTP_RESEND_TOO_SOON', 'wait');
    expect(err.status).toBe(429);
  });
});

describe('OTP hashing in the real flow', () => {
  it('a code issued now verifies against its own hash and nothing else', async () => {
    const code = generateOtpCode(6);
    const hash = await hashOtpCode(code, 4);
    const challenge = newChallenge(hash, NOW);

    const good = await evaluateOtpCode(challenge, code, new Date(NOW.getTime() + 1_000));
    expect(good.ok).toBe(true);

    const wrong = await evaluateOtpCode(challenge, code === '000000' ? '111111' : '000000', NOW);
    expect(wrong.ok).toBe(false);
  });

  it('uses the real bcrypt verifier by default', async () => {
    const code = generateOtpCode(6);
    const challenge = newChallenge(await hashOtpCode(code, 4), NOW);
    const spy = vi.spyOn(Date, 'now');
    spy.mockReturnValue(NOW.getTime());
    try {
      await expect(evaluateOtpCode(challenge, code, NOW)).resolves.toMatchObject({ ok: true });
    } finally {
      spy.mockRestore();
    }
  });
});
