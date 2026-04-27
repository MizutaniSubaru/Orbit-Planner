import { NextResponse } from 'next/server';
import { AiParseError, parseMultipleInputWithAi } from '@/lib/parse';

export async function POST(request: Request) {
  try {
    const { locale, text, timezone } = await request.json();

    if (typeof text !== 'string' || !text.trim()) {
      return NextResponse.json(
        { error: 'Text is required for parsing.' },
        { status: 400 }
      );
    }

    const parsed = await parseMultipleInputWithAi({
      locale: typeof locale === 'string' ? locale : 'en-US',
      text,
      timezone: typeof timezone === 'string' ? timezone : undefined,
    });

    return NextResponse.json(parsed);
  } catch (error) {
    if (error instanceof AiParseError) {
      console.error(
        '[kimi-parse]',
        JSON.stringify({
          baseURL: error.baseURL,
          code: error.code,
          message: error.message,
          model: error.model,
          provider: error.provider,
          reason: error.cause instanceof Error ? error.cause.message : undefined,
          task: error.task,
        })
      );

      return NextResponse.json(
        {
          code: error.code,
          error: error.message,
          model: error.model,
          provider: error.provider,
        },
        { status: error.status }
      );
    }

    const message =
      error instanceof Error ? error.message : 'Failed to parse planning request.';

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
