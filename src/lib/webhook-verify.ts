import { createHmac } from 'crypto';
import { Receiver } from '@upstash/qstash';

/**
 * Verify a Close CRM webhook signature.
 * Close signs webhooks with HMAC-SHA256 using the webhook secret.
 */
export function verifyCloseWebhook(
  body: string,
  signature: string | null
): boolean {
  const secret = process.env.CLOSE_WEBHOOK_SECRET;
  if (!secret) {
    console.error('CLOSE_WEBHOOK_SECRET not configured');
    return false;
  }
  if (!signature) return false;

  const expected = createHmac('sha256', secret).update(body).digest('hex');
  return signature === expected;
}

/**
 * Verify a Retell post-call webhook signature.
 * Retell signs webhooks with HMAC-SHA256.
 */
export function verifyRetellWebhook(
  body: string,
  signature: string | null
): boolean {
  const secret = process.env.RETELL_WEBHOOK_SECRET;
  if (!secret) {
    console.error('RETELL_WEBHOOK_SECRET not configured');
    return false;
  }
  if (!signature) return false;

  const expected = createHmac('sha256', secret).update(body).digest('hex');
  return signature === expected;
}

/**
 * Verify a QStash webhook signature.
 * Uses the Upstash Receiver to verify the signature.
 */
export async function verifyQStashWebhook(
  body: string,
  signature: string | null,
  signingKeyOverride?: { current: string; next: string }
): Promise<boolean> {
  const currentKey = signingKeyOverride?.current || process.env.QSTASH_CURRENT_SIGNING_KEY;
  const nextKey = signingKeyOverride?.next || process.env.QSTASH_NEXT_SIGNING_KEY;

  if (!currentKey || !nextKey) {
    console.error('QStash signing keys not configured');
    return false;
  }
  if (!signature) return false;

  const receiver = new Receiver({
    currentSigningKey: currentKey,
    nextSigningKey: nextKey,
  });

  try {
    await receiver.verify({ body, signature });
    return true;
  } catch {
    return false;
  }
}
