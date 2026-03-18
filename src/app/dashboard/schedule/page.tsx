'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { safeFetch, DEMO_DIALLER, DEMO_WORKSPACE } from '@/lib/demo-data';
import type { CallWindow } from '@/types/database';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DELAY_OPTIONS = [
  { value: 15, label: '15 seconds' },
  { value: 30, label: '30 seconds' },
  { value: 60, label: '1 minute' },
  { value: 120, label: '2 minutes' },
  { value: 300, label: '5 minutes' },
];

interface DiallerData {
  inbound_delay_seconds: number;
  agent1_call_windows: CallWindow[];
  agent2_call_windows: CallWindow[];
  agent3_call_windows: CallWindow[];
  active_days: number[];
  blackout_dates: string[];
}

export default function SchedulePage() {
  const [data, setData] = useState<DiallerData | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [timezone, setTimezone] = useState('Europe/London');

  const loadData = useCallback(async () => {
    const [dialler, ws] = await Promise.all([
      safeFetch('/api/settings/dialler', DEMO_DIALLER),
      safeFetch('/api/settings/workspace', DEMO_WORKSPACE),
    ]);
    setData(dialler);
    setTimezone(ws.timezone || 'Europe/London');
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  async function save() {
    if (!data) return;
    setSaving(true);
    await fetch('/api/settings/dialler', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    await fetch('/api/settings/workspace', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timezone }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function updateWindow(agent: 'agent1_call_windows' | 'agent2_call_windows' | 'agent3_call_windows', index: number, field: 'start' | 'end', value: string) {
    if (!data) return;
    const windows = [...data[agent]];
    windows[index] = { ...windows[index], [field]: value };
    setData({ ...data, [agent]: windows });
  }

  function addWindow(agent: 'agent1_call_windows' | 'agent2_call_windows' | 'agent3_call_windows') {
    if (!data) return;
    setData({ ...data, [agent]: [...data[agent], { start: '09:00', end: '10:00' }] });
  }

  function removeWindow(agent: 'agent1_call_windows' | 'agent2_call_windows' | 'agent3_call_windows', index: number) {
    if (!data) return;
    const windows = data[agent].filter((_, i) => i !== index);
    setData({ ...data, [agent]: windows });
  }

  function toggleDay(day: number) {
    if (!data) return;
    const days = data.active_days.includes(day)
      ? data.active_days.filter(d => d !== day)
      : [...data.active_days, day].sort();
    setData({ ...data, active_days: days });
  }

  if (!data) return <div className="text-muted">Loading...</div>;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-text">Calling Schedule</h1>
          <p className="text-sm text-muted mt-1">Configure when AI agents are allowed to make calls</p>
        </div>
        <div className="flex items-center gap-3">
          {saved && <span className="text-sm text-success">Saved</span>}
          <Button onClick={save} loading={saving}>Save Changes</Button>
        </div>
      </div>

      {/* Timezone */}
      <Card>
        <h2 className="text-sm font-medium text-muted uppercase tracking-wider mb-4">Timezone</h2>
        <select
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          className="px-3 py-2 bg-background border border-border rounded-lg text-text text-sm"
        >
          <option value="Europe/London">Europe/London (GMT/BST)</option>
          <option value="Europe/Dublin">Europe/Dublin</option>
          <option value="Europe/Paris">Europe/Paris (CET)</option>
          <option value="Europe/Berlin">Europe/Berlin (CET)</option>
          <option value="America/New_York">America/New York (EST)</option>
          <option value="America/Chicago">America/Chicago (CST)</option>
          <option value="America/Los_Angeles">America/Los Angeles (PST)</option>
        </select>
      </Card>

      {/* Calling Windows */}
      {([
        { key: 'agent1_call_windows' as const, label: 'Agent 1 — Instant Trigger' },
        { key: 'agent2_call_windows' as const, label: 'Agent 2 — Pipeline Retry' },
        { key: 'agent3_call_windows' as const, label: 'Agent 3 — Morning Confirmation' },
      ]).map(({ key, label }) => (
        <Card key={key}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-text">{label}</h2>
            <Button variant="ghost" size="sm" onClick={() => addWindow(key)}>+ Add Window</Button>
          </div>
          <div className="space-y-3">
            {data[key].map((window, i) => (
              <div key={i} className="flex items-center gap-3">
                <input
                  type="time"
                  value={window.start}
                  onChange={(e) => updateWindow(key, i, 'start', e.target.value)}
                  className="px-3 py-2 bg-background border border-border rounded-lg text-text text-sm"
                />
                <span className="text-muted">to</span>
                <input
                  type="time"
                  value={window.end}
                  onChange={(e) => updateWindow(key, i, 'end', e.target.value)}
                  className="px-3 py-2 bg-background border border-border rounded-lg text-text text-sm"
                />
                {data[key].length > 1 && (
                  <button onClick={() => removeWindow(key, i)} className="text-muted hover:text-danger text-sm">
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
        </Card>
      ))}

      {/* Active Days */}
      <Card>
        <h2 className="text-sm font-medium text-muted uppercase tracking-wider mb-4">Active Days</h2>
        <div className="flex gap-2">
          {DAYS.map((day, i) => (
            <button
              key={day}
              onClick={() => toggleDay(i)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                data.active_days.includes(i)
                  ? 'bg-accent text-white'
                  : 'bg-background border border-border text-muted hover:text-text'
              }`}
            >
              {day}
            </button>
          ))}
        </div>
      </Card>

      {/* Inbound Delay */}
      <Card>
        <h2 className="text-sm font-medium text-muted uppercase tracking-wider mb-4">Inbound Delay</h2>
        <p className="text-sm text-muted mb-3">How long to wait after a new lead enters Close before Agent 1 calls</p>
        <div className="flex gap-2">
          {DELAY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setData({ ...data, inbound_delay_seconds: opt.value })}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                data.inbound_delay_seconds === opt.value
                  ? 'bg-accent text-white'
                  : 'bg-background border border-border text-muted hover:text-text'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </Card>

      {/* Blackout Dates */}
      <Card>
        <h2 className="text-sm font-medium text-muted uppercase tracking-wider mb-4">Blackout Dates</h2>
        <p className="text-sm text-muted mb-3">No calls will be made on these dates</p>
        <div className="flex flex-wrap gap-2 mb-3">
          {data.blackout_dates.map((date, i) => (
            <span key={date} className="flex items-center gap-2 px-3 py-1 bg-background border border-border rounded-lg text-sm text-text">
              {date}
              <button
                onClick={() => setData({ ...data, blackout_dates: data.blackout_dates.filter((_, j) => j !== i) })}
                className="text-muted hover:text-danger"
              >
                x
              </button>
            </span>
          ))}
        </div>
        <input
          type="date"
          onChange={(e) => {
            if (e.target.value && !data.blackout_dates.includes(e.target.value)) {
              setData({ ...data, blackout_dates: [...data.blackout_dates, e.target.value].sort() });
            }
          }}
          className="px-3 py-2 bg-background border border-border rounded-lg text-text text-sm"
        />
      </Card>
    </div>
  );
}
