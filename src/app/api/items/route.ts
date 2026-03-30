import { NextResponse } from 'next/server';
import { buildCreatedLog } from '@/lib/activity';
import { normalizeCreatePayload } from '@/lib/item-payload';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import type { Item } from '@/lib/types';

export async function POST(request: Request) {
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

    const body = await request.json();
    const normalized = normalizeCreatePayload(body);

    const { data: insertedData, error: insertError } = await supabase
      .from('items')
      .insert({
        ...normalized,
        user_id: user.id,
      })
      .select('*')
      .single();

    if (insertError || !insertedData) {
      throw insertError ?? new Error('Failed to create item.');
    }

    const inserted = insertedData as Item;
    const { error: logError } = await supabase.from('activity_logs').insert({
      ...buildCreatedLog(inserted),
      user_id: user.id,
    });

    if (logError) {
      throw logError;
    }

    return NextResponse.json({ item: inserted });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create item.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
