import { NextRequest, NextResponse } from 'next/server';
import { verifyRetellWebhook } from '@/lib/webhook-verify';
import { routeOutcome } from '@/lib/outcome-router';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * POST /api/webhooks/retell
 *
 * Receives Retell post-call webhook after each call completes.
 * Extracts outcome, logs it, routes to Close CRM, schedules retries, sends Slack alerts.
 */
export async function POST(request: NextRequest) {
  const body = await request.text();

  // 1. Verify Retell webhook signature
  const signature = request.headers.get('x-retell-signature');
  if (!verifyRetellWebhook(body, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // 2. Extract core fields from Retell webhook payload
  const callId = payload.call_id as string;
  const callStatus = payload.call_status as string;
  const disconnectionReason = payload.disconnection_reason as string | undefined;
  const durationMs = payload.duration_ms as number | undefined;
  const recordingUrl = payload.recording_url as string | undefined;
  const transcriptUrl = payload.transcript_url as string | undefined;
  const metadata = payload.metadata as Record<string, string> | undefined;
  const callAnalysis = payload.call_analysis as Record<string, unknown> | undefined;
  const retellDynamicVars = payload.retell_llm_dynamic_variables as Record<string, string> | undefined;

  if (!callId) {
    return NextResponse.json({ error: 'Missing call_id' }, { status: 400 });
  }

  // 3. Get workspace ID from metadata (we set it when creating the call)
  const workspaceId = metadata?.workspace_id;
  if (!workspaceId) {
    // Try to find by call_sid in call_logs
    const supabase = createServiceClient();
    const { data: log } = await supabase
      .from('call_logs')
      .select('workspace_id, lead_id, lead_phone, lead_name, agent_type, attempt_number, pipeline_stage_at_call, variables_injected')
      .eq('call_sid', callId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!log) {
      console.error(`Retell webhook: no workspace found for call ${callId}`);
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    // Map Retell outcome to our outcome taxonomy
    const outcome = mapRetellOutcome(callStatus, disconnectionReason, callAnalysis);

    await routeOutcome({
      callSid: callId,
      workspaceId: log.workspace_id,
      leadId: log.lead_id,
      leadPhone: log.lead_phone,
      leadName: log.lead_name || 'Unknown',
      leadEmail: null,
      firmName: (log.variables_injected as Record<string, string>)?.firm_name || 'Unknown',
      agentType: log.agent_type,
      outcome,
      duration: durationMs ? Math.round(durationMs / 1000) : null,
      attemptNumber: log.attempt_number,
      recordingUrl: recordingUrl || null,
      transcriptUrl: transcriptUrl || null,
      pipelineStage: log.pipeline_stage_at_call,
      bookedSlot: (callAnalysis?.custom_analysis_data as Record<string, string>)?.booked_slot || null,
      variablesInjected: log.variables_injected as Record<string, string>,
    });

    return NextResponse.json({ ok: true, outcome });
  }

  // 4. Look up the call in our logs to get lead info
  const supabase = createServiceClient();
  const { data: callLog } = await supabase
    .from('call_logs')
    .select('*')
    .eq('call_sid', callId)
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!callLog) {
    console.error(`Retell webhook: call log not found for ${callId} in workspace ${workspaceId}`);
    return NextResponse.json({ error: 'Call log not found' }, { status: 404 });
  }

  // 5. Map Retell outcome
  const outcome = mapRetellOutcome(callStatus, disconnectionReason, callAnalysis);

  // 6. Route the outcome
  await routeOutcome({
    callSid: callId,
    workspaceId,
    leadId: callLog.lead_id,
    leadPhone: callLog.lead_phone,
    leadName: callLog.lead_name || 'Unknown',
    leadEmail: (callLog.variables_injected as Record<string, string>)?.lead_email || null,
    firmName: (callLog.variables_injected as Record<string, string>)?.firm_name || 'Unknown',
    agentType: callLog.agent_type,
    outcome,
    duration: durationMs ? Math.round(durationMs / 1000) : null,
    attemptNumber: callLog.attempt_number,
    recordingUrl: recordingUrl || null,
    transcriptUrl: transcriptUrl || null,
    pipelineStage: callLog.pipeline_stage_at_call,
    bookedSlot: (callAnalysis?.custom_analysis_data as Record<string, string>)?.booked_slot || null,
    variablesInjected: callLog.variables_injected as Record<string, string>,
  });

  return NextResponse.json({ ok: true, outcome });
}

/**
 * Map Retell's call status and analysis to our outcome taxonomy.
 */
function mapRetellOutcome(
  callStatus: string,
  disconnectionReason: string | undefined,
  callAnalysis: Record<string, unknown> | undefined
): string {
  // Check custom analysis data first (set by the Retell agent's prompt)
  const customData = callAnalysis?.custom_analysis_data as Record<string, string> | undefined;
  const agentOutcome = customData?.outcome || customData?.call_outcome;

  if (agentOutcome) {
    // Normalize the agent-reported outcome
    const normalized = agentOutcome.toLowerCase().replace(/\s+/g, '_');
    const validOutcomes = [
      'booked', 'no_answer', 'voicemail_left', 'disqualified',
      'not_interested', 'stop_calling', 'reschedule', 'cannot_make_it',
      'confirmation_failed',
    ];
    if (validOutcomes.includes(normalized)) return normalized;
  }

  // Fall back to call status
  if (callStatus === 'error' || disconnectionReason === 'dial_no_answer') {
    return 'no_answer';
  }

  if (disconnectionReason === 'voicemail_reached') {
    return 'voicemail_left';
  }

  if (callStatus === 'ended' && !agentOutcome) {
    // Call ended without a clear outcome — default to no_answer
    return 'no_answer';
  }

  return agentOutcome || 'no_answer';
}
