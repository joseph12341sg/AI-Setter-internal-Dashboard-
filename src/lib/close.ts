import { getWorkspaceById, getDecryptedCloseKey } from '@/lib/workspace';

const CLOSE_API_BASE = 'https://api.close.com/api/v1';

interface CloseLead {
  id: string;
  display_name: string;
  status_id: string;
  status_label: string;
  contacts: CloseContact[];
  custom: Record<string, unknown>;
  [key: string]: unknown;
}

interface CloseContact {
  id: string;
  name: string;
  emails: { email: string; type: string }[];
  phones: { phone: string; type: string }[];
  [key: string]: unknown;
}

interface ClosePipelineStage {
  id: string;
  label: string;
  [key: string]: unknown;
}

/**
 * Make an authenticated request to the Close CRM API.
 */
async function closeFetch(
  path: string,
  workspaceId: string,
  options: RequestInit = {}
): Promise<Response> {
  const workspace = await getWorkspaceById(workspaceId);
  if (!workspace) throw new Error(`Workspace ${workspaceId} not found`);

  const apiKey = getDecryptedCloseKey(workspace);
  if (!apiKey) throw new Error(`No Close API key configured for workspace ${workspaceId}`);

  // Close uses HTTP Basic Auth with API key as username and empty password
  const auth = Buffer.from(`${apiKey}:`).toString('base64');

  return fetch(`${CLOSE_API_BASE}${path}`, {
    ...options,
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
}

/**
 * Get a lead by ID, including contacts.
 */
export async function getLead(
  leadId: string,
  workspaceId: string
): Promise<CloseLead> {
  const response = await closeFetch(`/lead/${leadId}/`, workspaceId);

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Close getLead failed (${response.status}): ${error}`);
  }

  return response.json();
}

/**
 * Update the status (pipeline stage) of a lead.
 */
export async function updateLeadStatus(
  leadId: string,
  statusId: string,
  workspaceId: string
): Promise<void> {
  const response = await closeFetch(`/lead/${leadId}/`, workspaceId, {
    method: 'PUT',
    body: JSON.stringify({ status_id: statusId }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Close updateLeadStatus failed (${response.status}): ${error}`);
  }
}

/**
 * Create an activity note on a lead.
 */
export async function createActivity(
  leadId: string,
  note: string,
  workspaceId: string
): Promise<void> {
  const response = await closeFetch('/activity/note/', workspaceId, {
    method: 'POST',
    body: JSON.stringify({
      lead_id: leadId,
      note,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Close createActivity failed (${response.status}): ${error}`);
  }
}

/**
 * Get all lead statuses (pipeline stages) for the workspace.
 */
export async function getPipelineStages(
  workspaceId: string
): Promise<ClosePipelineStage[]> {
  const response = await closeFetch('/status/lead/', workspaceId);

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Close getPipelineStages failed (${response.status}): ${error}`);
  }

  const data = await response.json();
  return data.data;
}

/**
 * Get today's appointments from Close CRM activity log.
 * Searches for activities with "appointment" or "booked" in notes from today.
 */
export async function getTodaysAppointments(
  workspaceId: string
): Promise<CloseLead[]> {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  // Search for leads in "Appointment Set" stage with activities today
  const response = await closeFetch(
    `/lead/?query=status:"Appointment Set"&_fields=id,display_name,contacts,custom`,
    workspaceId
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Close getTodaysAppointments failed (${response.status}): ${error}`);
  }

  const data = await response.json();
  return data.data || [];
}

/**
 * Extract lead contact info from a Close lead object.
 */
export function extractContactInfo(lead: CloseLead): {
  name: string;
  email: string | null;
  phone: string | null;
  firmName: string;
} {
  const contact = lead.contacts?.[0];
  return {
    name: contact?.name || lead.display_name || 'Unknown',
    email: contact?.emails?.[0]?.email || null,
    phone: contact?.phones?.[0]?.phone || null,
    firmName: lead.display_name || 'Unknown',
  };
}

/**
 * Test the Close CRM connection by fetching the current user's info.
 */
export async function testConnection(workspaceId: string): Promise<boolean> {
  try {
    const response = await closeFetch('/me/', workspaceId);
    return response.ok;
  } catch {
    return false;
  }
}
