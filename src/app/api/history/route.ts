import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';

export async function GET(request: Request) {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return NextResponse.json(
        { error: 'Supabase is not configured.' },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get('limit') || '40'), 100);

    const { data, error } = await supabase
      .from('activity_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(Number.isFinite(limit) && limit > 0 ? limit : 40);

    if (error) {
      throw error;
    }

    return NextResponse.json({ logs: data ?? [] });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to fetch activity history.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
