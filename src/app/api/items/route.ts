import { NextResponse } from 'next/server';
import { createGoogleEvent } from '@/lib/google-calendar';
import { normalizeCreatePayload } from '@/lib/item-payload';
import { asApiError, getAuthenticatedServerClient } from '@/lib/server-auth';
import type { CalendarConnection, Item } from '@/lib/types';

export async function POST(request: Request) {
  try {
    const context = await getAuthenticatedServerClient(request);
    const body = await request.json();
    const googleAccessToken =
      typeof body.google_access_token === 'string' ? body.google_access_token : null;
    const timezone = typeof body.timezone === 'string' ? body.timezone : 'Asia/Shanghai';
    const normalized = normalizeCreatePayload(body);

    const { data: insertedData, error: insertError } = await context.supabase
      .from('items')
      .insert({
        ...normalized,
        user_id: context.user.id,
      })
      .select('*')
      .single();

    if (insertError || !insertedData) {
      throw insertError ?? new Error('Failed to create item.');
    }

    const inserted = insertedData as Item;

    if (inserted.type === 'event') {
      const { data: connectionData } = await context.supabase
        .from('calendar_connections')
        .select('*')
        .eq('user_id', context.user.id)
        .maybeSingle();
      const connection = (connectionData as CalendarConnection | null) ?? null;

      if (connection?.is_enabled && googleAccessToken) {
        try {
          const syncedEvent = await createGoogleEvent(
            googleAccessToken,
            connection.calendar_id,
            inserted,
            timezone
          );

          const { data: syncedItem } = await context.supabase
            .from('items')
            .update({
              google_event_id: syncedEvent.id,
              sync_state: 'synced',
            })
            .eq('id', inserted.id)
            .select('*')
            .single();

          return NextResponse.json({ item: (syncedItem as Item | null) ?? inserted });
        } catch {
          const { data: failedItem } = await context.supabase
            .from('items')
            .update({
              sync_state: 'needs_reconnect',
            })
            .eq('id', inserted.id)
            .select('*')
            .single();

          return NextResponse.json({ item: (failedItem as Item | null) ?? inserted });
        }
      }
    }

    return NextResponse.json({ item: inserted });
  } catch (error) {
    return NextResponse.json(
      { error: asApiError(error, 'Failed to create item.') },
      { status: 500 }
    );
  }
}
