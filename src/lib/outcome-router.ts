import { createServiceClient } from '@/lib/supabase/server';
import * as close from '@/lib/close';
import { addToDncList } from '@/lib/dnc';
import { postOutcome } from '@/lib/slack';
import { scheduleRetryCall } from '@/lib/qstash';
import { getNextCallingWindow } from '@/lib/calling-hours';
import type { AgentType } from '@/types/database';

interface OutcomeData {
  callSid: string;
  workspaceId: string;
  leadId: string;
  leadPhone: string;
  leadName: string;
  leadEmail: string | null;
  firmName: string;
  agentType: AgentType;
  outcome: string;
  duration: number | null;
  attemptNumber: number;
  recordingUrl: string | null;
  transcriptUrl: string | null;
  pipelineStage: string | null;
  bookedSlot: string | null;
  variablesInjected: Record<string, string> | null;
}

/**
 * Process a call outcome: log the call, update Close CRM, schedule retries, send Slack notifications.
 */
export async function routeOutcome(data: OutcomeData): Promise<void> {
  const supabase = createServiceClient();

  // 1. Write to call_logs (immutable audit trail)
  await supabase.from('call_logs').insert({
    workspace_id: data.workspaceId,
    lead_id: data.leadId,
    lead_name: data.leadName,
    lead_phone: data.leadPhone,
    call_sid: data.callSid,
    agent_type: data.agentType,
    outcome: data.outcome,
    duration_seconds: data.duration,
    attempt_number: data.attemptNumber,
    trigger_type: data.agentType === 'agent1' ? 'inbound' : data.agentType === 'agent2' ? 'retry' : 'confirmation',
    pipeline_stage_at_call: data.pipelineStage,
    recording_url: data.recordingUrl,
    transcript_url: data.transcriptUrl,
    variables_injected: data.variablesInjected,
    booked_slot: data.bookedSlot,
  });

  // 2. Get pipeline rules for this workspace to find the correct stage IDs
  const { data: rules } = await supabase
    .from('pipeline_rules')
    .select('*')
    .eq('workspace_id', data.workspaceId);

  // Helper to find a stage ID from the rules
  const findStageId = (field: string): string | null => {
    for (const rule of rules || []) {
      const value = rule[field as keyof typeof rule];
      if (value && typeof value === 'string') return value;
    }
    return null;
  };

  // 3. Route based on outcome
  switch (data.outcome) {
    case 'booked': {
      const stageId = findStageId('outcome_booked_stage_id');
      if (stageId) await close.updateLeadStatus(data.leadId, stageId, data.workspaceId);
      await close.createActivity(data.leadId, `Appointment booked via AI Setter (${data.agentType}). Slot: ${data.bookedSlot || 'unknown'}`, data.workspaceId);
      await markQueueCompleted(supabase, data);
      break;
    }

    case 'no_answer':
    case 'voicemail_left': {
      const stageId = findStageId('outcome_no_answer_stage_id');
      if (stageId) await close.updateLeadStatus(data.leadId, stageId, data.workspaceId);

      const note = data.outcome === 'voicemail_left'
        ? `Voicemail left by AI Setter (${data.agentType}), attempt ${data.attemptNumber}`
        : `No answer — AI Setter (${data.agentType}), attempt ${data.attemptNumber}`;
      await close.createActivity(data.leadId, note, data.workspaceId);

      // Schedule retry if under max attempts
      await scheduleNextRetry(supabase, data);
      break;
    }

    case 'disqualified': {
      const stageId = findStageId('outcome_disqualified_stage_id');
      if (stageId) await close.updateLeadStatus(data.leadId, stageId, data.workspaceId);
      await close.createActivity(data.leadId, `Lead disqualified during AI Setter call (${data.agentType})`, data.workspaceId);
      await markQueueCompleted(supabase, data);
      break;
    }

    case 'not_interested': {
      const stageId = findStageId('outcome_disqualified_stage_id');
      if (stageId) await close.updateLeadStatus(data.leadId, stageId, data.workspaceId);
      await close.createActivity(data.leadId, `Lead not interested — AI Setter (${data.agentType})`, data.workspaceId);
      await markQueueCompleted(supabase, data);
      break;
    }

    case 'stop_calling': {
      // Add to DNC immediately
      await addToDncList({
        phone: data.leadPhone,
        reason: 'Requested stop calling during AI Setter call',
        addedBy: 'auto_request',
        workspaceId: data.workspaceId,
      });
      await close.createActivity(data.leadId, 'DNC request — added to Do Not Call list', data.workspaceId);
      await markQueueStatus(supabase, data, 'dnc');
      break;
    }

    case 'reschedule': {
      // Agent 3 outcome: update appointment, keep in "Appointment Set"
      await close.createActivity(
        data.leadId,
        `Appointment rescheduled via confirmation call. New slot: ${data.bookedSlot || 'unknown'}`,
        data.workspaceId
      );
      await markQueueCompleted(supabase, data);
      break;
    }

    case 'cannot_make_it': {
      // Agent 3 outcome: move to "No Show" so Agent 2 picks up
      const noAnswerStageId = findStageId('outcome_no_answer_stage_id');
      if (noAnswerStageId) await close.updateLeadStatus(data.leadId, noAnswerStageId, data.workspaceId);
      await close.createActivity(data.leadId, 'Lead cannot make appointment — moved to retry queue', data.workspaceId);
      // Create a new retry queue entry for Agent 2
      await supabase.from('retry_queue').insert({
        workspace_id: data.workspaceId,
        lead_id: data.leadId,
        lead_phone: data.leadPhone,
        lead_name: data.leadName,
        lead_email: data.leadEmail,
        firm_name: data.firmName,
        agent_type: 'agent2',
        pipeline_stage: 'No Show',
        attempt_number: 1,
        next_call_at: (await getNextCallingWindow('agent2', data.workspaceId)).toISOString(),
        status: 'pending',
      });
      break;
    }

    case 'confirmation_failed': {
      // Agent 3: no answer after 2 attempts — flag for manual follow-up
      await close.createActivity(
        data.leadId,
        'Confirmation call failed — manual follow-up needed',
        data.workspaceId
      );
      await markQueueCompleted(supabase, data);
      break;
    }

    default: {
      // Unknown outcome — log it and move on
      await close.createActivity(
        data.leadId,
        `AI Setter call completed with outcome: ${data.outcome} (${data.agentType}, attempt ${data.attemptNumber})`,
        data.workspaceId
      );
      break;
    }
  }

  // 4. Send Slack notification
  await postOutcome({
    outcome: data.outcome,
    leadName: data.leadName,
    duration: data.duration,
    attempt: data.attemptNumber,
    agentType: data.agentType,
    workspaceId: data.workspaceId,
  }).catch((err) => console.error('Slack notification failed:', err));
}

