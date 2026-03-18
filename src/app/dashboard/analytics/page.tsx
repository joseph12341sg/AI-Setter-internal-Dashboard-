'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';

interface AnalyticsData {
  totalCalls: number;
  totalBooked: number;
  bookRate: number;
  answerRate: number;
  avgDuration: number;
  avgAttemptsPerBooking: number;
  costEstimate: number;
  byAgent: { agent1: number; agent2: number; agent3: number };
  byOutcome: Record<string, number>;
  dailyBookRate: Array<{ date: string; rate: number; total: number; booked: number }>;
  hourlyAnswerRate: Array<{ hour: number; rate: number; total: number }>;
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);

  const loadData = useCallback(async () => {
    const params = new URLSearchParams({ date_from: dateFrom, date_to: dateTo });
    const res = await fetch(`/api/analytics?${params}`);
    setData(await res.json());
  }, [dateFrom, dateTo]);

  useEffect(() => { loadData(); }, [loadData]);

  if (!data) return <div className="text-muted">Loading analytics...</div>;

  const maxDailyTotal = Math.max(...data.dailyBookRate.map(d => d.total), 1);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-text">Analytics</h1>
          <p className="text-sm text-muted mt-1">Performance overview</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="px-3 py-1.5 bg-background border border-border rounded-lg text-text text-sm"
          />
          <span className="text-muted">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="px-3 py-1.5 bg-background border border-border rounded-lg text-text text-sm"
          />
        </div>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-5 gap-4">
        {[
          { label: 'Total Calls', value: data.totalCalls },
          { label: 'Total Booked', value: data.totalBooked },
          { label: 'Book Rate', value: `${data.bookRate}%` },
          { label: 'Avg Duration', value: `${data.avgDuration}s` },
          { label: 'Est. Cost', value: `$${data.costEstimate}` },
        ].map((stat) => (
          <Card key={stat.label} padding="md">
            <p className="text-xs text-muted uppercase tracking-wider">{stat.label}</p>
            <p className="text-2xl font-heading font-bold text-text mt-1">{stat.value}</p>
          </Card>
        ))}
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card padding="md">
          <p className="text-xs text-muted uppercase tracking-wider">Answer Rate</p>
          <p className="text-2xl font-heading font-bold text-text mt-1">{data.answerRate}%</p>
        </Card>
        <Card padding="md">
          <p className="text-xs text-muted uppercase tracking-wider">Avg Attempts / Booking</p>
          <p className="text-2xl font-heading font-bold text-text mt-1">{data.avgAttemptsPerBooking}</p>
        </Card>
        <Card padding="md">
          <p className="text-xs text-muted uppercase tracking-wider">Cost per Minute</p>
          <p className="text-2xl font-heading font-bold text-text mt-1">$0.016</p>
        </Card>
      </div>

      {/* Calls by Agent */}
      <Card>
        <h2 className="text-sm font-medium text-muted uppercase tracking-wider mb-4">Calls by Agent</h2>
        <div className="space-y-3">
          {[
            { label: 'Agent 1 — Instant Trigger', count: data.byAgent.agent1, color: 'bg-accent' },
            { label: 'Agent 2 — Pipeline Retry', count: data.byAgent.agent2, color: 'bg-warning' },
            { label: 'Agent 3 — Morning Confirmation', count: data.byAgent.agent3, color: 'bg-success' },
          ].map(({ label, count, color }) => {
            const total = data.byAgent.agent1 + data.byAgent.agent2 + data.byAgent.agent3;
            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
            return (
              <div key={label}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-text">{label}</span>
                  <span className="text-muted">{count} ({pct}%)</span>
                </div>
                <div className="h-2 bg-background rounded-full overflow-hidden">
                  <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Outcomes Breakdown */}
      <Card>
        <h2 className="text-sm font-medium text-muted uppercase tracking-wider mb-4">Outcomes Breakdown</h2>
        <div className="grid grid-cols-4 gap-3">
          {Object.entries(data.byOutcome).sort(([, a], [, b]) => b - a).map(([key, count]) => (
            <div key={key} className="p-3 bg-background rounded-lg">
              <p className="text-xs text-muted capitalize">{key.replace(/_/g, ' ')}</p>
              <p className="text-lg font-heading font-bold text-text mt-1">{count}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Daily Book Rate Chart (simple bar chart) */}
      <Card>
        <h2 className="text-sm font-medium text-muted uppercase tracking-wider mb-4">Daily Call Volume & Book Rate</h2>
        {data.dailyBookRate.length === 0 ? (
          <p className="text-sm text-muted text-center py-8">No data for this period</p>
        ) : (
          <div className="flex items-end gap-1 h-40">
            {data.dailyBookRate.slice(-30).map((day) => (
              <div key={day.date} className="flex-1 flex flex-col items-center gap-1 group relative">
                <div className="w-full flex flex-col justify-end h-32">
                  <div
                    className="w-full bg-accent/30 rounded-t relative"
                    style={{ height: `${(day.total / maxDailyTotal) * 100}%`, minHeight: day.total > 0 ? '4px' : '0' }}
                  >
                    {day.booked > 0 && (
                      <div
                        className="absolute bottom-0 w-full bg-success rounded-t"
                        style={{ height: `${(day.booked / day.total) * 100}%`, minHeight: '4px' }}
                      />
                    )}
                  </div>
                </div>
                {/* Tooltip */}
                <div className="hidden group-hover:block absolute -top-16 left-1/2 -translate-x-1/2 bg-card border border-border rounded-lg px-3 py-2 text-xs whitespace-nowrap z-10 shadow-lg">
                  <p className="text-text font-medium">{day.date}</p>
                  <p className="text-muted">{day.total} calls, {day.booked} booked ({day.rate}%)</p>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center gap-4 mt-4 text-xs text-muted">
          <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-accent/30" /> Total calls</div>
          <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-success" /> Booked</div>
        </div>
      </Card>

      {/* Hourly Answer Rate Heatmap */}
      <Card>
        <h2 className="text-sm font-medium text-muted uppercase tracking-wider mb-4">Answer Rate by Hour</h2>
        <div className="flex gap-1">
          {data.hourlyAnswerRate.map((h) => (
            <div key={h.hour} className="flex-1 text-center group relative">
              <div
                className="h-12 rounded"
                style={{
                  backgroundColor: h.total > 0
                    ? `rgba(59, 185, 80, ${Math.max(0.1, h.rate / 100)})`
                    : '#161B22',
                }}
              />
              <p className="text-xs text-muted mt-1">{h.hour}</p>
              {/* Tooltip */}
              <div className="hidden group-hover:block absolute -top-14 left-1/2 -translate-x-1/2 bg-card border border-border rounded-lg px-3 py-2 text-xs whitespace-nowrap z-10 shadow-lg">
                <p className="text-text">{h.hour}:00 — {h.rate}% answer rate</p>
                <p className="text-muted">{h.total} calls</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted mt-2">Darker green = higher answer rate. Helps optimise calling windows.</p>
      </Card>
    </div>
  );
}
