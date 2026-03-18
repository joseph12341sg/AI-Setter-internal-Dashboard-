/**
 * Demo/mock data for previewing the dashboard without Supabase connected.
 */

export const DEMO_WORKSPACE = {
  id: 'demo-workspace',
  name: 'North Star Financial',
  agent_name: 'Sarah',
  timezone: 'Europe/London',
  is_active: true,
  billing_status: 'active',
  retell_agent_1_id: 'agent_instant_demo',
  retell_agent_2_id: 'agent_retry_demo',
  retell_agent_3_id: 'agent_confirm_demo',
  retell_phone_number: '+44 20 7946 0958',
  created_at: '2025-01-15T10:00:00Z',
};

export const DEMO_DIALLER = {
  workspace_id: 'demo-workspace',
  global_kill_switch: false,
  inbound_delay_seconds: 60,
  agent1_call_windows: [{ start: '12:00', end: '14:00' }, { start: '18:00', end: '20:00' }],
  agent2_call_windows: [{ start: '12:00', end: '14:00' }, { start: '18:00', end: '20:00' }],
  agent3_call_windows: [{ start: '09:00', end: '10:00' }],
  active_days: [1, 2, 3, 4, 5],
  blackout_dates: ['2026-12-25', '2026-12-26', '2027-01-01'],
  voicemail_behaviour: 'leave_message',
  max_inbound_attempts: 1,
  double_dial_enabled: true,
  slack_webhook_url: null,
  slack_channel_booked: '#bookings',
  slack_channel_no_answer: '#no-answers',
  slack_channel_alerts: '#ai-setter-alerts',
};

export const DEMO_CALLS = [
  { id: '1', lead_name: 'James Richardson', lead_phone: '+44 7700 900123', lead_id: 'lead_001', call_sid: 'call_abc123', agent_type: 'agent1', outcome: 'booked', duration_seconds: 187, attempt_number: 1, trigger_type: 'inbound', pipeline_stage_at_call: 'New Lead', recording_url: null, transcript_url: null, variables_injected: null, booked_slot: '2026-03-20T14:00:00Z', created_at: new Date(Date.now() - 1800000).toISOString() },
  { id: '2', lead_name: 'Sarah Mitchell', lead_phone: '+44 7700 900456', lead_id: 'lead_002', call_sid: 'call_def456', agent_type: 'agent1', outcome: 'no_answer', duration_seconds: null, attempt_number: 1, trigger_type: 'inbound', pipeline_stage_at_call: 'New Lead', recording_url: null, transcript_url: null, variables_injected: null, booked_slot: null, created_at: new Date(Date.now() - 3600000).toISOString() },
  { id: '3', lead_name: 'David Chen', lead_phone: '+44 7700 900789', lead_id: 'lead_003', call_sid: 'call_ghi789', agent_type: 'agent2', outcome: 'voicemail_left', duration_seconds: 32, attempt_number: 2, trigger_type: 'retry', pipeline_stage_at_call: 'No Answer', recording_url: null, transcript_url: null, variables_injected: null, booked_slot: null, created_at: new Date(Date.now() - 7200000).toISOString() },
  { id: '4', lead_name: 'Emma Thompson', lead_phone: '+44 7700 900321', lead_id: 'lead_004', call_sid: 'call_jkl012', agent_type: 'agent2', outcome: 'booked', duration_seconds: 243, attempt_number: 3, trigger_type: 'retry', pipeline_stage_at_call: 'Not Reached', recording_url: null, transcript_url: null, variables_injected: null, booked_slot: '2026-03-19T10:30:00Z', created_at: new Date(Date.now() - 10800000).toISOString() },
  { id: '5', lead_name: 'Michael O\'Brien', lead_phone: '+44 7700 900654', lead_id: 'lead_005', call_sid: 'call_mno345', agent_type: 'agent3', outcome: 'booked', duration_seconds: 95, attempt_number: 1, trigger_type: 'confirmation', pipeline_stage_at_call: 'Appointment Set', recording_url: null, transcript_url: null, variables_injected: null, booked_slot: null, created_at: new Date(Date.now() - 14400000).toISOString() },
  { id: '6', lead_name: 'Lucy Williams', lead_phone: '+44 7700 900987', lead_id: 'lead_006', call_sid: 'call_pqr678', agent_type: 'agent1', outcome: 'not_interested', duration_seconds: 67, attempt_number: 1, trigger_type: 'inbound', pipeline_stage_at_call: 'New Lead', recording_url: null, transcript_url: null, variables_injected: null, booked_slot: null, created_at: new Date(Date.now() - 18000000).toISOString() },
  { id: '7', lead_name: 'Robert Taylor', lead_phone: '+44 7700 900111', lead_id: 'lead_007', call_sid: 'call_stu901', agent_type: 'agent2', outcome: 'no_answer', duration_seconds: null, attempt_number: 4, trigger_type: 'retry', pipeline_stage_at_call: 'No Answer', recording_url: null, transcript_url: null, variables_injected: null, booked_slot: null, created_at: new Date(Date.now() - 21600000).toISOString() },
  { id: '8', lead_name: 'Olivia Brown', lead_phone: '+44 7700 900222', lead_id: 'lead_008', call_sid: 'call_vwx234', agent_type: 'agent1', outcome: 'booked', duration_seconds: 312, attempt_number: 1, trigger_type: 'inbound', pipeline_stage_at_call: 'New Lead', recording_url: null, transcript_url: null, variables_injected: null, booked_slot: '2026-03-21T16:00:00Z', created_at: new Date(Date.now() - 25200000).toISOString() },
  { id: '9', lead_name: 'Thomas Anderson', lead_phone: '+44 7700 900333', lead_id: 'lead_009', call_sid: 'call_yza567', agent_type: 'agent3', outcome: 'cannot_make_it', duration_seconds: 48, attempt_number: 1, trigger_type: 'confirmation', pipeline_stage_at_call: 'Appointment Set', recording_url: null, transcript_url: null, variables_injected: null, booked_slot: null, created_at: new Date(Date.now() - 28800000).toISOString() },
  { id: '10', lead_name: 'Sophie Clark', lead_phone: '+44 7700 900444', lead_id: 'lead_010', call_sid: 'call_bcd890', agent_type: 'agent2', outcome: 'booked', duration_seconds: 198, attempt_number: 2, trigger_type: 'retry', pipeline_stage_at_call: 'Follow Up', recording_url: null, transcript_url: null, variables_injected: null, booked_slot: '2026-03-22T11:00:00Z', created_at: new Date(Date.now() - 32400000).toISOString() },
];

