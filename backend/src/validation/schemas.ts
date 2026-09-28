import { z } from 'zod';
import { badRequest } from '../lib/errors.js';

/**
 * Every request body is validated by a zod schema before a handler runs.
 * Failures are converted to the standard error envelope with per-field
 * `details` so the app can render them inline.
 */

export const emailSchema = z
  .string()
  .trim()
  .min(1, 'Email is required')
  .max(254, 'That email address is too long')
  .toLowerCase()
  .email('Enter a valid email address');

export const passwordSchema = z
  .string()
  .min(8, 'Use at least 8 characters')
  .max(72, 'Use at most 72 characters')
  .refine((v) => /[a-z]/.test(v), 'Include at least one lowercase letter')
  .refine((v) => /[A-Z]/.test(v), 'Include at least one uppercase letter')
  .refine((v) => /[0-9]/.test(v), 'Include at least one number');

export const otpSchema = z
  .string()
  .trim()
  .regex(/^\d{4,10}$/, 'Enter the code sent to your email');

export const registerBodySchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const loginBodySchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required').max(72, 'That password is too long'),
});

export const verifyOtpBodySchema = z.object({
  email: emailSchema,
  code: otpSchema,
});

export const resendOtpBodySchema = z.object({
  email: emailSchema,
});

/**
 * Indian mobile numbers. Users type this every which way — `9876543210`,
 * `+91 98765 43210`, `091-98765-43210` — so it is normalised to a bare 10 digit
 * number before validation, and that is what gets stored.
 */
export const mobileSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s\-()]/g, '').replace(/^\+/, ''))
  // Drop a leading trunk prefix (091…) then a country prefix (+91 / 9191…) so
  // that all of `9876543210`, `+91 98765 43210` and `091-98765-43210` land on
  // the same bare 10 digit value before validation.
  .transform((v) => (v.startsWith('0') ? v.slice(1) : v))
  .transform((v) => (/^91\d{10}$/.test(v) ? v.slice(2) : v))
  .refine((v) => /^[6-9]\d{9}$/.test(v), 'Enter a valid 10-digit Indian mobile number');

export const profileBodySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Enter your full name')
    .max(80, 'That name is too long'),
  mobile: mobileSchema,
  address: z
    .string()
    .trim()
    .min(10, 'Enter your full address, including PIN code')
    .max(400, 'That address is too long'),
  /**
   * Optional on purpose: the brief allows it and it is genuinely optional for
   * a household. Roughly a third of PadosiPro users are individuals rather than
   * businesses, and forcing a business name on them adds friction to a flow we
   * want fast. Rationale repeated in README / DESIGN.md.
   */
  businessName: z
    .string()
    .trim()
    .max(120, 'That business name is too long')
    .optional()
    .nullable(),
});

export const taskSelectionBodySchema = z.object({
  taskIds: z
    .array(z.coerce.number().int().positive())
    .max(200, 'You can select up to 200 tasks')
    .default([]),
});

export type RegisterBody = z.infer<typeof registerBodySchema>;
export type LoginBody = z.infer<typeof loginBodySchema>;
export type VerifyOtpBody = z.infer<typeof verifyOtpBodySchema>;
export type ProfileBody = z.infer<typeof profileBodySchema>;
export type TaskSelectionBody = z.infer<typeof taskSelectionBodySchema>;

export function parseBody<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body ?? {});
  if (result.success) return result.data;

  const details: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join('.') || 'form';
    if (!details[key]) details[key] = issue.message;
  }
  throw badRequest('VALIDATION_ERROR', 'Please check the highlighted fields.', details);
}
