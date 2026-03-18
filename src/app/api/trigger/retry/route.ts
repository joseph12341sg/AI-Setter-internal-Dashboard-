import { NextRequest, NextResponse } from 'next/server';
import { verifyQStashWebhook } from '@/lib/webhook-verify';
import { isWorkspaceOperational, getWorkspaceById, getDiallerSettings } from '@/lib/workspace';
import { isOnDncList } from '@/lib/dnc';
import { isWithinCallingHours } from '@/lib/calling-hours';
import { createCall } from '@/lib/retell';
import { createServiceClient } from '@/lib/supabase/server';
import * as close from '@/lib/close';

/**
 * POST /api/trigger/retry
 *
 * Called by QStash cron every 30 minutes.
 * Queries the retry_queue for pending leads due now, then initiates Agent 2 calls.
 */
export async function POST(request: NextRequest) {
  const body = await request.text();

  // 1. Verify QStash signature
  const signature = request.headers.get('upstash-signature');
  const valid = await verifyQStashWebhook(body, signature);
  if (!valid) {
    return NextResponse.json({ error: 'Invalid QStash signature' }, { status: 401 });
  }

  const supabase = createServiceClient();

  // 2. Get all active workspaces
  const { data: workspaces } = await supabase
    .from('workspaces')
    .select('id')
    .eq('is_active', true);

  if (!workspaces || workspaces.length === 0) {
    return NextResponse.json({ ok: true, processed: 0 });
  }

  let totalProcessed = 0;
  let totalSkipped = 0;

  for (const ws of workspaces) {
    const workspaceId = ws.id;

    // 3. Check workspace operational
    const { operational, reason } = await isWorkspaceOperational(workspaceId);
    if (!operational) {
      console.log(`Retry skip workspace ${workspaceId}: ${reason}`);
      continue;
    }

    // 4. Check calling hours for Agent 2
    const withinHours = await isWithinCallingHours('agent2', workspaceId);
    if (!withinHours) {
      continue;
    }

    // 5. Query pending retry entries due now
    const { data: entries } = await supabase
      .from('retry_queue')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('status', 'pending')
      .eq('agent_type', 'agent2')
      .lte('next_call_at', new Date().toISOString())
      .order('next_call_at', { ascending: true })
      .limit(10); // Batch size to respect Retell rate limits

    if (!entries || entries.length === 0) continue;

    const workspace = await getWorkspaceById(workspaceId);
    if (!workspace?.retell_agent_2_id || !workspace?.retell_phone_number) {
      console.error(`Agent 2 not configured for workspace ${workspaceId}`);
      continue;
    }

    const settings = await getDiallerSettings(workspaceId);

    for (const entry of entries) {
      // 6. Re-check DNC
      if (await isOnDncList(entry.lead_phone, workspaceId)) {
        await supabase
          .from('retry_queue')
          .update({ status: 'dnc' })
          .eq('id', entry.id);
        totalSkipped++;
        continue;
      }

      // 7. Check max attempts from pipeline rules
      const { data: rules } = await supabase
        .from('pipeline_rules')
        .select('max_attempts')
        .eq('workspace_id', workspaceId)
        .eq('is_enabled', true)
        .limit(1);

      const maxAttempts = rules?.[0]?.max_attempts || 5;

      if (entry.attempt_number > maxAttempts) {
        await supabase
          .from('retry_queue')
          .update({ status: 'exhausted', last_outcome: 'max_attempts' })
          .eq('id', entry.id);

        await close.createActivity(
          entry.lead_id,
          `Max call attempts (${maxAttempts}) exhausted — AI Setter`,
          workspaceId
        );
        totalSkipped++;
        continue;
      }

      // 8. Mark as in_progress
      await supabase
        .from('retry_queue')
        .update({ status: 'in_progress' })
        .eq('id', entry.id);

      // 9. Build variables — call_attempt is critical for Agent 2's prompt
      const variables: Record<string, string> = {
        lead_name: entry.lead_name || 'there',
        lead_email: entry.lead_email || '',
        lead_source: entry.pipeline_stage || '',
        call_attempt: String(entry.attempt_number),
        firm_name: entry.firm_name || '',
      };

      if (workspace.agent_name) {
        variables.agent_name = workspace.agent_name;
      }

      try {
        const callResponse = await createCall({
          agentId: workspace.retell_agent_2_id,
          toNumber: entry.lead_phone,
          fromNumber: workspace.retell_phone_number,
          variables,
          workspaceId,
        });

        // 10. Log the call
        await supabase.from('call_logs').insert({
          workspace_id: workspaceId,
          lead_id: entry.lead_id,
          lead_name: entry.lead_name,
          lead_phone: entry.lead_phone,
          call_sid: callResponse.call_id,
          agent_type: 'agent2',
          attempt_number: entry.attempt_number,
          trigger_type: 'retry',
          pipeline_stage_at_call: entry.pipeline_stage,
          variables_injected: variables,
        });

        totalProcessed++;
      } catch (err) {
        console.error(`Retry call failed for lead ${entry.lead_id}:`, err);

        // Revert to pending for next cron run
        await supabase
          .from('retry_queue')
          .update({ status: 'pending' })
          .eq('id', entry.id);
      }

      // Small delay between calls to respect rate limits
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  return NextResponse.json({ ok: true, processed: totalProcessed, skipped: totalSkipped });
}