export const DEMO_PIPELINE_RULES = [
  { id: '1', workspace_id: 'demo', close_stage_name: 'No Answer', close_stage_id: 'stat_no_answer', max_attempts: 5, is_enabled: true, gap_schedule: [4, 24, 48, 96], outcome_booked_stage_id: 'stat_booked', outcome_no_answer_stage_id: 'stat_no_answer', outcome_disqualified_stage_id: 'stat_disqualified', outcome_max_attempts_stage_id: 'stat_exhausted', created_at: '', updated_at: '' },
  { id: '2', workspace_id: 'demo', close_stage_name: 'Not Reached', close_stage_id: 'stat_not_reached', max_attempts: 5, is_enabled: true, gap_schedule: [4, 24, 48, 96], outcome_booked_stage_id: 'stat_booked', outcome_no_answer_stage_id: 'stat_no_answer', outcome_disqualified_stage_id: 'stat_disqualified', outcome_max_attempts_stage_id: 'stat_exhausted', created_at: '', updated_at: '' },
  { id: '3', workspace_id: 'demo', close_stage_name: 'No Show', close_stage_id: 'stat_no_show', max_attempts: 5, is_enabled: true, gap_schedule: [4, 24, 48, 96], outcome_booked_stage_id: 'stat_booked', outcome_no_answer_stage_id: 'stat_no_answer', outcome_disqualified_stage_id: 'stat_disqualified', outcome_max_attempts_stage_id: 'stat_exhausted', created_at: '', updated_at: '' },
  { id: '4', workspace_id: 'demo', close_stage_name: 'Follow Up', close_stage_id: 'stat_follow_up', max_attempts: 5, is_enabled: false, gap_schedule: [4, 24, 48, 96], outcome_booked_stage_id: 'stat_booked', outcome_no_answer_stage_id: 'stat_no_answer', outcome_disqualified_stage_id: 'stat_disqualified', outcome_max_attempts_stage_id: 'stat_exhausted', created_at: '', updated_at: '' },
];

export const DEMO_ANALYTICS = {
  totalCalls: 847,
  totalBooked: 203,
  bookRate: 24,
  answerRate: 62,
  avgDuration: 142,
  avgAttemptsPerBooking: 2.3,
  costEstimate: 32.18,
  byAgent: { agent1: 412, agent2: 347, agent3: 88 },
  byOutcome: {
    booked: 203,
    no_answer: 287,
    voicemail_left: 156,
    not_interested: 89,
    disqualified: 42,
    stop_calling: 12,
    cannot_make_it: 28,
    confirmation_failed: 30,
  },
  dailyBookRate: Array.from({ length: 30 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - 29 + i);
    const total = Math.floor(Math.random() * 30) + 10;
    const booked = Math.floor(total * (0.15 + Math.random() * 0.2));
    return {
      date: date.toISOString().split('T')[0],
      rate: Math.round((booked / total) * 100),
      total,
      booked,
    };
  }),
  hourlyAnswerRate: Array.from({ length: 24 }, (_, hour) => {
    const isCallHour = (hour >= 9 && hour < 10) || (hour >= 12 && hour < 14) || (hour >= 18 && hour < 20);
    return {
      hour,
      rate: isCallHour ? 40 + Math.floor(Math.random() * 40) : 0,
      total: isCallHour ? 20 + Math.floor(Math.random() * 50) : 0,
    };
  }),
};

/**
 * Safe fetch wrapper that returns demo data on failure.
 */
export async function safeFetch<T>(url: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(url);
    if (!res.ok) return fallback;
    return await res.json();
  } catch {
    return fallback;
  }
}
