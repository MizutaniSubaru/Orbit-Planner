import { NextResponse } from 'next/server';
import {
  createGoogleEvent,
  deleteGoogleEvent,
  updateGoogleEvent,
} from '@/lib/google-calendar';
import { normalizeUpdatePayload } from '@/lib/item-payload';
import { asApiError, getAuthenticatedServerClient } from '@/lib/server-auth';
import type { CalendarConnection, Item } from '@/lib/types';

type RouteParams = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const [{ id }, context, body] = await Promise.all([
      params,
      getAuthenticatedServerClient(request),
      request.json(),
    ]);
    const googleAccessToken =
      typeof body.google_access_token === 'string' ? body.google_access_token : null;
    const timezone = typeof body.timezone === 'string' ? body.timezone : 'Asia/Shanghai';

    const { data: currentItem, error: currentItemError } = await context.supabase
      .from('items')
      .select('*')
      .eq('id', id)
      .eq('user_id', context.user.id)
      .single();

    if (currentItemError || !currentItem) {
      return NextResponse.json({ error: 'Item not found.' }, { status: 404 });
    }

    const existingItem = currentItem as Item;
    const normalized = normalizeUpdatePayload(body, existingItem);

    const { data: updatedData, error: updateError } = await context.supabase
      .from('items')
      .update(normalized)
      .eq('id', id)
      .eq('user_id', context.user.id)
      .select('*')
      .single();

    if (updateError || !updatedData) {
      throw updateError ?? new Error('Failed to update item.');
    }

    const updated = updatedData as Item;

    if (updated.type !== 'event') {
      return NextResponse.json({ item: updated });
    }

    const { data: connectionData } = await context.supabase
      .from('calendar_connections')
      .select('*')
      .eq('user_id', context.user.id)
      .maybeSingle();
    const connection = (connectionData as CalendarConnection | null) ?? null;

    if (!connection?.is_enabled || !googleAccessToken) {
      return NextResponse.json({ item: updated });
    }

    try {
      const syncResponse = updated.google_event_id
        ? await updateGoogleEvent(
            googleAccessToken,
            connection.calendar_id,
            updated.google_event_id,
            updated,
            timezone
          )
        : await createGoogleEvent(
            googleAccessToken,
            connection.calendar_id,
            updated,
            timezone
          );

      const { data: syncedItem } = await context.supabase
        .from('items')
        .update({
          google_event_id: syncResponse.id,
          sync_state: 'synced',
        })
        .eq('id', updated.id)
        .eq('user_id', context.user.id)
        .select('*')
        .single();

      return NextResponse.json({ item: (syncedItem as Item | null) ?? updated });
    } catch {
      const { data: failedItem } = await context.supabase
        .from('items')
        .update({
          sync_state: 'needs_reconnect',
        })
        .eq('id', updated.id)
        .eq('user_id', context.user.id)
        .select('*')
        .single();

      return NextResponse.json({ item: (failedItem as Item | null) ?? updated });
    }
  } catch (error) {
    return NextResponse.json(
      { error: asApiError(error, 'Failed to update item.') },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const [{ id }, context] = await Promise.all([
      params,
      getAuthenticatedServerClient(request),
    ]);
    const body = await request.json().catch(() => ({}));
    const googleAccessToken =
      typeof body.google_access_token === 'string' ? body.google_access_token : null;

    const { data: currentItem, error: currentItemError } = await context.supabase
      .from('items')
      .select('*')
      .eq('id', id)
      .eq('user_id', context.user.id)
      .single();

    if (currentItemError || !currentItem) {
      return NextResponse.json({ error: 'Item not found.' }, { status: 404 });
    }

    const existingItem = currentItem as Item;

    if (existingItem.type === 'event' && existingItem.google_event_id && googleAccessToken) {
      const { data: connectionData } = await context.supabase
        .from('calendar_connections')
        .select('*')
        .eq('user_id', context.user.id)
        .maybeSingle();
      const connection = (connectionData as CalendarConnection | null) ?? null;

      if (connection?.is_enabled) {
        try {
          await deleteGoogleEvent(
            googleAccessToken,
            connection.calendar_id,
            existingItem.google_event_id
          );
        } catch {
          // Deleting the local item is still the safer default path.
        }
      }
    }

    const { error: deleteError } = await context.supabase
      .from('items')
      .delete()
      .eq('id', id)
      .eq('user_id', context.user.id);

    if (deleteError) {
      throw deleteError;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: asApiError(error, 'Failed to delete item.') },
      { status: 500 }
    );
  }
}
