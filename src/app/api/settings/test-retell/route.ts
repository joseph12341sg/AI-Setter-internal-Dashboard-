import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/settings/test-retell
 *
 * Tests a Retell API key by calling /v2/list-agents.
 */
export async function POST(request: NextRequest) {
  const { apiKey } = await request.json();

  if (!apiKey) {
    return NextResponse.json({ error: 'API key required' }, { status: 400 });
  }

  try {
    const response = await fetch('https://api.retellai.com/v2/list-agents', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const agents = await response.json();
      return NextResponse.json({
        ok: true,
        agentCount: Array.isArray(agents) ? agents.length : 0,
      });
    }

    return NextResponse.json(
      { error: `Retell API returned ${response.status}` },
      { status: 400 }
    );
  } catch {
    return NextResponse.json(
      { error: 'Failed to connect to Retell' },
      { status: 500 }
    );
  }
}
