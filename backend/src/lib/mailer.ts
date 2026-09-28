/* eslint-disable no-console */
import nodemailer, { type Transporter } from 'nodemailer';
import { config } from '../env.js';

let cached: Transporter | null = null;

function transporter(): Transporter {
  if (cached) return cached;
  cached = nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_SECURE,
    ...(config.SMTP_USER ? { auth: { user: config.SMTP_USER, pass: config.SMTP_PASSWORD } } : {}),
  });
  return cached;
}

export interface OtpEmail {
  to: string;
  name: string | null;
  code: string;
  expiresInMinutes: number;
}

/**
 * Test-only outbox.
 *
 * The plaintext code is deliberately never persisted anywhere the service can
 * read it back — that is the security property under test. But an integration
 * test still has to prove the happy path works, and standing in for "the user
 * opened their inbox" needs *some* channel. So when NODE_ENV=test the mailer
 * drops the code in memory here and nowhere else. Production code paths never
 * write to it, and it lives in the same process, so it disappears on restart.
 */
const outbox = new Map<string, string>();

export function readOtpOutbox(email: string): string | null {
  return outbox.get(email.toLowerCase()) ?? null;
}

export function clearOtpOutbox(): void {
  outbox.clear();
}


/**
 * Sends the verification code.
 *
 * `MAIL_MODE=console` skips SMTP entirely and prints the code, which keeps the
 * README's "15 minute quickstart" honest on a machine without Mailpit.
 * `MAIL_MODE=smtp` talks to whatever `SMTP_HOST` points at — Mailpit locally,
 * SES / SendGrid / Gmail in production. See README "Email delivery".
 */
export async function sendOtpEmail({ to, name, code, expiresInMinutes }: OtpEmail): Promise<void> {
  const subject = `${code} is your PadosiPro verification code`;
  const html = renderOtpEmail(code, expiresInMinutes);
  const text = renderOtpEmailText(code, expiresInMinutes);

  if (config.isTest) {
    outbox.set(to.toLowerCase(), code);
    return;
  }

  if (config.MAIL_MODE === 'console') {
    console.info(
      [
        '',
        '  +---------------------------------------------------+',
        `  |  PadosiPro verification code for ${to.padEnd(32)}|`,
        '  |                                                   |',
        `  |        ${code}   -   valid ${expiresInMinutes} minutes           |`,
        '  |                                                   |',
        '  +---------------------------------------------------+',
        '',
      ].join('\n'),
    );
    return;
  }

  await transporter().sendMail({ from: config.MAIL_FROM, to, subject, text, html });
}

function renderOtpEmailText(code: string, expiresInMinutes: number): string {
  return [
    `Hi${''},`,
    '',
    `Your PadosiPro verification code is ${code}`,
    '',
    `It is valid for ${expiresInMinutes} minutes and can only be used once.`,
    'If you did not create a PadosiPro account you can ignore this email.',
    '',
    '— The PadosiPro team',
  ].join('\n');
}

function renderOtpEmail(code: string, expiresInMinutes: number): string {
  return `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:24px;background:#FAFAF7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#101828;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#FFFFFF;border:1px solid #EAECF0;border-radius:20px;padding:32px;">
          <tr><td style="font-size:13px;letter-spacing:2px;color:#155C49;font-weight:600;">PADOSIPRO</td></tr>
          <tr><td style="padding-top:8px;font-size:24px;line-height:32px;font-weight:600;">Verify your email</td></tr>
          <tr><td style="padding-top:8px;font-size:15px;line-height:24px;color:#667085;">Enter this code to finish setting up your account.</td></tr>
          <tr><td style="padding:24px 0;">
            <div style="font-size:34px;letter-spacing:10px;font-weight:700;color:#155C49;background:#E8F8F3;border-radius:16px;padding:20px 0;text-align:center;">${code}</div>
          </td></tr>
          <tr><td style="font-size:14px;line-height:22px;color:#667085;">This code expires in <strong style="color:#101828;">${expiresInMinutes} minutes</strong> and can only be used once.</td></tr>
          <tr><td style="padding-top:24px;font-size:13px;line-height:20px;color:#98A2B3;">If you did not create a PadosiPro account you can safely ignore this email.</td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}
