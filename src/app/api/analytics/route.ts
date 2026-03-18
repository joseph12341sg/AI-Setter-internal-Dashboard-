import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(c) { c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id')
    .eq('owner_id', user.id)
    .single();

  if (!workspace) return NextResponse.json({ error: 'No workspace' }, { status: 404 });

  const { searchParams } = new URL(request.url);
  const dateFrom = searchParams.get('date_from') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const dateTo = searchParams.get('date_to') || new Date().toISOString();

  // Fetch all call logs for the period
  const { data: calls } = await supabase
    .from('call_logs')
    .select('outcome, duration_seconds, agent_type, attempt_number, created_at')
    .eq('workspace_id', workspace.id)
    .gte('created_at', dateFrom)
    .lte('created_at', dateTo);

  const allCalls = calls || [];

  const totalCalls = allCalls.length;
  const totalBooked = allCalls.filter(c => c.outcome === 'booked').length;
  const answered = allCalls.filter(c => c.outcome && c.outcome !== 'no_answer').length;
  const durations = allCalls.filter(c => c.duration_seconds).map(c => c.duration_seconds!);
  const avgDuration = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;
  const bookRate = totalCalls > 0 ? Math.round((totalBooked / totalCalls) * 100) : 0;
  const answerRate = totalCalls > 0 ? Math.round((answered / totalCalls) * 100) : 0;

  // Average attempts per booking
  const bookedCalls = allCalls.filter(c => c.outcome === 'booked');
  const avgAttemptsPerBooking = bookedCalls.length > 0
    ? Math.round((bookedCalls.reduce((a, c) => a + c.attempt_number, 0) / bookedCalls.length) * 10) / 10
    : 0;

  // Cost estimate: calls * $0.016/min * avg duration in minutes
  const totalMinutes = durations.reduce((a, b) => a + b, 0) / 60;
  const costEstimate = Math.round(totalMinutes * 0.016 * 100) / 100;

  // Calls by agent
  const byAgent = {
    agent1: allCalls.filter(c => c.agent_type === 'agent1').length,
    agent2: allCalls.filter(c => c.agent_type === 'agent2').length,
    agent3: allCalls.filter(c => c.agent_type === 'agent3').length,
  };

  // Calls by outcome
  const byOutcome: Record<string, number> = {};
  for (const call of allCalls) {
    const key = call.outcome || 'unknown';
    byOutcome[key] = (byOutcome[key] || 0) + 1;
  }

  // Daily book rate (for chart)
  const dailyStats: Record<string, { total: number; booked: number }> = {};
  for (const call of allCalls) {
    const day = call.created_at.split('T')[0];
    if (!dailyStats[day]) dailyStats[day] = { total: 0, booked: 0 };
    dailyStats[day].total++;
    if (call.outcome === 'booked') dailyStats[day].booked++;
  }

  const dailyBookRate = Object.entries(dailyStats)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, stats]) => ({
      date,
      rate: stats.total > 0 ? Math.round((stats.booked / stats.total) * 100) : 0,
      total: stats.total,
      booked: stats.booked,
    }));

  // Hourly answer rate (for heatmap)
  const hourlyStats: Record<number, { total: number; answered: number }> = {};
  for (const call of allCalls) {
    const hour = new Date(call.created_at).getHours();
    if (!hourlyStats[hour]) hourlyStats[hour] = { total: 0, answered: 0 };
    hourlyStats[hour].total++;
    if (call.outcome && call.outcome !== 'no_answer') hourlyStats[hour].answered++;
  }

  const hourlyAnswerRate = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    rate: hourlyStats[hour]
      ? Math.round((hourlyStats[hour].answered / hourlyStats[hour].total) * 100)
      : 0,
    total: hourlyStats[hour]?.total || 0,
  }));

  return NextResponse.json({
    totalCalls,
    totalBooked,
    bookRate,
    answerRate,
    avgDuration,
    avgAttemptsPerBooking,
    costEstimate,
    byAgent,
    byOutcome,
    dailyBookRate,
    hourlyAnswerRate,
  });
}
