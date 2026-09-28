/**
 * Client-side validation.
 *
 * These rules intentionally mirror `backend/src/validation/schemas.ts`. The
 * client copy exists to give immediate feedback without a round trip; the server
 * remains the authority and its `details` map is what populates the field errors
 * when the two ever disagree.
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MOBILE_PATTERN = /^[6-9]\d{9}$/;

export const validators = {
  email(value: string): string | null {
    const trimmed = value.trim();
    if (!trimmed) return 'Email is required';
    if (!EMAIL_PATTERN.test(trimmed)) return 'Enter a valid email address';
    return null;
  },

  password(value: string): string | null {
    if (!value) return 'Password is required';
    if (value.length < 8) return 'Use at least 8 characters';
    if (!/[a-z]/.test(value)) return 'Include at least one lowercase letter';
    if (!/[A-Z]/.test(value)) return 'Include at least one uppercase letter';
    if (!/[0-9]/.test(value)) return 'Include at least one number';
    return null;
  },

  confirmPassword(value: string, original: string): string | null {
    if (!value) return 'Confirm your password';
    if (value !== original) return 'Passwords do not match';
    return null;
  },

  name(value: string): string | null {
    const trimmed = value.trim();
    if (!trimmed) return 'Enter your full name';
    if (trimmed.length < 2) return 'That name looks too short';
    return null;
  },

  mobile(value: string): string | null {
    const digits = normaliseMobile(value);
    if (!digits) return 'Enter your mobile number';
    if (digits.length !== 10) return 'Enter a 10-digit mobile number';
    if (!MOBILE_PATTERN.test(digits)) return 'Enter a valid Indian mobile number';
    return null;
  },

  address(value: string): string | null {
    const trimmed = value.trim();
    if (!trimmed) return 'Enter your address';
    if (trimmed.length < 10) return 'Include your locality and PIN code';
    return null;
  },

  businessName(value: string): string | null {
    if (value.trim().length > 120) return 'That business name is too long';
    return null;
  },

  otp(value: string, length = 6): string | null {
    const digits = value.replace(/\D/g, '');
    if (!digits) return 'Enter the code sent to your email';
    if (digits.length !== length) return `The code is ${length} digits`;
    return null;
  },
};

/** Same normalisation the API applies, so the preview matches what gets saved. */
export function normaliseMobile(value: string): string {
  let digits = value.replace(/[\s\-()]/g, '').replace(/^\+/, '');
  if (digits.startsWith('0')) digits = digits.slice(1);
  if (/^91\d{10}$/.test(digits)) digits = digits.slice(2);
  return digits;
}

export type FieldErrors = Record<string, string | null>;

/** Runs every rule for a form and returns only the failures. */
export function validateForm(
  values: Record<string, string>,
  rules: Record<string, (value: string) => string | null>,
): FieldErrors {
  const errors: FieldErrors = {};
  for (const [field, rule] of Object.entries(rules)) {
    const message = rule(values[field] ?? '');
    if (message) errors[field] = message;
  }
  return errors;
}

export const hasErrors = (errors: FieldErrors): boolean => Object.values(errors).some(Boolean);
