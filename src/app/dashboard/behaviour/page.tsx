'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface DncEntry {
  id: string;
  phone_number: string;
  reason: string | null;
  added_by: string;
  created_at: string;
}

interface DiallerData {
  voicemail_behaviour: string;
  slack_webhook_url: string | null;
  slack_channel_booked: string | null;
  slack_channel_no_answer: string | null;
  slack_channel_alerts: string | null;
}

export default function BehaviourPage() {
  const [dialler, setDialler] = useState<DiallerData | null>(null);
  const [dncList, setDncList] = useState<DncEntry[]>([]);
  const [newPhone, setNewPhone] = useState('');
  const [newReason, setNewReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const loadData = useCallback(async () => {
    const diallerRes = await fetch('/api/settings/dialler');
    setDialler(await diallerRes.json());
    // DNC list would be fetched from a dedicated endpoint
    // For now, we'll load from the dialler settings page
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  async function save() {
    if (!dialler) return;
    setSaving(true);
    await fetch('/api/settings/dialler', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        voicemail_behaviour: dialler.voicemail_behaviour,
        slack_webhook_url: dialler.slack_webhook_url,
        slack_channel_booked: dialler.slack_channel_booked,
        slack_channel_no_answer: dialler.slack_channel_no_answer,
        slack_channel_alerts: dialler.slack_channel_alerts,
      }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function addToDnc() {
    if (!newPhone) return;
    const res = await fetch('/api/settings/dnc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: newPhone, reason: newReason }),
    });
    if (res.ok) {
      const entry = await res.json();
      setDncList([entry, ...dncList]);
      setNewPhone('');
      setNewReason('');
    }
  }

  if (!dialler) return <div className="text-muted">Loading...</div>;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-text">Behaviour & DNC</h1>
          <p className="text-sm text-muted mt-1">Voicemail settings, DNC list, and Slack notifications</p>
        </div>
        <div className="flex items-center gap-3">
          {saved && <span className="text-sm text-success">Saved</span>}
          <Button onClick={save} loading={saving}>Save Changes</Button>
        </div>
      </div>

      {/* Voicemail Behaviour */}
      <Card>
        <h2 className="text-sm font-medium text-muted uppercase tracking-wider mb-4">Voicemail Detection</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-text mb-2">When voicemail is detected:</label>
            <div className="flex gap-3">
              {[
                { value: 'leave_message', label: 'Leave voicemail script' },
                { value: 'hang_up', label: 'Hang up immediately' },
                { value: 'leave_on_final_only', label: 'Leave on final attempt only' },
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
          <p className="text-xs text-muted">
            Note: Agent 3 (Morning Confirmation) never leaves voicemail regardless of this setting.
          </p>
        </div>
      </Card>

      {/* DNC List */}
      <Card>
        <h2 className="text-sm font-medium text-muted uppercase tracking-wider mb-4">Do Not Call List</h2>
        <div className="flex items-end gap-3 mb-6">
          <Input
            label="Phone Number"
            placeholder="+44..."
            value={newPhone}
            onChange={(e) => setNewPhone(e.target.value)}
          />
          <Input
            label="Reason (optional)"
            placeholder="e.g. Requested removal"
            value={newReason}
            onChange={(e) => setNewReason(e.target.value)}
          />
          <Button onClick={addToDnc} disabled={!newPhone}>Add</Button>
        </div>

        {dncList.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="pb-2 text-muted font-medium">Phone</th>
                <th className="pb-2 text-muted font-medium">Reason</th>
                <th className="pb-2 text-muted font-medium">Source</th>
                <th className="pb-2 text-muted font-medium">Added</th>
              </tr>
            </thead>
            <tbody>
              {dncList.map((entry) => (
                <tr key={entry.id} className="border-b border-border/50">
                  <td className="py-2 text-text font-mono">{entry.phone_number}</td>
                  <td className="py-2 text-muted">{entry.reason || '—'}</td>
                  <td className="py-2">
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      entry.added_by === 'auto_request' ? 'bg-warning/10 text-warning' : 'bg-card-hover text-muted'
                    }`}>
                      {entry.added_by.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="py-2 text-muted">{new Date(entry.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-muted text-center py-4">
            No numbers on the DNC list. Numbers are added automatically when a lead requests to stop calling.
          </p>
        )}
      </Card>

      {/* Slack Notifications */}
      <Card>
        <h2 className="text-sm font-medium text-muted uppercase tracking-wider mb-4">Slack Notifications</h2>
        <div className="space-y-4 max-w-xl">
          <Input
            label="Slack Webhook URL"
            type="url"
            placeholder="https://hooks.slack.com/services/..."
            value={dialler.slack_webhook_url || ''}
            onChange={(e) => setDialler({ ...dialler, slack_webhook_url: e.target.value })}
          />
          <Input
            label="Booked Channel"
            placeholder="#bookings"
            value={dialler.slack_channel_booked || ''}
            onChange={(e) => setDialler({ ...dialler, slack_channel_booked: e.target.value })}
            hint="Channel for appointment booked notifications"
          />
          <Input
            label="No Answer Channel"
            placeholder="#no-answers"
            value={dialler.slack_channel_no_answer || ''}
            onChange={(e) => setDialler({ ...dialler, slack_channel_no_answer: e.target.value })}
          />
          <Input
            label="Alerts Channel"
            placeholder="#ai-setter-alerts"
            value={dialler.slack_channel_alerts || ''}
            onChange={(e) => setDialler({ ...dialler, slack_channel_alerts: e.target.value })}
            hint="System alerts, errors, and DNC requests"
          />
        </div>
      </Card>
    </div>
  );
}
