import nodemailer, { type Transporter } from 'nodemailer';
import { config } from '../env.js';

/**
 * Transactional email.
 *
 * Production delivery is **Brevo SMTP** (`smtp-relay.brevo.com:587`). Two other
 * modes exist and neither is a silent fallback — the mode is explicit, and the
 * config for the chosen mode is checked at boot, so a misconfigured deployment
 * fails immediately rather than accepting signups it cannot email.
 *
 *   brevo   -> Brevo's SMTP relay. The assignment's real path.
 *   smtp    -> the generic SMTP_* block. Local Mailpit, or any other relay.
 *   console -> print the code, open no socket. Local development only.
 *
 * Credentials are read from the environment and never logged. The Brevo password
 * is a Brevo *SMTP key* (Brevo > Account > SMTP & API > SMTP keys); the account
 * password and the API key do not work here.
 */

let cached: Transporter | null = null;

/** Where the sender identity comes from, whichever way it was configured. */
function fromAddress(): string {
  if (config.MAIL_FROM) return config.MAIL_FROM;
  const name = config.MAIL_FROM_NAME?.trim() || 'PadosiPro';
  const email = config.MAIL_FROM_EMAIL ?? '';
  return email ? `${name} <${email}>` : name;
}

function transportOptions() {
  if (config.MAIL_MODE === 'brevo') {
    // Port 587 is STARTTLS: the socket starts plaintext and is upgraded. Setting
    // `secure` for 587 would make nodemailer dial implicit TLS on the wrong port
    // and Brevo would drop the connection. Implicit TLS is 465.
    const secure = config.BREVO_SMTP_PORT === 465;
    return {
      host: config.BREVO_SMTP_HOST,
      port: config.BREVO_SMTP_PORT,
      secure,
      requireTLS: !secure,
      auth: { user: config.BREVO_SMTP_USER ?? '', pass: config.BREVO_SMTP_PASSWORD ?? '' },
      // Fail fast rather than hanging a signup behind a black-holed socket.
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    } as const;
  }

  return {
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_SECURE,
    ...(config.SMTP_USER ? { auth: { user: config.SMTP_USER, pass: config.SMTP_PASSWORD } } : {}),
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  } as const;
}

function transporter(): Transporter {
  if (cached) return cached;
  cached = nodemailer.createTransport(transportOptions());
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
 *
 * It is also how a seeded *real* delivery test can assert the SMTP hand-off
 * without scraping the message out of a mailbox.
 */
const outbox = new Map<string, string>();

export function readOtpOutbox(email: string): string | null {
  return outbox.get(email.toLowerCase()) ?? null;
}

export function clearOtpOutbox(): void {
  outbox.clear();
}

/** Test seam: lets a suite assert what would have been handed to the transport. */
export function resetTransporterForTests(): void {
  cached = null;
}

/**
 * Sends the verification code over the configured transport.
 *
 * Throws on failure. The caller (`auth/service.ts`) treats a throw as "the code
 * was never delivered" and rolls the challenge back, so a 502 from Brevo leaves
 * the user able to retry rather than staring at a code that will never arrive.
 */
export async function sendOtpEmail({ to, name, code, expiresInMinutes }: OtpEmail): Promise<void> {
  const subject = `${code} is your PadosiPro verification code`;
  const html = renderOtpEmail(code, expiresInMinutes);
  const text = renderOtpEmailText(name, code, expiresInMinutes);

  if (config.isTest) {
    outbox.set(to.toLowerCase(), code);
    return;
  }

  if (config.MAIL_MODE === 'console') {
    // The `CODE:` marker is deliberate: it makes the line greppable by tooling
    // (`npm run smoke` and manual curl walks both read it) while staying obvious
    // to a human reading the server output.
    console.info(
      [
        '',
        '  +---------------------------------------------------+',
        '  |  PadosiPro verification code                        |',
        `  |  to:   ${to.padEnd(43)}|`,
        `  |  CODE: ${code}   valid ${expiresInMinutes} minutes              |`,
        '  +---------------------------------------------------+',
        '',
      ].join('\n'),
    );
    return;
  }

  try {
    await transporter().sendMail({ from: fromAddress(), to, subject, text, html });
  } catch (err) {
    // Log the transport and the code class, never the key and never the OTP.
    const reason = err instanceof Error ? err.message : String(err);
    console.error(
      `[mail] SMTP delivery failed via ${config.MAIL_MODE} to ${to}: ${reason}`,
    );
    throw err;
  }
}

function greeting(name: string | null): string {
  const first = name?.trim().split(/\s+/)[0];
  return first ? `Hi ${first},` : 'Hi,';
}

function renderOtpEmailText(name: string | null, code: string, expiresInMinutes: number): string {
  return [
    greeting(name),
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
