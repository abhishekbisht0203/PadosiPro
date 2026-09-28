import { describe, expect, it } from 'vitest';
import { parseBody, profileBodySchema, passwordSchema, emailSchema } from '../validation/schemas.js';

/**
 * Validation is the app's first line of defence and also the source of every
 * inline error message, so its behaviour is pinned here rather than only being
 * exercised indirectly through routes.
 */

describe('email validation', () => {
  it('lower-cases and trims, so casing never creates a second account', () => {
    const parsed = parseBody(emailSchema, '  Arjun.Rao@Example.COM ');
    expect(parsed).toBe('arjun.rao@example.com');
  });

  it.each([
    ['arjun@example.com', true],
    ['a.b+tag@sub.domain.co.in', true],
    ['plain', false],
    ['no-at-sign', false],
    ['@example.com', false],
    ['spaces in@example.com', false],
    ['trailing@', false],
    ['double@@example.com', false],
  ])('%s -> valid=%s', (value, expected) => {
    expect(emailSchema.safeParse(value).success).toBe(expected);
  });
});

describe('password validation', () => {
  it.each([
    ['Str0ngPass!', true],
    ['Aa1bcdef', true],
    ['short1A', false], // < 8 chars
    ['alllowercase1', false], // no uppercase
    ['ALLUPPERCASE1', false], // no lowercase
    ['NoDigitsHere', false], // no number
  ])('%s -> valid=%s', (value, expected) => {
    expect(passwordSchema.safeParse(value).success).toBe(expected);
  });

  it('rejects longer than bcrypt\'s 72-byte limit', () => {
    // bcrypt silently truncates beyond 72 bytes, which would make two
    // different passwords equivalent. Reject instead.
    expect(passwordSchema.safeParse(`Aa1${'x'.repeat(70)}`).success).toBe(false);
  });
});

describe('mobile normalisation', () => {
  it.each([
    ['9876543210', '9876543210'],
    ['+91 98765 43210', '9876543210'],
    ['+919876543210', '9876543210'],
    ['091-98765-43210', '9876543210'],
    ['(98765) 43210', '9876543210'],
  ])('%s -> %s', (input, expected) => {
    const parsed = parseBody(profileBodySchema, {
      name: 'Arjun Rao',
      mobile: input,
      address: '12 Banjara Hills, Hyderabad 500034',
    });
    expect(parsed.mobile).toBe(expected);
  });

  it.each(['1234567890', '12345', '98765432101', 'abcdefghij', ''])('rejects %s', (input) => {
    const result = profileBodySchema.safeParse({
      name: 'Arjun Rao',
      mobile: input,
      address: '12 Banjara Hills, Hyderabad 500034',
    });
    expect(result.success).toBe(false);
  });
});

describe('profile validation', () => {
  it('treats business name as optional, but rejects it when given and absurd', () => {
    const base = { name: 'Arjun Rao', mobile: '9876543210', address: '12 Banjara Hills, Hyderabad 500034' };
    expect(profileBodySchema.safeParse(base).success).toBe(true);
    expect(profileBodySchema.safeParse({ ...base, businessName: undefined }).success).toBe(true);
    expect(profileBodySchema.safeParse({ ...base, businessName: null }).success).toBe(true);
    expect(profileBodySchema.safeParse({ ...base, businessName: '' }).success).toBe(true);
    expect(profileBodySchema.safeParse({ ...base, businessName: 'Rao Textiles' }).success).toBe(true);
    expect(profileBodySchema.safeParse({ ...base, businessName: 'x'.repeat(200) }).success).toBe(false);
  });

  it('requires a real address', () => {
    const result = profileBodySchema.safeParse({ name: 'Arjun Rao', mobile: '9876543210', address: 'Hyderabad' });
    expect(result.success).toBe(false);
  });
});
