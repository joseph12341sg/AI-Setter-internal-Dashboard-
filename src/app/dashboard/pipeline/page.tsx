'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { safeFetch, DEMO_PIPELINE_RULES } from '@/lib/demo-data';
import type { PipelineRule } from '@/types/database';

export default function PipelinePage() {
  const [rules, setRules] = useState<PipelineRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newStage, setNewStage] = useState({ name: '', id: '' });

  const loadRules = useCallback(async () => {
    const data = await safeFetch('/api/settings/pipeline', DEMO_PIPELINE_RULES);
    setRules(data);
    setLoading(false);
  }, []);

  useEffect(() => { loadRules(); }, [loadRules]);

  async function toggleRule(rule: PipelineRule) {
    setSaving(rule.id);
    await fetch('/api/settings/pipeline', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: rule.id, is_enabled: !rule.is_enabled }),
    });
    setRules(rules.map(r => r.id === rule.id ? { ...r, is_enabled: !r.is_enabled } : r));
    setSaving(null);
  }

  async function updateRule(rule: PipelineRule, updates: Partial<PipelineRule>) {
    setSaving(rule.id);
    await fetch('/api/settings/pipeline', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: rule.id, ...updates }),
    });
    setRules(rules.map(r => r.id === rule.id ? { ...r, ...updates } : r));
    setSaving(null);
  }

  async function addRule() {
    if (!newStage.name || !newStage.id) return;
    const res = await fetch('/api/settings/pipeline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ close_stage_name: newStage.name, close_stage_id: newStage.id }),
    });
    const rule = await res.json();
    setRules([...rules, rule]);
    setShowAdd(false);
    setNewStage({ name: '', id: '' });
  }

  function updateGapSchedule(rule: PipelineRule, index: number, value: string) {
    const gap = [...rule.gap_schedule];
    gap[index] = parseInt(value) || 0;
    updateRule(rule, { gap_schedule: gap });
  }

  if (loading) return <div className="text-muted">Loading pipeline rules...</div>;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-text">Pipeline Rules</h1>
          <p className="text-sm text-muted mt-1">Configure retry behaviour per Close CRM stage</p>
        </div>
        <Button onClick={() => setShowAdd(!showAdd)}>
          {showAdd ? 'Cancel' : '+ Add Stage'}
        </Button>
      </div>

      {showAdd && (
        <Card>
          <div className="flex items-end gap-4">
            <Input
              label="Stage Name"
              placeholder="e.g. No Answer"
              value={newStage.name}
              onChange={(e) => setNewStage({ ...newStage, name: e.target.value })}
            />
            <Input
              label="Close Stage ID"
              placeholder="stat_..."
              value={newStage.id}
              onChange={(e) => setNewStage({ ...newStage, id: e.target.value })}
            />
            <Button onClick={addRule} disabled={!newStage.name || !newStage.id}>Add</Button>
          </div>
        </Card>
      )}

      {rules.map((rule) => (
        <Card key={rule.id}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => toggleRule(rule)}
                className={`relative w-10 h-5 rounded-full transition-colors ${rule.is_enabled ? 'bg-accent' : 'bg-border'}`}
                disabled={saving === rule.id}
              >
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${rule.is_enabled ? 'left-5' : 'left-0.5'}`} />
              </button>
              <h3 className="text-base font-medium text-text">{rule.close_stage_name}</h3>
              <span className="text-xs text-muted font-mono">{rule.close_stage_id}</span>
            </div>
            {saving === rule.id && <span className="text-xs text-muted">Saving...</span>}
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-xs text-muted mb-2">Max Attempts</label>
              <select
                value={rule.max_attempts}
                onChange={(e) => updateRule(rule, { max_attempts: parseInt(e.target.value) })}
                className="px-3 py-2 bg-background border border-border rounded-lg text-text text-sm"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 10].map(n => (
                  <option key={n} value={n}>{n} attempts</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-muted mb-2">Retry Gap Schedule (hours)</label>
              <div className="flex gap-2">
                {rule.gap_schedule.map((gap, i) => (
                  <input
                    key={i}
                    type="number"
                    value={gap}
                    onChange={(e) => updateGapSchedule(rule, i, e.target.value)}
                    className="w-16 px-2 py-2 bg-background border border-border rounded-lg text-text text-sm text-center"
                    min={1}
                  />
                ))}
                <button
                  onClick={() => updateRule(rule, { gap_schedule: [...rule.gap_schedule, 24] })}
                  className="px-2 py-2 text-muted hover:text-accent text-sm"
                >
                  +
                </button>
              </div>
              <p className="text-xs text-muted mt-1">
                Hours between each retry: {rule.gap_schedule.map((g, i) => `${i + 1}→+${g}h`).join(', ')}
              </p>
            </div>
          </div>
        </Card>
      ))}

      {rules.length === 0 && (
        <Card>
          <p className="text-sm text-muted text-center py-8">
            No pipeline rules configured. Add a Close CRM stage to get started.
          </p>
        </Card>
      )}
    </div>
  );
}
