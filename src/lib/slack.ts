import { getDiallerSettings } from '@/lib/workspace';

interface SlackMessage {
  channel?: string;
  text: string;
  blocks?: unknown[];
}

/**
 * Post a message to a Slack webhook.
 */
async function postToWebhook(webhookUrl: string, message: SlackMessage): Promise<void> {
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(message),
  });

  if (!response.ok) {
    console.error(`Slack webhook failed (${response.status}): ${await response.text()}`);
  }
}

/**
 * Post a call outcome notification to the appropriate Slack channel.
 */
export async function postOutcome({
  outcome,
  leadName,
  duration,
  attempt,
  agentType,
  workspaceId,
}: {
  outcome: string;
  leadName: string;
  duration: number | null;
  attempt: number;
  agentType: string;
  workspaceId: string;
}): Promise<void> {
  const settings = await getDiallerSettings(workspaceId);
  if (!settings?.slack_webhook_url) return;

  const durationStr = duration ? `${Math.floor(duration / 60)}m ${duration % 60}s` : 'N/A';
  const agentLabel = agentType === 'agent1' ? 'Instant Trigger' : agentType === 'agent2' ? 'Pipeline Retry' : 'Morning Confirmation';

  // Determine which channel to post to based on outcome
  let channel: string | undefined;
  if (outcome === 'booked') {
    channel = settings.slack_channel_booked || undefined;
  } else if (['no_answer', 'voicemail_left'].includes(outcome)) {
    channel = settings.slack_channel_no_answer || undefined;
  } else {
    channel = settings.slack_channel_alerts || undefined;
  }

  const emoji = outcome === 'booked' ? ':calendar:' : outcome === 'no_answer' ? ':phone:' : ':warning:';

  const message: SlackMessage = {
    channel,
    text: `${emoji} *${outcome.replace(/_/g, ' ').toUpperCase()}* — ${leadName}`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: [
            `${emoji} *${outcome.replace(/_/g, ' ').toUpperCase()}*`,
            `*Lead:* ${leadName}`,
            `*Agent:* ${agentLabel}`,
            `*Attempt:* ${attempt}`,
            `*Duration:* ${durationStr}`,
          ].join('\n'),
        },
      },
    ],
  };

  await postToWebhook(settings.slack_webhook_url, message);
}

/**
 * Post an alert to the alerts channel (system errors, kill switch, etc).
 */
export async function postAlert({
  title,
  message,
  workspaceId,
}: {
  title: string;
  message: string;
  workspaceId: string;
}): Promise<void> {
  const settings = await getDiallerSettings(workspaceId);
  if (!settings?.slack_webhook_url) return;

  await postToWebhook(settings.slack_webhook_url, {
    channel: settings.slack_channel_alerts || undefined,
    text: `:rotating_light: *${title}*\n${message}`,
  });
}
