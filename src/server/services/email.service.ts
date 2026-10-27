import 'server-only';
import { prisma } from '@/lib/db';
import { getServerEnv } from '@/lib/env';
import { getEmailSettings } from './settings.service';
import type { EmailTemplate } from './email-templates';

/**
 * Outbound email.
 *
 * Two properties matter more than the transport:
 *
 *  - **A delivery failure never fails the business operation.** Callers are
 *    writing an enquiry or an invite; the email is a side effect. Every send is
 *    caught, recorded in `EmailLog`, and returned as a status.
 *  - **Nothing silently disappears.** With no provider configured (the default
 *    in development and CI) the row is written as `SKIPPED` with the recipient
 *    and subject, so the admin panel can show exactly what would have been sent.
 *
 * Resend is used over its HTTP API rather than an SDK: one `fetch`, no extra
 * dependency, and swapping providers later means changing this file only.
 */
export interface SendEmailInput extends EmailTemplate {
  to: string;
  /** Template name for the log, e.g. `vendor_invite`. */
  template: string;
}

export interface SendEmailResult {
  status: 'SENT' | 'FAILED' | 'SKIPPED';
  error?: string;
}

interface ResendResponse {
  id?: string;
  message?: string;
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const env = getServerEnv();

  let fromAddress = env.EMAIL_FROM;
  let replyTo: string | null = null;

  try {
    const settings = await getEmailSettings();
    fromAddress = settings.fromAddress;
    replyTo = settings.replyTo;
  } catch {
    // A settings read must never block an operational email; fall back to env.
  }

  const provider = env.RESEND_API_KEY ? 'resend' : 'none';

  if (!env.RESEND_API_KEY) {
    await recordLog(input, 'SKIPPED', 'none', null, 'No email provider configured');
    if (env.NODE_ENV !== 'production') {
      console.info(`[email] skipped (no provider): ${input.template} -> ${input.to}`);
    }
    return { status: 'SKIPPED' };
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
      signal: AbortSignal.timeout(10_000),
    });

    const payload = (await response.json().catch(() => ({}))) as ResendResponse;

    if (!response.ok) {
      const error = payload.message ?? `HTTP ${response.status}`;
      await recordLog(input, 'FAILED', provider, null, error);
      return { status: 'FAILED', error };
    }

    await recordLog(input, 'SENT', provider, payload.id ?? null, null);
    return { status: 'SENT' };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await recordLog(input, 'FAILED', provider, null, message);
    return { status: 'FAILED', error: message };
  }
}

async function recordLog(
  input: SendEmailInput,
  status: 'SENT' | 'FAILED' | 'SKIPPED',
  provider: string,
  providerMessageId: string | null,
  error: string | null,
): Promise<void> {
  try {
    await prisma.emailLog.create({
      data: {
        to: input.to,
        subject: input.subject.slice(0, 250),
        template: input.template,
        status,
        provider,
        providerMessageId,
        error: error?.slice(0, 500) ?? null,
      },
    });
  } catch (logError) {
    console.error('[email] could not record delivery log', logError);
  }
}
