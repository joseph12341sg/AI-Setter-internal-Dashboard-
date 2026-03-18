import { getWorkspaceById, getDecryptedRetellKey } from '@/lib/workspace';

const RETELL_API_BASE = 'https://api.retellai.com';

interface CreateCallParams {
  agentId: string;
  toNumber: string;
  fromNumber: string;
  variables: Record<string, string>;
  workspaceId: string;
}

interface RetellCallResponse {
  call_id: string;
  call_status: string;
  agent_id: string;
  [key: string]: unknown;
}

/**
 * Make an authenticated request to the Retell API using the workspace's API key.
 */
async function retellFetch(
  path: string,
  workspaceId: string,
  options: RequestInit = {}
): Promise<Response> {
  const workspace = await getWorkspaceById(workspaceId);
  if (!workspace) throw new Error(`Workspace ${workspaceId} not found`);

  const apiKey = getDecryptedRetellKey(workspace);
  if (!apiKey) throw new Error(`No Retell API key configured for workspace ${workspaceId}`);

  return fetch(`${RETELL_API_BASE}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
}

/**
 * Initiate an outbound call via Retell AI.
 */
export async function createCall({
  agentId,
  toNumber,
  fromNumber,
  variables,
  workspaceId,
}: CreateCallParams): Promise<RetellCallResponse> {
  const response = await retellFetch('/v2/create-phone-call', workspaceId, {
    method: 'POST',
    body: JSON.stringify({
      agent_id: agentId,
      to_number: toNumber,
      from_number: fromNumber,
      retell_llm_dynamic_variables: variables,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Retell createCall failed (${response.status}): ${error}`);
  }

  return response.json();
}

/**
 * Get details for a specific call.
 */
export async function getCallDetails(
  callId: string,
  workspaceId: string
): Promise<RetellCallResponse> {
  const response = await retellFetch(`/v2/get-call/${callId}`, workspaceId, {
    method: 'GET',
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Retell getCallDetails failed (${response.status}): ${error}`);
  }

  return response.json();
}

/**
 * List all agents for a workspace (for validation/display).
 */
export async function listAgents(workspaceId: string): Promise<unknown[]> {
  const response = await retellFetch('/v2/list-agents', workspaceId, {
    method: 'GET',
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Retell listAgents failed (${response.status}): ${error}`);
  }

  return response.json();
}
