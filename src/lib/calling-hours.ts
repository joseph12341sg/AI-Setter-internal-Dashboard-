import type { AgentType, CallWindow } from '@/types/database';
import { getDiallerSettings } from '@/lib/workspace';

/**
 * Get the current time in a given timezone.
 */
function nowInTimezone(timezone: string): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: timezone }));
}

/**
 * Parse "HH:MM" to { hours, minutes }.
 */
function parseTime(time: string): { hours: number; minutes: number } {
  const [hours, minutes] = time.split(':').map(Number);
  return { hours, minutes };
}

/**
 * Convert a Date to minutes since midnight.
 */
function toMinutesSinceMidnight(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

/**
 * Check if the current time falls within any of the given call windows.
 */
function isWithinWindows(windows: CallWindow[], now: Date): boolean {
  const currentMinutes = toMinutesSinceMidnight(now);

  return windows.some((window) => {
    const start = parseTime(window.start);
    const end = parseTime(window.end);
    const startMinutes = start.hours * 60 + start.minutes;
    const endMinutes = end.hours * 60 + end.minutes;
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  });
}

/**
 * Check if today is an active day and not a blackout date.
 */
function isDayActive(
  now: Date,
  activeDays: number[],
  blackoutDates: string[]
): boolean {
  const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ...
  if (!activeDays.includes(dayOfWeek)) return false;

  // Check blackout dates (format: YYYY-MM-DD)
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  if (blackoutDates.includes(dateStr)) return false;

  return true;
}

/**
 * Get the call windows for a specific agent type from dialler settings.
 */
function getWindowsForAgent(
  agentType: AgentType,
  settings: { agent1_call_windows: CallWindow[]; agent2_call_windows: CallWindow[]; agent3_call_windows: CallWindow[] }
): CallWindow[] {
  switch (agentType) {
    case 'agent1':
      return settings.agent1_call_windows;
    case 'agent2':
      return settings.agent2_call_windows;
    case 'agent3':
      return settings.agent3_call_windows;
  }
}

/**
 * Check if calls can be made right now for a given agent type and workspace.
 */
export async function isWithinCallingHours(
  agentType: AgentType,
  workspaceId: string
): Promise<boolean> {
  const settings = await getDiallerSettings(workspaceId);
  if (!settings) return false;

  // We need the workspace timezone — default to Europe/London
  const { createServiceClient } = await import('@/lib/supabase/server');
  const supabase = createServiceClient();
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('timezone')
    .eq('id', workspaceId)
    .single();

  const timezone = workspace?.timezone || 'Europe/London';
  const now = nowInTimezone(timezone);

  if (!isDayActive(now, settings.active_days, settings.blackout_dates)) return false;

  const windows = getWindowsForAgent(agentType, settings);
  return isWithinWindows(windows, now);
}

/**
 * Get the next valid calling window start time for a given agent type.
 * Returns a Date in UTC.
 */
export async function getNextCallingWindow(
  agentType: AgentType,
  workspaceId: string
): Promise<Date> {
  const settings = await getDiallerSettings(workspaceId);
  if (!settings) throw new Error('No dialler settings found');

  const { createServiceClient } = await import('@/lib/supabase/server');
  const supabase = createServiceClient();
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('timezone')
    .eq('id', workspaceId)
    .single();

  const timezone = workspace?.timezone || 'Europe/London';
  const windows = getWindowsForAgent(agentType, settings);
  const activeDays = settings.active_days;
  const blackoutDates = settings.blackout_dates;

  // Search up to 14 days ahead
  const now = nowInTimezone(timezone);
  for (let dayOffset = 0; dayOffset < 14; dayOffset++) {
    const candidateDate = new Date(now);
    candidateDate.setDate(candidateDate.getDate() + dayOffset);

    if (!isDayActive(candidateDate, activeDays, blackoutDates)) continue;

    for (const window of windows) {
      const start = parseTime(window.start);
      const candidateStart = new Date(candidateDate);
      candidateStart.setHours(start.hours, start.minutes, 0, 0);

      // If it's today, the window must be in the future
      if (dayOffset === 0 && candidateStart <= now) continue;

      // Convert the local timezone time to UTC for scheduling
      // Create a date string in the target timezone, then parse it as UTC
      const tzDateStr = candidateStart.toLocaleString('en-US', { timeZone: timezone });
      const localDate = new Date(tzDateStr);
      const utcOffset = localDate.getTime() - candidateStart.getTime();
      const utcDate = new Date(candidateStart.getTime() - utcOffset);

      return utcDate;
    }
  }

  // Fallback: should never reach here with Mon-Sun active
  throw new Error('No valid calling window found in the next 14 days');
}
