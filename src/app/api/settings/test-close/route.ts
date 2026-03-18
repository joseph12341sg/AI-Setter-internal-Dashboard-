import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/settings/test-close
 *
 * Tests a Close CRM API key by calling /api/v1/me/.
 */
export async function POST(request: NextRequest) {
  const { apiKey } = await request.json();

  if (!apiKey) {
    return NextResponse.json({ error: 'API key required' }, { status: 400 });
  }

  try {
    const auth = Buffer.from(`${apiKey}:`).toString('base64');
    const response = await fetch('https://api.close.com/api/v1/me/', {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      return NextResponse.json({
        ok: true,
        orgName: data.organizations?.[0]?.name || 'Unknown',
      });
    }

    return NextResponse.json(
      { error: `Close API returned ${response.status}` },
      { status: 400 }
    );
  } catch {
    return NextResponse.json(
      { error: 'Failed to connect to Close CRM' },
      { status: 500 }
    );
  }
}
