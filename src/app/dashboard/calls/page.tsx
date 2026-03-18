'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface CallLog {
  id: string;
  lead_name: string | null;
  lead_phone: string;
  lead_id: string;
  call_sid: string | null;
  agent_type: string;
  outcome: string | null;
  duration_seconds: number | null;
  attempt_number: number;
  trigger_type: string;
  pipeline_stage_at_call: string | null;
  recording_url: string | null;
  transcript_url: string | null;
  created_at: string;
}

export default function CallsPage() {
  const [calls, setCalls] = useState<CallLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Filters
  const [outcome, setOutcome] = useState('');
  const [agentType, setAgentType] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const loadCalls = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '25' });
    if (outcome) params.set('outcome', outcome);
    if (agentType) params.set('agent_type', agentType);
    if (dateFrom) params.set('date_from', dateFrom);
    if (dateTo) params.set('date_to', dateTo);

    const res = await fetch(`/api/calls?${params}`);
    const data = await res.json();
    setCalls(data.data || []);
    setTotal(data.total || 0);
    setLoading(false);
  }, [page, outcome, agentType, dateFrom, dateTo]);

  useEffect(() => { loadCalls(); }, [loadCalls]);

  const agentLabel = (type: string) => {
    switch (type) { case 'agent1': return 'Instant'; case 'agent2': return 'Retry'; case 'agent3': return 'Confirm'; default: return type; }
  };

  const outcomeColor = (o: string) => {
    switch (o) {
      case 'booked': return 'text-success bg-success/10';
      case 'no_answer': return 'text-warning bg-warning/10';
      case 'voicemail_left': return 'text-muted bg-card-hover';
      case 'disqualified': case 'not_interested': case 'stop_calling': return 'text-danger bg-danger/10';
      default: return 'text-muted bg-card-hover';
    }
  };

  const totalPages = Math.ceil(total / 25);

  async function exportCsv() {
    const params = new URLSearchParams({ page: '1', limit: '10000' });
    if (outcome) params.set('outcome', outcome);
    if (agentType) params.set('agent_type', agentType);
    if (dateFrom) params.set('date_from', dateFrom);
    if (dateTo) params.set('date_to', dateTo);

    const res = await fetch(`/api/calls?${params}`);
    const data = await res.json();
    const rows = data.data || [];

    const headers = ['Date', 'Lead', 'Phone', 'Agent', 'Outcome', 'Duration', 'Attempt', 'Trigger'];
    const csv = [
      headers.join(','),
      ...rows.map((c: CallLog) => [
        new Date(c.created_at).toISOString(),
        `"${c.lead_name || ''}"`,
        c.lead_phone,
        c.agent_type,
        c.outcome || '',
        c.duration_seconds || '',
        c.attempt_number,
        c.trigger_type,
      ].join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `call-log-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-text">Call Log</h1>
          <p className="text-sm text-muted mt-1">{total} total calls</p>
        </div>
        <Button variant="secondary" onClick={exportCsv}>Export CSV</Button>
      </div>

      {/* Filters */}
      <Card padding="sm">
        <div className="flex items-center gap-4 flex-wrap">
          <select
            value={outcome}
            onChange={(e) => { setOutcome(e.target.value); setPage(1); }}
            className="px-3 py-1.5 bg-background border border-border rounded-lg text-text text-sm"
          >
            <option value="">All outcomes</option>
            <option value="booked">Booked</option>
            <option value="no_answer">No Answer</option>
            <option value="voicemail_left">Voicemail</option>
            <option value="disqualified">Disqualified</option>
            <option value="not_interested">Not Interested</option>
            <option value="stop_calling">Stop Calling</option>
          </select>
          <select
            value={agentType}
            onChange={(e) => { setAgentType(e.target.value); setPage(1); }}
            className="px-3 py-1.5 bg-background border border-border rounded-lg text-text text-sm"
          >
            <option value="">All agents</option>
            <option value="agent1">Agent 1 — Instant</option>
            <option value="agent2">Agent 2 — Retry</option>
            <option value="agent3">Agent 3 — Confirm</option>
          </select>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
            className="px-3 py-1.5 bg-background border border-border rounded-lg text-text text-sm"
            placeholder="From"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
            className="px-3 py-1.5 bg-background border border-border rounded-lg text-text text-sm"
            placeholder="To"
          />
          {(outcome || agentType || dateFrom || dateTo) && (
            <button
              onClick={() => { setOutcome(''); setAgentType(''); setDateFrom(''); setDateTo(''); setPage(1); }}
              className="text-sm text-muted hover:text-text"
            >
              Clear filters
            </button>
          )}
        </div>
      </Card>

      {/* Table */}
      <Card padding="sm">
        {loading ? (
          <div className="text-muted text-center py-8">Loading calls...</div>
        ) : calls.length === 0 ? (
          <div className="text-muted text-center py-8">No calls found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-2 px-3 text-muted font-medium">Lead</th>
                  <th className="pb-2 px-3 text-muted font-medium">Agent</th>
                  <th className="pb-2 px-3 text-muted font-medium">Outcome</th>
                  <th className="pb-2 px-3 text-muted font-medium">Duration</th>
                  <th className="pb-2 px-3 text-muted font-medium">Attempt</th>
                  <th className="pb-2 px-3 text-muted font-medium">Trigger</th>
                  <th className="pb-2 px-3 text-muted font-medium">Time</th>
                </tr>
              </thead>
              <tbody>
                {calls.map((call) => (
                  <>
                    <tr
                      key={call.id}
                      onClick={() => setExpandedId(expandedId === call.id ? null : call.id)}
                      className="border-b border-border/50 cursor-pointer hover:bg-card-hover"
                    >
                      <td className="py-3 px-3">
                        <div className="text-text">{call.lead_name || 'Unknown'}</div>
                        <div className="text-xs text-muted font-mono">{call.lead_phone}</div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="text-xs px-2 py-0.5 rounded bg-accent/10 text-accent">
                          {agentLabel(call.agent_type)}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className={`text-xs px-2 py-0.5 rounded ${outcomeColor(call.outcome || '')}`}>
                          {(call.outcome || 'pending').replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-muted">
                        {call.duration_seconds
                          ? `${Math.floor(call.duration_seconds / 60)}m ${call.duration_seconds % 60}s`
                          : '—'}
                      </td>
                      <td className="py-3 px-3 text-muted">#{call.attempt_number}</td>
                      <td className="py-3 px-3 text-muted capitalize">{call.trigger_type}</td>
                      <td className="py-3 px-3 text-muted">
                        {new Date(call.created_at).toLocaleString('en-GB', {
                          day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                        })}
                      </td>
                    </tr>
                    {expandedId === call.id && (
                      <tr key={`${call.id}-detail`} className="border-b border-border/50">
                        <td colSpan={7} className="px-3 py-4 bg-background">
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div>
                              <p className="text-muted text-xs">Call ID</p>
                              <p className="text-text font-mono text-xs mt-1">{call.call_sid || '—'}</p>
                            </div>
                            <div>
                              <p className="text-muted text-xs">Pipeline Stage</p>
                              <p className="text-text mt-1">{call.pipeline_stage_at_call || '—'}</p>
                            </div>
                            <div>
                              <p className="text-muted text-xs">Close Lead ID</p>
                              <p className="text-text font-mono text-xs mt-1">{call.lead_id}</p>
                            </div>
                            <div>
                              <p className="text-muted text-xs">Recording</p>
                              {call.recording_url ? (
                                <audio controls className="mt-1 h-8" src={call.recording_url}>
                                  <track kind="captions" />
                                </audio>
                              ) : (
                                <p className="text-muted mt-1">No recording</p>
                              )}
                            </div>
                            <div>
                              <p className="text-muted text-xs">Transcript</p>
                              <p className="text-text mt-1">
                                {call.transcript_url ? (
                                  <a href={call.transcript_url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                                    View transcript
                                  </a>
                                ) : 'No transcript'}
                              </p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t border-border mt-4">
            <p className="text-sm text-muted">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                Previous
              </Button>
              <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
