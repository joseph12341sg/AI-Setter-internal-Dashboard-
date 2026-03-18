import { createServiceClient } from '@/lib/supabase/server';

/**
 * Check if a phone number is on the DNC (Do Not Call) list for a workspace.
 */
export async function isOnDncList(
  phone: string,
  workspaceId: string
): Promise<boolean> {
  const supabase = createServiceClient();

  const { data } = await supabase
    .from('dnc_list')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('phone_number', phone)
    .limit(1)
    .single();

  return !!data;
}

/**
 * Add a phone number to the DNC list.
 */
export async function addToDncList({
  phone,
  reason,
  addedBy,
  workspaceId,
}: {
  phone: string;
  reason?: string;
  addedBy: 'manual' | 'auto_request' | 'csv_import';
  workspaceId: string;
}): Promise<void> {
  const supabase = createServiceClient();

  await supabase
    .from('dnc_list')
    .upsert(
      {
        workspace_id: workspaceId,
        phone_number: phone,
        reason: reason || null,
        added_by: addedBy,
      },
      { onConflict: 'workspace_id,phone_number' }
    );
}
