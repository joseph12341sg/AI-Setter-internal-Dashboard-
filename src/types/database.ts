// TypeScript types mirroring the Supabase schema

export type AgentType = 'agent1' | 'agent2' | 'agent3';
export type RetryStatus = 'pending' | 'in_progress' | 'completed' | 'exhausted' | 'dnc';
export type TriggerType = 'inbound' | 'retry' | 'confirmation';
export type DncSource = 'manual' | 'auto_request' | 'csv_import';
export type BillingStatus = 'active' | 'trialing' | 'past_due' | 'cancelled';
export type VoicemailBehaviour = 'hang_up' | 'leave_message' | 'leave_on_final_only';

export interface CallWindow {
  start: string; // "HH:MM" format
  end: string;
}

export interface Workspace {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
  billing_status: BillingStatus;
  retell_api_key: string | null;
  retell_agent_1_id: string | null;
  retell_agent_2_id: string | null;
  retell_agent_3_id: string | null;
  retell_phone_number: string | null;
  close_api_key: string | null;
  agent_name: string | null;
  timezone: string;
  is_active: boolean;
}

export interface DiallerSettings {
  workspace_id: string;
  global_kill_switch: boolean;
  inbound_delay_seconds: number;
  agent1_call_windows: CallWindow[];
  agent2_call_windows: CallWindow[];
  agent3_call_windows: CallWindow[];
  active_days: number[];
  blackout_dates: string[];
  voicemail_behaviour: VoicemailBehaviour;
  max_inbound_attempts: number;
  double_dial_enabled: boolean;
  slack_webhook_url: string | null;
  slack_channel_booked: string | null;
  slack_channel_no_answer: string | null;
  slack_channel_alerts: string | null;
  created_at: string;
  updated_at: string;
}

export interface PipelineRule {
  id: string;
  workspace_id: string;
  close_stage_name: string;
  close_stage_id: string;
  max_attempts: number;
  is_enabled: boolean;
  gap_schedule: number[];
  outcome_booked_stage_id: string | null;
  outcome_no_answer_stage_id: string | null;
  outcome_disqualified_stage_id: string | null;
  outcome_max_attempts_stage_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface RetryQueueEntry {
  id: string;
  workspace_id: string;
  lead_id: string;
  lead_phone: string;
  lead_name: string | null;
  lead_email: string | null;
  firm_name: string | null;
  agent_type: AgentType;
  pipeline_stage: string | null;
  attempt_number: number;
  next_call_at: string | null;
  status: RetryStatus;
  last_outcome: string | null;
  qstash_job_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CallLog {
  id: string;
  workspace_id: string;
  lead_id: string;
  lead_name: string | null;
  lead_phone: string;
  call_sid: string | null;
  agent_type: AgentType;
  outcome: string | null;
  duration_seconds: number | null;
  attempt_number: number;
  trigger_type: TriggerType;
  pipeline_stage_at_call: string | null;
  recording_url: string | null;
  transcript_url: string | null;
  variables_injected: Record<string, string> | null;
  booked_slot: string | null;
  created_at: string;
}

export interface DncEntry {
  id: string;
  workspace_id: string;
  phone_number: string;
  reason: string | null;
  added_by: DncSource;
  created_at: string;
}
