'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';

const STEPS = [
  { title: 'Workspace', description: 'Name your workspace' },
  { title: 'Close CRM', description: 'Connect your CRM' },
  { title: 'Retell AI', description: 'Configure your AI agents' },
  { title: 'Webhooks', description: 'Set up integrations' },
  { title: 'Schedule', description: 'Set calling hours' },
];

interface FormData {
  workspaceName: string;
  closeApiKey: string;
  retellApiKey: string;
  retellAgent1Id: string;
  retellAgent2Id: string;
  retellAgent3Id: string;
  retellPhoneNumber: string;
  agentName: string;
  makeCheckAvailabilityUrl: string;
  makeBookAppointmentUrl: string;
  timezone: string;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testingClose, setTestingClose] = useState(false);
  const [closeConnected, setCloseConnected] = useState(false);
  const [testingRetell, setTestingRetell] = useState(false);
  const [retellConnected, setRetellConnected] = useState(false);

  const [form, setForm] = useState<FormData>({
    workspaceName: '',
    closeApiKey: '',
    retellApiKey: '',
    retellAgent1Id: '',
    retellAgent2Id: '',
    retellAgent3Id: '',
    retellPhoneNumber: '',
    agentName: 'Sarah',
    makeCheckAvailabilityUrl: '',
    makeBookAppointmentUrl: '',
    timezone: 'Europe/London',
  });

  function updateForm(field: keyof FormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError(null);
  }

  async function testCloseConnection() {
    setTestingClose(true);
    setError(null);
    try {
      const res = await fetch('/api/settings/test-close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: form.closeApiKey }),
      });
      if (res.ok) {
        setCloseConnected(true);
      } else {
        setError('Failed to connect to Close CRM. Check your API key.');
      }
    } catch {
      setError('Connection test failed. Please try again.');
    }
    setTestingClose(false);
  }

  async function testRetellConnection() {
    setTestingRetell(true);
    setError(null);
    try {
      const res = await fetch('/api/settings/test-retell', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: form.retellApiKey }),
      });
      if (res.ok) {
        setRetellConnected(true);
      } else {
        setError('Failed to connect to Retell. Check your API key.');
      }
    } catch {
      setError('Connection test failed. Please try again.');
    }
    setTestingRetell(false);
  }

  async function handleFinish() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/settings/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to create workspace');
        setLoading(false);
        return;
      }

      router.push('/dashboard');
    } catch {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  }

  function canProceed(): boolean {
    switch (step) {
      case 0: return form.workspaceName.length >= 2;
      case 1: return form.closeApiKey.length > 0;
      case 2: return form.retellApiKey.length > 0 && form.retellAgent1Id.length > 0;
      case 3: return true; // Webhooks are optional
      case 4: return true;
      default: return false;
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-xl space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="font-heading text-2xl font-bold text-text">
            Set Up Your Workspace
          </h1>
          <p className="mt-2 text-muted text-sm">
            Step {step + 1} of {STEPS.length}: {STEPS[step].description}
          </p>
        </div>

        {/* Progress bar */}
        <div className="flex gap-2">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i <= step ? 'bg-accent' : 'bg-border'
              }`}
            />
          ))}
        </div>

        <Card padding="lg">
          {/* Step 1: Workspace name */}
          {step === 0 && (
            <div className="space-y-5">
              <Input
                id="workspaceName"
                label="Workspace Name"
                placeholder="e.g. North Star Financial"
                value={form.workspaceName}
                onChange={(e) => updateForm('workspaceName', e.target.value)}
                hint="This is your company or team name"
              />
              <Input
                id="agentName"
                label="AI Agent Name"
                placeholder="e.g. Sarah"
                value={form.agentName}
                onChange={(e) => updateForm('agentName', e.target.value)}
                hint="The name your AI agent will use when calling leads"
              />
            </div>
          )}

          {/* Step 2: Close CRM */}
          {step === 1 && (
            <div className="space-y-5">
              <Input
                id="closeApiKey"
                label="Close CRM API Key"
                type="password"
                placeholder="api_..."
                value={form.closeApiKey}
                onChange={(e) => updateForm('closeApiKey', e.target.value)}
                hint="Found in Close Settings > API Keys"
              />
              <div className="flex items-center gap-3">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={testCloseConnection}
                  loading={testingClose}
                  disabled={!form.closeApiKey}
                >
                  Test Connection
                </Button>
                {closeConnected && (
                  <span className="text-sm text-success flex items-center gap-1">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Connected
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Retell AI */}
          {step === 2 && (
            <div className="space-y-5">
              <Input
                id="retellApiKey"
                label="Retell API Key"
                type="password"
                placeholder="key_..."
                value={form.retellApiKey}
                onChange={(e) => updateForm('retellApiKey', e.target.value)}
              />
              <div className="flex items-center gap-3">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={testRetellConnection}
                  loading={testingRetell}
                  disabled={!form.retellApiKey}
                >
                  Test Connection
                </Button>
                {retellConnected && (
                  <span className="text-sm text-success flex items-center gap-1">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Connected
                  </span>
                )}
              </div>
              <div className="border-t border-border pt-5 space-y-5">
                <Input
                  id="retellAgent1Id"
                  label="Agent 1 ID (Instant Trigger)"
                  placeholder="agent_..."
                  value={form.retellAgent1Id}
                  onChange={(e) => updateForm('retellAgent1Id', e.target.value)}
                />
                <Input
                  id="retellAgent2Id"
                  label="Agent 2 ID (Pipeline Retry)"
                  placeholder="agent_..."
                  value={form.retellAgent2Id}
                  onChange={(e) => updateForm('retellAgent2Id', e.target.value)}
                />
                <Input
                  id="retellAgent3Id"
                  label="Agent 3 ID (Morning Confirmation)"
                  placeholder="agent_..."
                  value={form.retellAgent3Id}
                  onChange={(e) => updateForm('retellAgent3Id', e.target.value)}
                />
                <Input
                  id="retellPhoneNumber"
                  label="Outbound Phone Number"
                  placeholder="+44..."
                  value={form.retellPhoneNumber}
                  onChange={(e) => updateForm('retellPhoneNumber', e.target.value)}
                  hint="The phone number Retell will call from"
                />
              </div>
            </div>
          )}

          {/* Step 4: Webhooks / Make.com */}
          {step === 3 && (
            <div className="space-y-5">
              <p className="text-sm text-muted">
                These Make.com webhook URLs are already configured in Retell.
                Storing them here is for your reference only.
              </p>
              <Input
                id="makeCheckAvailability"
                label="Make.com: Check Availability Webhook"
                placeholder="https://hook.make.com/..."
                value={form.makeCheckAvailabilityUrl}
                onChange={(e) => updateForm('makeCheckAvailabilityUrl', e.target.value)}
                hint="Scenario 1 — optional, for reference"
              />
              <Input
                id="makeBookAppointment"
                label="Make.com: Book Appointment Webhook"
                placeholder="https://hook.make.com/..."
                value={form.makeBookAppointmentUrl}
                onChange={(e) => updateForm('makeBookAppointmentUrl', e.target.value)}
                hint="Scenario 2 — optional, for reference"
              />
            </div>
          )}

          {/* Step 5: Calling hours / Timezone */}
          {step === 4 && (
            <div className="space-y-5">
              <div className="space-y-1.5">
                <label htmlFor="timezone" className="block text-sm font-medium text-text">
                  Timezone
                </label>
                <select
                  id="timezone"
                  value={form.timezone}
                  onChange={(e) => updateForm('timezone', e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text text-sm"
                >
                  <option value="Europe/London">Europe/London (GMT/BST)</option>
                  <option value="Europe/Dublin">Europe/Dublin</option>
                  <option value="Europe/Paris">Europe/Paris (CET)</option>
                  <option value="Europe/Berlin">Europe/Berlin (CET)</option>
                  <option value="America/New_York">America/New York (EST)</option>
                  <option value="America/Chicago">America/Chicago (CST)</option>
                  <option value="America/Los_Angeles">America/Los Angeles (PST)</option>
                </select>
                <p className="text-xs text-muted">All calling windows are enforced in this timezone</p>
              </div>

              <div className="p-4 bg-background rounded-lg border border-border space-y-3">
                <p className="text-sm font-medium text-text">Default Calling Windows</p>
                <div className="text-sm text-muted space-y-1">
                  <p><span className="text-accent">Agent 1 & 2:</span> 12:00-14:00 and 18:00-20:00</p>
                  <p><span className="text-accent">Agent 3:</span> 09:00-10:00</p>
                </div>
                <p className="text-xs text-muted">You can customise these in the dashboard after setup.</p>
              </div>
            </div>
          )}

          {/* Error display */}
          {error && (
            <div className="mt-4 p-3 bg-danger/10 border border-danger/20 rounded-lg text-sm text-danger">
              {error}
            </div>
          )}

          {/* Navigation */}
          <div className="mt-8 flex justify-between">
            <Button
              variant="ghost"
              onClick={() => setStep((s) => s - 1)}
              disabled={step === 0}
            >
              Back
            </Button>

            {step < STEPS.length - 1 ? (
              <Button
                onClick={() => setStep((s) => s + 1)}
                disabled={!canProceed()}
              >
                Continue
              </Button>
            ) : (
              <Button
                onClick={handleFinish}
                loading={loading}
                disabled={!canProceed()}
              >
                Launch Dashboard
              </Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
