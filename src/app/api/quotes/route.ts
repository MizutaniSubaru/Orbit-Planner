import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';
import type { Quote, QuoteView } from '@/lib/types';

const DEFAULT_LIMIT = 80;
const MAX_LIMIT = 200;

function normalizeLimit(rawValue: string | null) {
    if (!rawValue) {
        return DEFAULT_LIMIT;
    }

    const parsed = Number.parseInt(rawValue, 10);
    if (!Number.isFinite(parsed) || parsed < 1) {
        return DEFAULT_LIMIT;
    }

    return Math.min(parsed, MAX_LIMIT);
}

function toQuoteView(value: Quote): QuoteView | null {
    const quote = value.quote_text?.trim();
    const anime = value.anime_title?.trim();
    if (!quote || !anime) {
        return null;
    }

    return {
        anime,
        id: value.id,
        quote,
    };
}

export async function GET(request: Request) {
    try {
        const supabase = getSupabaseClient();
        if (!supabase) {
            return NextResponse.json(
                { error: 'Supabase is not configured.', quotes: [] },
                { status: 500 }
            );
        }

        const { searchParams } = new URL(request.url);
        const limit = normalizeLimit(searchParams.get('limit'));

        const { data, error } = await supabase
            .from('quotes')
            .select('*')
            .eq('is_active', true)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) {
            throw error;
        }

        const quotes = ((data ?? []) as Quote[])
            .map((entry) => toQuoteView(entry))
            .filter((entry): entry is QuoteView => Boolean(entry));

        return NextResponse.json({ quotes });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load quotes.';
        return NextResponse.json({ error: message, quotes: [] }, { status: 500 });
    }
}
