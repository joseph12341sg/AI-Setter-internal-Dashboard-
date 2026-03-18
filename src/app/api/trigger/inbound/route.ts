import { NextRequest, NextResponse } from 'next/server';
import { verifyQStashWebhook } from '@/lib/webhook-verify';
import { isWorkspaceOperational, getWorkspaceById } from '@/lib/workspace';
import { isOnDncList } from '@/lib/dnc';
import { isWithinCallingHours, getNextCallingWindow } from '@/lib/calling-hours';
import { createCall } from '@/lib/retell';
import { scheduleInboundCall } from '@/lib/qstash';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * POST /api/trigger/inbound
 *
 * Called by QStash after the configured delay.
 * Re-checks all preconditions, then initiates an Agent 1 outbound call via Retell.
 */
export async function POST(request: NextRequest) {
  const body = await request.text();

  // 1. Verify QStash signature
  const signature = request.headers.get('upstash-signature');
  const valid = await verifyQStashWebhook(body, signature);
  if (!valid) {
    return NextResponse.json({ error: 'Invalid QStash signature' }, { status: 401 });
  }

  let payload: {
    workspaceId: string;
    leadId: string;
    leadPhone: string;
    leadName: string;
    leadEmail: string | null;
    firmName: string;
  };

  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { workspaceId, leadId, leadPhone, leadName, leadEmail, firmName } = payload;

  // 2. Re-check workspace operational status (kill switch may have changed)
  const { operational, reason } = await isWorkspaceOperational(workspaceId);
  if (!operational) {
    return NextResponse.json({ ok: true, skipped: reason });
  }

  // 3. Re-check DNC list
  if (await isOnDncList(leadPhone, workspaceId)) {
    return NextResponse.json({ ok: true, skipped: 'Phone on DNC list' });
  }

  // 4. Re-check calling hours — if outside, reschedule
  const withinHours = await isWithinCallingHours('agent1', workspaceId);
  if (!withinHours) {
    const nextWindow = await getNextCallingWindow('agent1', workspaceId);
    const delaySec = Math.max(1, Math.floor((nextWindow.getTime() - Date.now()) / 1000));
    const newMessageId = await scheduleInboundCall(payload, delaySec);

    // Update the retry queue entry
    const supabase = createServiceClient();
    await supabase
      .from('retry_queue')
      .update({
        next_call_at: nextWindow.toISOString(),
        qstash_job_id: newMessageId,
      })
      .eq('workspace_id', workspaceId)
      .eq('lead_id', leadId)
      .eq('agent_type', 'agent1')
      .eq('status', 'pending');

    return NextResponse.json({ ok: true, rescheduled: true, delaySec });
  }

  // 5. Get workspace for agent config
  const workspace = await getWorkspaceById(workspaceId);
  if (!workspace?.retell_agent_1_id || !workspace?.retell_phone_number) {
    return NextResponse.json({ error: 'Agent 1 not configured' }, { status: 500 });
  }

  // 6. Mark retry queue entry as in_progress
  const supabase = createServiceClient();
  await supabase
    .from('retry_queue')
    .update({ status: 'in_progress' })
    .eq('workspace_id', workspaceId)
    .eq('lead_id', leadId)
    .eq('agent_type', 'agent1')
    .eq('status', 'pending');

  // 7. Initiate the Retell call
  const variables: Record<string, string> = {
    lead_name: leadName,
    lead_email: leadEmail || '',
    firm_name: firmName,
  };

  if (workspace.agent_name) {
    variables.agent_name = workspace.agent_name;
  }

  try {
    const callResponse = await createCall({
      agentId: workspace.retell_agent_1_id,
      toNumber: leadPhone,
      fromNumber: workspace.retell_phone_number,
      variables,
      workspaceId,
    });

    // 8. Log the call initiation
    await supabase.from('call_logs').insert({
      workspace_id: workspaceId,
      lead_id: leadId,
      lead_name: leadName,
      lead_phone: leadPhone,
      call_sid: callResponse.call_id,
      agent_type: 'agent1',
      attempt_number: 1,
      trigger_type: 'inbound',
      pipeline_stage_at_call: 'New Lead',
      variables_injected: variables,
    });

    return NextResponse.json({ ok: true, callId: callResponse.call_id });
  } catch (err) {
    console.error('Failed to create Retell call:', err);

    // Revert retry queue to pending so it can be retried
    await supabase
      .from('retry_queue')
      .update({ status: 'pending' })
      .eq('workspace_id', workspaceId)
      .eq('lead_id', leadId)
      .eq('agent_type', 'agent1')
      .eq('status', 'in_progress');

    return NextResponse.json(
      { error: 'Failed to initiate call' },
      { status: 500 }
    );
  }
}
