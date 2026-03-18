import { NextRequest, NextResponse } from 'next/server';
import { verifyQStashWebhook } from '@/lib/webhook-verify';
import { isWorkspaceOperational, getWorkspaceById } from '@/lib/workspace';
import { isOnDncList } from '@/lib/dnc';
import { isWithinCallingHours, getNextCallingWindow } from '@/lib/calling-hours';
import { createCall } from '@/lib/retell';
import { scheduleRetryCall } from '@/lib/qstash';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * POST /api/trigger/retry-single
 *
 * Called by QStash for a single scheduled retry (Agent 2).
 * Similar to inbound trigger but for retry attempts.
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
    attemptNumber: number;
    pipelineStage: string;
  };

  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { workspaceId, leadId, leadPhone, leadName, leadEmail, firmName, attemptNumber, pipelineStage } = payload;

  // 2. Re-check workspace operational
  const { operational, reason } = await isWorkspaceOperational(workspaceId);
  if (!operational) {
    return NextResponse.json({ ok: true, skipped: reason });
  }

  // 3. Re-check DNC
  if (await isOnDncList(leadPhone, workspaceId)) {
    const supabase = createServiceClient();
    await supabase
      .from('retry_queue')
      .update({ status: 'dnc' })
      .eq('workspace_id', workspaceId)
      .eq('lead_id', leadId)
      .eq('status', 'pending');
    return NextResponse.json({ ok: true, skipped: 'DNC' });
  }

  // 4. Re-check calling hours
  const withinHours = await isWithinCallingHours('agent2', workspaceId);
  if (!withinHours) {
    const nextWindow = await getNextCallingWindow('agent2', workspaceId);
    const newJobId = await scheduleRetryCall(payload, nextWindow);
    const supabase = createServiceClient();
    await supabase
      .from('retry_queue')
      .update({ next_call_at: nextWindow.toISOString(), qstash_job_id: newJobId })
      .eq('workspace_id', workspaceId)
      .eq('lead_id', leadId)
      .eq('status', 'pending');
    return NextResponse.json({ ok: true, rescheduled: true });
  }

  // 5. Get workspace config
  const workspace = await getWorkspaceById(workspaceId);
  if (!workspace?.retell_agent_2_id || !workspace?.retell_phone_number) {
    return NextResponse.json({ error: 'Agent 2 not configured' }, { status: 500 });
  }

  // 6. Mark in_progress
  const supabase = createServiceClient();
  await supabase
    .from('retry_queue')
    .update({ status: 'in_progress' })
    .eq('workspace_id', workspaceId)
    .eq('lead_id', leadId)
    .eq('status', 'pending');

  // 7. Build variables — call_attempt is critical
  const variables: Record<string, string> = {
    lead_name: leadName || 'there',
    lead_email: leadEmail || '',
    lead_source: pipelineStage || '',
    call_attempt: String(attemptNumber),
    firm_name: firmName || '',
  };
  if (workspace.agent_name) variables.agent_name = workspace.agent_name;

  try {
    const callResponse = await createCall({
      agentId: workspace.retell_agent_2_id,
      toNumber: leadPhone,
      fromNumber: workspace.retell_phone_number,
      variables,
      workspaceId,
    });

    await supabase.from('call_logs').insert({
      workspace_id: workspaceId,
      lead_id: leadId,
      lead_name: leadName,
      lead_phone: leadPhone,
      call_sid: callResponse.call_id,
      agent_type: 'agent2',
      attempt_number: attemptNumber,
      trigger_type: 'retry',
      pipeline_stage_at_call: pipelineStage,
      variables_injected: variables,
    });

    return NextResponse.json({ ok: true, callId: callResponse.call_id });
  } catch (err) {
    console.error(`Retry-single call failed for lead ${leadId}:`, err);
    await supabase
      .from('retry_queue')
      .update({ status: 'pending' })
      .eq('workspace_id', workspaceId)
      .eq('lead_id', leadId)
      .eq('status', 'in_progress');
    return NextResponse.json({ error: 'Failed to initiate call' }, { status: 500 });
  }
}
