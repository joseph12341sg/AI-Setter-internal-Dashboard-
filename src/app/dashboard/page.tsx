'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { safeFetch, DEMO_WORKSPACE, DEMO_DIALLER, DEMO_CALLS } from '@/lib/demo-data';

interface DashboardData {
  workspace: {
    name: string;
    is_active: boolean;
    retell_agent_1_id: string | null;
    retell_agent_2_id: string | null;
    retell_agent_3_id: string | null;
  } | null;
  settings: {
    global_kill_switch: boolean;
  } | null;
  stats: {
    callsToday: number;
    bookRate: number;
    answerRate: number;
    avgDuration: number;
  };
  recentCalls: Array<{
    id: string;
    lead_name: string;
    agent_type: string;
    outcome: string;
    duration_seconds: number | null;
    created_at: string;
  }>;
}

export default function DashboardOverview() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [killSwitch, setKillSwitch] = useState(false);
  const [toggling, setToggling] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [workspace, settings, callsData] = await Promise.all([
        safeFetch('/api/settings/workspace', DEMO_WORKSPACE),
        safeFetch('/api/settings/dialler', DEMO_DIALLER),
        safeFetch('/api/calls?limit=10', { data: DEMO_CALLS }),
      ]);

      const recentCalls = callsData.data || [];
      const today = new Date().toISOString().split('T')[0];
      const todayCalls = recentCalls.filter((c: { created_at: string }) => c.created_at?.startsWith(today));
      const booked = todayCalls.filter((c: { outcome: string }) => c.outcome === 'booked').length;
      const answered = todayCalls.filter((c: { outcome: string }) => c.outcome && c.outcome !== 'no_answer').length;
      const durations = todayCalls.filter((c: { duration_seconds: number | null }) => c.duration_seconds != null).map((c: { duration_seconds: number | null }) => c.duration_seconds as number);

      setData({
        workspace,
        settings,
        stats: {
          callsToday: todayCalls.length,
          bookRate: todayCalls.length > 0 ? Math.round((booked / todayCalls.length) * 100) : 0,
          answerRate: todayCalls.length > 0 ? Math.round((answered / todayCalls.length) * 100) : 0,
          avgDuration: durations.length > 0 ? Math.round(durations.reduce((a: number, b: number) => a + b, 0) / durations.length) : 0,
        },
        recentCalls,
      });
      setKillSwitch(settings?.global_kill_switch || false);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  async function toggleKillSwitch() {
    setToggling(true);
    const newState = !killSwitch;
    try {
      await fetch('/api/settings/kill-switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: newState }),
      });
      setKillSwitch(newState);
    } catch (err) {
      console.error('Failed to toggle kill switch:', err);
    }
    setToggling(false);
  }

  const agentLabel = (type: string) => {
    switch (type) {
      case 'agent1': return 'Instant';
      case 'agent2': return 'Retry';
      case 'agent3': return 'Confirm';
      default: return type;
    }
  };

  const outcomeColor = (outcome: string) => {
    switch (outcome) {
      case 'booked': return 'text-success bg-success/10';
      case 'no_answer': return 'text-warning bg-warning/10';
      case 'voicemail_left': return 'text-muted bg-card-hover';
      case 'disqualified': case 'not_interested': return 'text-danger bg-danger/10';
      default: return 'text-muted bg-card-hover';
    }
  };

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-text">Dashboard</h1>
          <p className="text-sm text-muted mt-1">{data.workspace?.name || 'Your Workspace'}</p>
        </div>

        {/* Kill Switch */}
        <button
          onClick={toggleKillSwitch}
          disabled={toggling}
          className={`relative flex items-center gap-3 px-6 py-3 rounded-xl font-medium text-sm transition-all ${
            killSwitch
              ? 'bg-danger/20 border-2 border-danger text-danger'
              : 'bg-success/20 border-2 border-success text-success'
          }`}
        >
          <div className={`w-3 h-3 rounded-full ${killSwitch ? 'bg-danger animate-pulse' : 'bg-success'}`} />
          {killSwitch ? 'CALLS STOPPED' : 'SYSTEM ACTIVE'}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Calls Today', value: data.stats.callsToday, suffix: '' },
          { label: 'Book Rate', value: data.stats.bookRate, suffix: '%' },
          { label: 'Answer Rate', value: data.stats.answerRate, suffix: '%' },
          { label: 'Avg Duration', value: data.stats.avgDuration, suffix: 's' },
        ].map((stat) => (
          <Card key={stat.label} padding="md">
            <p className="text-xs text-muted uppercase tracking-wider">{stat.label}</p>
            <p className="text-2xl font-heading font-bold text-text mt-1">
              {stat.value}{stat.suffix}
            </p>
          </Card>
        ))}
      </div>

      {/* Agent Status + System Health */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <h2 className="text-sm font-medium text-muted uppercase tracking-wider mb-4">Agent Status</h2>
          <div className="space-y-3">
            {[
              { id: 'agent1', label: 'Agent 1 — Instant Trigger', configured: !!data.workspace?.retell_agent_1_id },
              { id: 'agent2', label: 'Agent 2 — Pipeline Retry', configured: !!data.workspace?.retell_agent_2_id },
              { id: 'agent3', label: 'Agent 3 — Morning Confirmation', configured: !!data.workspace?.retell_agent_3_id },
            ].map((agent) => (
              <div key={agent.id} className="flex items-center justify-between py-2">
                <span className="text-sm text-text">{agent.label}</span>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  agent.configured && !killSwitch
                    ? 'bg-success/10 text-success'
                    : 'bg-card-hover text-muted'
                }`}>
                  {!agent.configured ? 'Not configured' : killSwitch ? 'Paused' : 'Active'}
                </span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="text-sm font-medium text-muted uppercase tracking-wider mb-4">System Health</h2>
          <div className="space-y-3">
            {[
              { label: 'Close CRM', status: 'connected' },
              { label: 'Retell AI', status: data.workspace?.retell_agent_1_id ? 'connected' : 'not configured' },
              { label: 'QStash Scheduler', status: 'active' },
              { label: 'Kill Switch', status: killSwitch ? 'engaged' : 'disengaged' },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between py-2">
                <span className="text-sm text-text">{item.label}</span>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${
                    item.status === 'connected' || item.status === 'active' || item.status === 'disengaged'
                      ? 'bg-success' : item.status === 'engaged' ? 'bg-danger' : 'bg-warning'
                  }`} />
                  <span className="text-xs text-muted capitalize">{item.status}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Recent Calls */}
      <Card>
        <h2 className="text-sm font-medium text-muted uppercase tracking-wider mb-4">Recent Calls</h2>
        {data.recentCalls.length === 0 ? (
          <p className="text-sm text-muted py-4 text-center">No calls yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-2 text-muted font-medium">Lead</th>
                  <th className="pb-2 text-muted font-medium">Agent</th>
                  <th className="pb-2 text-muted font-medium">Outcome</th>
                  <th className="pb-2 text-muted font-medium">Duration</th>
                  <th className="pb-2 text-muted font-medium">Time</th>
                </tr>
              </thead>
              <tbody>
                {data.recentCalls.map((call) => (
                  <tr key={call.id} className="border-b border-border/50 last:border-0">
                    <td className="py-3 text-text">{call.lead_name || 'Unknown'}</td>
                    <td className="py-3">
                      <span className="text-xs px-2 py-0.5 rounded bg-accent/10 text-accent">
                        {agentLabel(call.agent_type)}
                      </span>
                    </td>
                    <td className="py-3">
                      <span className={`text-xs px-2 py-0.5 rounded ${outcomeColor(call.outcome)}`}>
                        {(call.outcome || 'pending').replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-3 text-muted">
                      {call.duration_seconds ? `${Math.floor(call.duration_seconds / 60)}m ${call.duration_seconds % 60}s` : '—'}
                    </td>
                    <td className="py-3 text-muted">
                      {new Date(call.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
