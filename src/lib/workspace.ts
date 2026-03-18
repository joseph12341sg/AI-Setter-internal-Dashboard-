import { createServiceClient } from '@/lib/supabase/server';
import { decrypt } from '@/lib/encryption';
import type { Workspace, DiallerSettings } from '@/types/database';

/**
 * Get the workspace for a given user ID.
 * Uses the service role client (bypasses RLS).
 */
export async function getWorkspace(userId: string): Promise<Workspace | null> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('workspaces')
    .select('*')
    .eq('owner_id', userId)
    .single();

  if (error || !data) return null;
  return data as Workspace;
}

/**
 * Get workspace by ID (for use in webhook/trigger routes where we have the workspace ID directly).
 */
export async function getWorkspaceById(workspaceId: string): Promise<Workspace | null> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('workspaces')
    .select('*')
    .eq('id', workspaceId)
    .single();

  if (error || !data) return null;
  return data as Workspace;
}

/**
 * Get dialler settings for a workspace.
 */
export async function getDiallerSettings(workspaceId: string): Promise<DiallerSettings | null> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('dialler_settings')
    .select('*')
    .eq('workspace_id', workspaceId)
    .single();

  if (error || !data) return null;
  return data as DiallerSettings;
}

/**
 * Decrypt the Retell API key for a workspace.
 * Returns null if no key is stored.
 */
export function getDecryptedRetellKey(workspace: Workspace): string | null {
  if (!workspace.retell_api_key) return null;
  return decrypt(workspace.retell_api_key);
}

/**
 * Decrypt the Close API key for a workspace.
 * Returns null if no key is stored.
 */
export function getDecryptedCloseKey(workspace: Workspace): string | null {
  if (!workspace.close_api_key) return null;
  return decrypt(workspace.close_api_key);
}

/**
 * Check if a workspace is operational (active + billing OK + kill switch off).
 */
export async function isWorkspaceOperational(workspaceId: string): Promise<{
  operational: boolean;
  reason?: string;
}> {
  const workspace = await getWorkspaceById(workspaceId);
  if (!workspace) return { operational: false, reason: 'Workspace not found' };
  if (!workspace.is_active) return { operational: false, reason: 'Workspace is deactivated' };
  if (workspace.billing_status === 'cancelled') return { operational: false, reason: 'Billing cancelled' };
  if (workspace.billing_status === 'past_due') return { operational: false, reason: 'Billing past due' };

  const settings = await getDiallerSettings(workspaceId);
  if (!settings) return { operational: false, reason: 'No dialler settings found' };
  if (settings.global_kill_switch) return { operational: false, reason: 'Kill switch is ON' };

  return { operational: true };
}
