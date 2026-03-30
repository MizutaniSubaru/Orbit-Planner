import { NextResponse } from 'next/server';
import { buildDeletedLog, buildUpdatedLog } from '@/lib/activity';
import { normalizeUpdatePayload } from '@/lib/item-payload';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import type { Item } from '@/lib/types';

type RouteParams = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const supabase = await getSupabaseServerClient();
    if (!supabase) {
      return NextResponse.json(
        { error: 'Supabase is not configured.' },
        { status: 500 }
      );
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const [{ id }, body] = await Promise.all([params, request.json()]);

    const { data: currentItem, error: currentItemError } = await supabase
      .from('items')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (currentItemError || !currentItem) {
      return NextResponse.json({ error: 'Item not found.' }, { status: 404 });
    }

    const existingItem = currentItem as Item;
    const normalized = normalizeUpdatePayload(body, existingItem);

    const { data: updatedData, error: updateError } = await supabase
      .from('items')
      .update(normalized)
      .eq('id', id)
      .eq('user_id', user.id)
      .select('*')
      .single();

    if (updateError || !updatedData) {
      throw updateError ?? new Error('Failed to update item.');
    }

    const updated = updatedData as Item;
    const { error: logError } = await supabase
      .from('activity_logs')
      .insert({
        ...buildUpdatedLog(existingItem, updated),
        user_id: user.id,
      });

    if (logError) {
      throw logError;
    }

    return NextResponse.json({ item: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update item.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const supabase = await getSupabaseServerClient();
    if (!supabase) {
      return NextResponse.json(
        { error: 'Supabase is not configured.' },
        { status: 500 }
      );
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const { id } = await params;

    const { data: currentItem, error: currentItemError } = await supabase
      .from('items')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (currentItemError || !currentItem) {
      return NextResponse.json({ error: 'Item not found.' }, { status: 404 });
    }

    const existingItem = currentItem as Item;

    const { error: logError } = await supabase
      .from('activity_logs')
      .insert({
        ...buildDeletedLog(existingItem),
        user_id: user.id,
      });

    if (logError) {
      throw logError;
    }

    const { error: deleteError } = await supabase
      .from('items')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (deleteError) {
      throw deleteError;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete item.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