/**
 * Schedule the next retry call based on the gap schedule from pipeline rules.
 */
async function scheduleNextRetry(
  supabase: ReturnType<typeof createServiceClient>,
  data: OutcomeData
): Promise<void> {
  // Find the pipeline rule for this stage
  const { data: rules } = await supabase
    .from('pipeline_rules')
    .select('*')
    .eq('workspace_id', data.workspaceId)
    .eq('is_enabled', true);

  if (!rules || rules.length === 0) {
    await markQueueCompleted(supabase, data);
    return;
  }

  // Use the first enabled rule's settings (they share the same gap schedule)
  const rule = rules[0];
  const gapSchedule: number[] = rule.gap_schedule as number[];
  const maxAttempts: number = rule.max_attempts;

  const nextAttempt = data.attemptNumber + 1;

  if (nextAttempt > maxAttempts) {
    // Max attempts exhausted
    const stageId = findStageIdFromRule(rule, 'outcome_max_attempts_stage_id');
    if (stageId) await close.updateLeadStatus(data.leadId, stageId, data.workspaceId);
    await close.createActivity(data.leadId, `Max call attempts (${maxAttempts}) exhausted — AI Setter`, data.workspaceId);
    await markQueueStatus(supabase, data, 'exhausted');
    return;
  }

  // Calculate next call time based on gap schedule
  const gapIndex = Math.min(data.attemptNumber - 1, gapSchedule.length - 1);
  const gapHours = gapSchedule[gapIndex] || 24;
  const nextCallAt = new Date(Date.now() + gapHours * 60 * 60 * 1000);

  // Schedule via QStash
  const jobId = await scheduleRetryCall(
    {
      workspaceId: data.workspaceId,
      leadId: data.leadId,
      leadPhone: data.leadPhone,
      leadName: data.leadName,
      leadEmail: data.leadEmail,
      firmName: data.firmName,
      attemptNumber: nextAttempt,
      pipelineStage: data.pipelineStage || 'No Answer',
    },
    nextCallAt
  );

  // Update or create retry queue entry
  await supabase
    .from('retry_queue')
    .upsert(
      {
        workspace_id: data.workspaceId,
        lead_id: data.leadId,
        lead_phone: data.leadPhone,
        lead_name: data.leadName,
        lead_email: data.leadEmail,
        firm_name: data.firmName,
        agent_type: 'agent2',
        pipeline_stage: data.pipelineStage || 'No Answer',
        attempt_number: nextAttempt,
        next_call_at: nextCallAt.toISOString(),
        status: 'pending',
        last_outcome: data.outcome,
        qstash_job_id: jobId,
      },
      { onConflict: 'id' }
    );
}

function findStageIdFromRule(rule: Record<string, unknown>, field: string): string | null {
  const value = rule[field];
  return typeof value === 'string' ? value : null;
}

async function markQueueCompleted(
  supabase: ReturnType<typeof createServiceClient>,
  data: OutcomeData
): Promise<void> {
  await markQueueStatus(supabase, data, 'completed');
}

async function markQueueStatus(
  supabase: ReturnType<typeof createServiceClient>,
  data: OutcomeData,
  status: 'completed' | 'exhausted' | 'dnc'
): Promise<void> {
  await supabase
    .from('retry_queue')
    .update({ status, last_outcome: data.outcome })
    .eq('workspace_id', data.workspaceId)
    .eq('lead_id', data.leadId)
    .eq('status', 'pending');
}
