import { NextResponse } from 'next/server';
import { getPrimaryCalendar } from '@/lib/google-calendar';
import { asApiError, getAuthenticatedServerClient } from '@/lib/server-auth';

export async function POST(request: Request) {
  try {
    const { supabase, user } = await getAuthenticatedServerClient(request);
    const body = await request.json();
    const googleAccessToken =
      typeof body.google_access_token === 'string' ? body.google_access_token : '';

    if (!googleAccessToken) {
      return NextResponse.json(
        { error: 'Missing Google access token.' },
        { status: 400 }
      );
    }

    const calendar = await getPrimaryCalendar(googleAccessToken);

    const { data, error } = await supabase
      .from('calendar_connections')
      .upsert(
        {
          calendar_id: calendar.id,
          calendar_summary: calendar.summary ?? 'Primary Calendar',
          connection_status: 'connected',
          is_enabled: true,
          last_synced_at: new Date().toISOString(),
          provider: 'google',
          user_id: user.id,
        },
        { onConflict: 'user_id' }
      )
      .select('*')
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ connection: data });
  } catch (error) {
    return NextResponse.json(
      { error: asApiError(error, 'Failed to connect Google Calendar.') },
      { status: 500 }
    );
  }
}
