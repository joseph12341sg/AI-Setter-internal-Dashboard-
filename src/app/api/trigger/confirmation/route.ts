import { NextRequest, NextResponse } from 'next/server';
import { verifyQStashWebhook } from '@/lib/webhook-verify';
import { isWorkspaceOperational, getWorkspaceById } from '@/lib/workspace';
import { isOnDncList } from '@/lib/dnc';
import { isWithinCallingHours } from '@/lib/calling-hours';
import { createCall } from '@/lib/retell';
import * as close from '@/lib/close';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * POST /api/trigger/confirmation
 *
 * Called by QStash cron at 9am daily.
 * Queries Close CRM for leads with appointments booked today,
 * then initiates Agent 3 confirmation calls.
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

  for (const ws of workspaces) {
    const workspaceId = ws.id;

    // 3. Check operational
    const { operational } = await isWorkspaceOperational(workspaceId);
    if (!operational) continue;

    // 4. Check calling hours for Agent 3 (09:00-10:00)
    const withinHours = await isWithinCallingHours('agent3', workspaceId);
    if (!withinHours) continue;

    // 5. Get workspace config
    const workspace = await getWorkspaceById(workspaceId);
    if (!workspace?.retell_agent_3_id || !workspace?.retell_phone_number) continue;
    if (!workspace.close_api_key) continue;

    // 6. Get today's appointments from Close CRM
    let appointmentLeads: Awaited<ReturnType<typeof close.getTodaysAppointments>>;
    try {
      appointmentLeads = await close.getTodaysAppointments(workspaceId);
    } catch (err) {
      console.error(`Failed to fetch today's appointments for workspace ${workspaceId}:`, err);
      continue;
    }

    if (appointmentLeads.length === 0) continue;

    for (const lead of appointmentLeads) {
      const contactInfo = close.extractContactInfo(lead);
      if (!contactInfo.phone) continue;

      // 7. Check DNC
      if (await isOnDncList(contactInfo.phone, workspaceId)) continue;

      // 8. Check if already called today for confirmation
      const today = new Date().toISOString().split('T')[0];
      const { data: existingCalls } = await supabase
        .from('call_logs')
        .select('id')
        .eq('workspace_id', workspaceId)
        .eq('lead_id', lead.id)
        .eq('agent_type', 'agent3')
        .gte('created_at', `${today}T00:00:00Z`)
        .limit(1);

      if (existingCalls && existingCalls.length > 0) continue;

      // 9. Build variables
      const variables: Record<string, string> = {
        lead_name: contactInfo.name,
        appointment_time: (lead.custom?.appointment_time as string) || 'your appointment today',
        firm_name: contactInfo.firmName,
      };
      if (workspace.agent_name) variables.agent_name = workspace.agent_name;

      // 10. Create retry queue entry for tracking (max 2 attempts)
      await supabase.from('retry_queue').insert({
        workspace_id: workspaceId,
        lead_id: lead.id,
        lead_phone: contactInfo.phone,
        lead_name: contactInfo.name,
        lead_email: contactInfo.email,
        firm_name: contactInfo.firmName,
        agent_type: 'agent3',
        pipeline_stage: 'Appointment Set',
        attempt_number: 1,
        status: 'in_progress',
      });

      try {
        const callResponse = await createCall({
          agentId: workspace.retell_agent_3_id,
          toNumber: contactInfo.phone,
          fromNumber: workspace.retell_phone_number,
          variables,
          workspaceId,
        });

        await supabase.from('call_logs').insert({
          workspace_id: workspaceId,
          lead_id: lead.id,
          lead_name: contactInfo.name,
          lead_phone: contactInfo.phone,
          call_sid: callResponse.call_id,
          agent_type: 'agent3',
          attempt_number: 1,
          trigger_type: 'confirmation',
          pipeline_stage_at_call: 'Appointment Set',
          variables_injected: variables,
        });

        totalProcessed++;
      } catch (err) {
        console.error(`Confirmation call failed for lead ${lead.id}:`, err);

        // Mark for manual follow-up after 2 failed attempts
        await close.createActivity(
          lead.id,
          'Confirmation call failed — manual follow-up needed',
          workspaceId
        );

        await supabase
          .from('retry_queue')
          .update({ status: 'completed', last_outcome: 'confirmation_failed' })
          .eq('workspace_id', workspaceId)
          .eq('lead_id', lead.id)
          .eq('agent_type', 'agent3');
      }

      // Small delay between calls
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  return NextResponse.json({ ok: true, processed: totalProcessed });
}
