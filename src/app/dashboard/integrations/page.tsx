'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface IntegrationStatus {
  connected: boolean;
  lastTested: string | null;
  detail?: string;
}

export default function IntegrationsPage() {
  const [closeKey, setCloseKey] = useState('');
  const [retellKey, setRetellKey] = useState('');
  const [workspace, setWorkspace] = useState<Record<string, unknown> | null>(null);
  const [closeStatus, setCloseStatus] = useState<IntegrationStatus>({ connected: false, lastTested: null });
  const [retellStatus, setRetellStatus] = useState<IntegrationStatus>({ connected: false, lastTested: null });
  const [testingClose, setTestingClose] = useState(false);
  const [testingRetell, setTestingRetell] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const loadData = useCallback(async () => {
    const res = await fetch('/api/settings/workspace');
    const data = await res.json();
    setWorkspace(data);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  async function testClose() {
    setTestingClose(true);
    try {
      const res = await fetch('/api/settings/test-close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: closeKey }),
      });
      const data = await res.json();
      setCloseStatus({
        connected: res.ok,
        lastTested: new Date().toISOString(),
        detail: data.orgName || data.error,
      });
    } catch {
      setCloseStatus({ connected: false, lastTested: new Date().toISOString(), detail: 'Connection failed' });
    }
    setTestingClose(false);
  }

  async function testRetell() {
    setTestingRetell(true);
    try {
      const res = await fetch('/api/settings/test-retell', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: retellKey }),
      });
      const data = await res.json();
      setRetellStatus({
        connected: res.ok,
        lastTested: new Date().toISOString(),
        detail: res.ok ? `${data.agentCount} agents found` : data.error,
      });
    } catch {
      setRetellStatus({ connected: false, lastTested: new Date().toISOString(), detail: 'Connection failed' });
    }
    setTestingRetell(false);
  }

  async function saveKeys() {
    setSaving(true);
    const body: Record<string, string> = {};
    if (closeKey) body.close_api_key = closeKey;
    if (retellKey) body.retell_api_key = retellKey;

    await fetch('/api/settings/workspace', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setSaving(false);
    setSaved(true);
    setCloseKey('');
    setRetellKey('');
    setTimeout(() => setSaved(false), 2000);
  }

  if (!workspace) return <div className="text-muted">Loading...</div>;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-text">Integrations</h1>
          <p className="text-sm text-muted mt-1">Manage your API connections</p>
        </div>
        <div className="flex items-center gap-3">
          {saved && <span className="text-sm text-success">Keys saved & encrypted</span>}
          <Button onClick={saveKeys} loading={saving} disabled={!closeKey && !retellKey}>
            Save Keys
          </Button>
        </div>
      </div>

      {/* Close CRM */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-medium text-text">Close CRM</h2>
            <p className="text-sm text-muted">Lead source and outcome updates</p>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${closeStatus.connected ? 'bg-success' : 'bg-muted'}`} />
            <span className="text-xs text-muted">
              {closeStatus.connected ? 'Connected' : closeStatus.lastTested ? 'Disconnected' : 'Not tested'}
            </span>
          </div>
        </div>
        <div className="space-y-4 max-w-xl">
          <Input
            label="API Key"
            type="password"
            placeholder={workspace.close_api_key ? '••••••••••••••••' : 'api_...'}
            value={closeKey}
            onChange={(e) => setCloseKey(e.target.value)}
            hint="Stored encrypted. Leave blank to keep existing key."
          />
          <div className="flex items-center gap-3">
            <Button variant="secondary" size="sm" onClick={testClose} loading={testingClose} disabled={!closeKey}>
              Test Connection
            </Button>
            {closeStatus.detail && (
              <span className={`text-sm ${closeStatus.connected ? 'text-success' : 'text-danger'}`}>
                {closeStatus.detail}
              </span>
            )}
          </div>
        </div>
      </Card>

      {/* Retell AI */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-medium text-text">Retell AI</h2>
            <p className="text-sm text-muted">Voice AI agents and call management</p>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${retellStatus.connected ? 'bg-success' : 'bg-muted'}`} />
            <span className="text-xs text-muted">
              {retellStatus.connected ? 'Connected' : retellStatus.lastTested ? 'Disconnected' : 'Not tested'}
            </span>
          </div>
        </div>
        <div className="space-y-4 max-w-xl">
          <Input
            label="API Key"
            type="password"
            placeholder={workspace.retell_api_key ? '••••••••••••••••' : 'key_...'}
            value={retellKey}
            onChange={(e) => setRetellKey(e.target.value)}
            hint="Stored encrypted. Leave blank to keep existing key."
          />
          <div className="flex items-center gap-3">
            <Button variant="secondary" size="sm" onClick={testRetell} loading={testingRetell} disabled={!retellKey}>
              Test Connection
            </Button>
            {retellStatus.detail && (
              <span className={`text-sm ${retellStatus.connected ? 'text-success' : 'text-danger'}`}>
                {retellStatus.detail}
              </span>
            )}
          </div>
        </div>

        <div className="border-t border-border mt-6 pt-6">
          <h3 className="text-sm font-medium text-muted mb-3">Agent IDs</h3>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-muted text-xs">Agent 1 (Instant)</p>
              <p className="text-text font-mono mt-1">{(workspace.retell_agent_1_id as string) || '—'}</p>
            </div>
            <div>
              <p className="text-muted text-xs">Agent 2 (Retry)</p>
              <p className="text-text font-mono mt-1">{(workspace.retell_agent_2_id as string) || '—'}</p>
            </div>
            <div>
              <p className="text-muted text-xs">Agent 3 (Confirm)</p>
              <p className="text-text font-mono mt-1">{(workspace.retell_agent_3_id as string) || '—'}</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Make.com — Reference Only */}
      <Card>
        <div className="mb-4">
          <h2 className="text-base font-medium text-text">Make.com</h2>
          <p className="text-sm text-muted">Calendly booking webhooks (configured in Retell, stored here for reference)</p>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted text-xs">Check Availability Webhook</p>
            <p className="text-text font-mono mt-1 break-all">Configured in Retell tool functions</p>
          </div>
          <div>
            <p className="text-muted text-xs">Book Appointment Webhook</p>
            <p className="text-text font-mono mt-1 break-all">Configured in Retell tool functions</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
