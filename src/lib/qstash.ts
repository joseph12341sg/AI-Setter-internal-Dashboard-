import { Client } from '@upstash/qstash';

function getClient(): Client {
  const token = process.env.QSTASH_TOKEN;
  if (!token) throw new Error('QSTASH_TOKEN environment variable is not set');
  return new Client({ token });
}

function getAppUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL;
  if (!url) throw new Error('NEXT_PUBLIC_APP_URL environment variable is not set');
  return url;
}

interface LeadData {
  workspaceId: string;
  leadId: string;
  leadPhone: string;
  leadName: string;
  leadEmail: string | null;
  firmName: string;
}

/**
 * Schedule an inbound call (Agent 1) with a configurable delay.
 * QStash will call our /api/trigger/inbound endpoint after the delay.
 */
export async function scheduleInboundCall(
  leadData: LeadData,
  delaySeconds: number
): Promise<string> {
  const client = getClient();
  const appUrl = getAppUrl();

  const result = await client.publishJSON({
    url: `${appUrl}/api/trigger/inbound`,
    body: leadData,
    delay: delaySeconds,
    retries: 3,
  });

  return result.messageId;
}

/**
 * Schedule a retry call (Agent 2) at a specific time.
 * Used when a call outcome requires a follow-up at a calculated time.
 */
export async function scheduleRetryCall(
  leadData: LeadData & { attemptNumber: number; pipelineStage: string },
  callAt: Date
): Promise<string> {
  const client = getClient();
  const appUrl = getAppUrl();

  const delaySec = Math.max(0, Math.floor((callAt.getTime() - Date.now()) / 1000));

  const result = await client.publishJSON({
    url: `${appUrl}/api/trigger/retry-single`,
    body: leadData,
    delay: delaySec,
    retries: 3,
  });

  return result.messageId;
}

/**
 * Cancel a previously scheduled QStash job.
 */
export async function cancelJob(messageId: string): Promise<void> {
  const client = getClient();
  await client.messages.delete(messageId);
}

/**
 * Create or update the retry scheduler cron job.
 * Runs every 30 minutes during typical calling hours.
 * The actual calling-hours check happens inside the trigger route.
 */
export async function ensureRetrySchedule(): Promise<void> {
  const client = getClient();
  const appUrl = getAppUrl();

  // Every 30 minutes
  await client.schedules.create({
    destination: `${appUrl}/api/trigger/retry`,
    cron: '*/30 * * * *',
    retries: 2,
  });
}

/**
 * Create or update the morning confirmation cron job.
 * Runs at 9:00 AM UTC (adjusted for Europe/London).
 * The actual timezone check happens inside the trigger route.
 */
export async function ensureConfirmationSchedule(): Promise<void> {
  const client = getClient();
  const appUrl = getAppUrl();

  // 9:00 AM daily — the trigger route handles timezone conversion
  await client.schedules.create({
    destination: `${appUrl}/api/trigger/confirmation`,
    cron: '0 9 * * *',
    retries: 2,
  });
}
