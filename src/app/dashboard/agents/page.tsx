'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface WorkspaceData {
  name: string;
  agent_name: string | null;
  retell_agent_1_id: string | null;
  retell_agent_2_id: string | null;
  retell_agent_3_id: string | null;
  retell_phone_number: string | null;
}

interface DiallerData {
  double_dial_enabled: boolean;
  voicemail_behaviour: string;
}

export default function AgentsPage() {
  const [workspace, setWorkspace] = useState<WorkspaceData | null>(null);
  const [dialler, setDialler] = useState<DiallerData | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const loadData = useCallback(async () => {
    const [wsRes, diallerRes] = await Promise.all([
      fetch('/api/settings/workspace'),
      fetch('/api/settings/dialler'),
    ]);
    setWorkspace(await wsRes.json());
    setDialler(await diallerRes.json());
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  async function save() {
    if (!workspace || !dialler) return;
    setSaving(true);
    await Promise.all([
      fetch('/api/settings/workspace', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_name: workspace.agent_name,
          retell_agent_1_id: workspace.retell_agent_1_id,
          retell_agent_2_id: workspace.retell_agent_2_id,
          retell_agent_3_id: workspace.retell_agent_3_id,
          retell_phone_number: workspace.retell_phone_number,
        }),
      }),
      fetch('/api/settings/dialler', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          double_dial_enabled: dialler.double_dial_enabled,
          voicemail_behaviour: dialler.voicemail_behaviour,
        }),
      }),
    ]);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (!workspace || !dialler) return <div className="text-muted">Loading...</div>;

  const agents = [
    { key: 'retell_agent_1_id' as const, label: 'Agent 1 — Instant Trigger', desc: 'Calls new leads within 60 seconds of entering Close CRM' },
    { key: 'retell_agent_2_id' as const, label: 'Agent 2 — Pipeline Retry', desc: 'Retries leads in No Answer, Not Reached, No Show, and Follow Up stages' },
    { key: 'retell_agent_3_id' as const, label: 'Agent 3 — Morning Confirmation', desc: 'Confirms today\'s appointments between 9-10am' },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-text">Agent Configuration</h1>
          <p className="text-sm text-muted mt-1">Configure your Retell AI agents</p>
        </div>
        <div className="flex items-center gap-3">
          {saved && <span className="text-sm text-success">Saved</span>}
          <Button onClick={save} loading={saving}>Save Changes</Button>
        </div>
      </div>

      {/* Agent Name */}
      <Card>
        <h2 className="text-sm font-medium text-muted uppercase tracking-wider mb-4">Agent Identity</h2>
        <div className="max-w-md">
          <Input
            label="Agent Name"
            value={workspace.agent_name || ''}
            onChange={(e) => setWorkspace({ ...workspace, agent_name: e.target.value })}
            hint="Replaces [AGENT_NAME_PLACEHOLDER] in all agent prompts"
            placeholder="e.g. Sarah"
          />
        </div>
      </Card>

      {/* Phone Number */}
      <Card>
        <h2 className="text-sm font-medium text-muted uppercase tracking-wider mb-4">Outbound Number</h2>
        <div className="max-w-md">
          <Input
            label="Phone Number"
            value={workspace.retell_phone_number || ''}
            onChange={(e) => setWorkspace({ ...workspace, retell_phone_number: e.target.value })}
            placeholder="+44..."
            hint="All agents call from this number"
          />
        </div>
      </Card>

      {/* Per-Agent Config */}
      {agents.map(({ key, label, desc }) => (
        <Card key={key}>
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-base font-medium text-text">{label}</h3>
              <p className="text-sm text-muted mt-1">{desc}</p>
            </div>
            <span className={`text-xs px-2 py-1 rounded-full ${
              workspace[key] ? 'bg-success/10 text-success' : 'bg-card-hover text-muted'
            }`}>
              {workspace[key] ? 'Configured' : 'Not set'}
            </span>
          </div>
          <div className="max-w-md">
            <Input
              label="Retell Agent ID"
              value={workspace[key] || ''}
              onChange={(e) => setWorkspace({ ...workspace, [key]: e.target.value })}
              placeholder="agent_..."
            />
          </div>
        </Card>
      ))}

      {/* Global Agent Settings */}
      <Card>
        <h2 className="text-sm font-medium text-muted uppercase tracking-wider mb-4">Call Settings</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-text">Double Dial</p>
              <p className="text-xs text-muted">Call twice on first attempt if no answer</p>
            </div>
            <button
              onClick={() => setDialler({ ...dialler, double_dial_enabled: !dialler.double_dial_enabled })}
              className={`relative w-10 h-5 rounded-full transition-colors ${dialler.double_dial_enabled ? 'bg-accent' : 'bg-border'}`}
            >
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${dialler.double_dial_enabled ? 'left-5' : 'left-0.5'}`} />
            </button>
          </div>

          <div className="border-t border-border pt-4">
            <label className="block text-sm text-text mb-2">Voicemail Behaviour</label>
            <div className="flex gap-3">
              {[
                { value: 'leave_message', label: 'Leave message' },
                { value: 'hang_up', label: 'Hang up' },
                { value: 'leave_on_final_only', label: 'Final attempt only' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setDialler({ ...dialler, voicemail_behaviour: opt.value })}
                  className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                    dialler.voicemail_behaviour === opt.value
                      ? 'bg-accent text-white'
                      : 'bg-background border border-border text-muted hover:text-text'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
