import { NextRequest, NextResponse } from 'next/server';
import { verifyCloseWebhook } from '@/lib/webhook-verify';
import { isOnDncList } from '@/lib/dnc';
import { isWithinCallingHours, getNextCallingWindow } from '@/lib/calling-hours';
import { scheduleInboundCall } from '@/lib/qstash';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * POST /api/webhooks/close
 *
 * Receives Close CRM webhook on lead.created event.
 * Validates the webhook, checks preconditions, and schedules the Agent 1 call via QStash.
 */
export async function POST(request: NextRequest) {
  const body = await request.text();

  // 1. Verify webhook signature
  const signature = request.headers.get('close-sig') || request.headers.get('x-close-signature');
  if (!verifyCloseWebhook(body, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // 2. Only handle lead.created events
  const event = payload.event as string;
  if (event !== 'lead.created') {
    return NextResponse.json({ ok: true, skipped: 'Not a lead.created event' });
  }

  const leadData = payload.data as Record<string, unknown> | undefined;
  if (!leadData?.id) {
    return NextResponse.json({ error: 'Missing lead data' }, { status: 400 });
  }

  // 3. Find the workspace that owns this Close API key
  //    We match by checking which workspace received this webhook.
  //    For now, use the first active workspace (single-tenant to start).
  //    In multi-tenant: match by Close org ID or webhook URL token.
  const supabase = createServiceClient();
  const { data: workspaces } = await supabase
    .from('workspaces')
    .select('id, is_active, retell_agent_1_id, retell_phone_number')
    .eq('is_active', true)
    .limit(1);

  if (!workspaces || workspaces.length === 0) {
    return NextResponse.json({ error: 'No active workspace' }, { status: 404 });
  }

  const workspace = workspaces[0];
  const workspaceId = workspace.id;

  // 4. Check kill switch and workspace operational status
  const { data: settings } = await supabase
    .from('dialler_settings')
    .select('global_kill_switch, inbound_delay_seconds')
    .eq('workspace_id', workspaceId)
    .single();

  if (settings?.global_kill_switch) {
    return NextResponse.json({ ok: true, skipped: 'Kill switch is ON' });
  }

  // 5. Extract lead contact info
  const contacts = leadData.contacts as Array<Record<string, unknown>> | undefined;
  const contact = contacts?.[0];
  const phones = contact?.phones as Array<Record<string, string>> | undefined;
  const phone = phones?.[0]?.phone;

  if (!phone) {
    return NextResponse.json({ ok: true, skipped: 'No phone number on lead' });
  }

  // 6. Check DNC list
  if (await isOnDncList(phone, workspaceId)) {
    return NextResponse.json({ ok: true, skipped: 'Phone on DNC list' });
  }

  // 7. Determine delay — either fire at next calling window or use configured delay
  const emails = contact?.emails as Array<Record<string, string>> | undefined;
  const leadPayload = {
    workspaceId,
    leadId: leadData.id as string,
    leadPhone: phone,
    leadName: (contact?.name as string) || (leadData.display_name as string) || 'Unknown',
    leadEmail: emails?.[0]?.email || null,
    firmName: (leadData.display_name as string) || 'Unknown',
  };

  const withinHours = await isWithinCallingHours('agent1', workspaceId);
  let delaySec = settings?.inbound_delay_seconds || 60;

  if (!withinHours) {
    // Queue for next valid calling window
    const nextWindow = await getNextCallingWindow('agent1', workspaceId);
    delaySec = Math.max(1, Math.floor((nextWindow.getTime() - Date.now()) / 1000));
  }

  // 8. Schedule the call via QStash
  const messageId = await scheduleInboundCall(leadPayload, delaySec);

  // 9. Create retry_queue entry
  await supabase.from('retry_queue').insert({
    workspace_id: workspaceId,
    lead_id: leadPayload.leadId,
    lead_phone: phone,
    lead_name: leadPayload.leadName,
    lead_email: leadPayload.leadEmail,
    firm_name: leadPayload.firmName,
    agent_type: 'agent1',
    pipeline_stage: 'New Lead',
    attempt_number: 1,
    next_call_at: new Date(Date.now() + delaySec * 1000).toISOString(),
    status: 'pending',
    qstash_job_id: messageId,
  });

  return NextResponse.json({ ok: true, messageId, delaySec });
}
