import { afterEach, describe, expect, it } from 'bun:test';
import { getAiConfig, getAiMaxCompletionTokens, isRetryableModelError } from '@/lib/ai-provider';

const ORIGINAL_ENV = {
  KIMI_MODEL: process.env.KIMI_MODEL,
  KIMI_NOTES_MAX_COMPLETION_TOKENS: process.env.KIMI_NOTES_MAX_COMPLETION_TOKENS,
  KIMI_NOTES_MODEL: process.env.KIMI_NOTES_MODEL,
  KIMI_PARSE_MAX_COMPLETION_TOKENS: process.env.KIMI_PARSE_MAX_COMPLETION_TOKENS,
  KIMI_PARSE_MODEL: process.env.KIMI_PARSE_MODEL,
  KIMI_SEARCH_INTENT_MAX_COMPLETION_TOKENS:
    process.env.KIMI_SEARCH_INTENT_MAX_COMPLETION_TOKENS,
  KIMI_SEARCH_INTENT_MODEL: process.env.KIMI_SEARCH_INTENT_MODEL,
  MOONSHOT_MODEL: process.env.MOONSHOT_MODEL,
  OPENAI_MODEL: process.env.OPENAI_MODEL,
};

afterEach(() => {
  process.env.KIMI_MODEL = ORIGINAL_ENV.KIMI_MODEL;
  process.env.KIMI_NOTES_MAX_COMPLETION_TOKENS = ORIGINAL_ENV.KIMI_NOTES_MAX_COMPLETION_TOKENS;
  process.env.KIMI_NOTES_MODEL = ORIGINAL_ENV.KIMI_NOTES_MODEL;
  process.env.KIMI_PARSE_MAX_COMPLETION_TOKENS = ORIGINAL_ENV.KIMI_PARSE_MAX_COMPLETION_TOKENS;
  process.env.KIMI_PARSE_MODEL = ORIGINAL_ENV.KIMI_PARSE_MODEL;
  process.env.KIMI_SEARCH_INTENT_MAX_COMPLETION_TOKENS =
    ORIGINAL_ENV.KIMI_SEARCH_INTENT_MAX_COMPLETION_TOKENS;
  process.env.KIMI_SEARCH_INTENT_MODEL = ORIGINAL_ENV.KIMI_SEARCH_INTENT_MODEL;
  process.env.MOONSHOT_MODEL = ORIGINAL_ENV.MOONSHOT_MODEL;
  process.env.OPENAI_MODEL = ORIGINAL_ENV.OPENAI_MODEL;
});

describe('ai provider config', () => {
  it('defaults parse requests to Kimi when no task model is configured', () => {
    delete process.env.KIMI_PARSE_MODEL;
    process.env.KIMI_MODEL = 'kimi-k2.6';
    delete process.env.MOONSHOT_MODEL;
    delete process.env.OPENAI_MODEL;

    const config = getAiConfig('parse');

    expect(config.model).toBe('kimi-k2.6');
    expect(config.candidateModels).toContain('kimi-k2.6');
  });

  it('prefers an explicitly configured notes model over the global Kimi model', () => {
    process.env.KIMI_NOTES_MODEL = 'kimi-k2.5';
    process.env.KIMI_MODEL = 'kimi-k2.6';

    const config = getAiConfig('notes');

    expect(config.model).toBe('kimi-k2.5');
    expect(config.candidateModels).toEqual(['kimi-k2.5', 'kimi-k2.6', 'kimi-k2']);
  });

  it('uses Moonshot model env vars before generic OpenAI-compatible vars', () => {
    delete process.env.KIMI_MODEL;
    process.env.MOONSHOT_MODEL = 'kimi-k2.5';
    process.env.OPENAI_MODEL = 'gpt-4.1-mini';

    const config = getAiConfig();

    expect(config.model).toBe('kimi-k2.5');
    expect(config.candidateModels).toEqual(['kimi-k2.5', 'kimi-k2.6', 'kimi-k2']);
  });

  it('uses a larger default completion token budget for parse', () => {
    delete process.env.KIMI_PARSE_MAX_COMPLETION_TOKENS;

    expect(getAiMaxCompletionTokens('parse')).toBe(512);
  });

  it('uses a dedicated default completion token budget for notes generation', () => {
    delete process.env.KIMI_NOTES_MAX_COMPLETION_TOKENS;

    expect(getAiMaxCompletionTokens('notes')).toBe(1536);
  });

  it('uses a configured Kimi search model before fallback candidates', () => {
    process.env.KIMI_SEARCH_INTENT_MODEL = 'kimi-k2.5';
    process.env.KIMI_MODEL = 'kimi-k2.6';

    const config = getAiConfig('search-intent');

    expect(config.model).toBe('kimi-k2.5');
    expect(config.candidateModels).toEqual(['kimi-k2.5', 'kimi-k2.6', 'kimi-k2']);
  });

  it('treats unsupported model errors as retryable', () => {
    expect(
      isRetryableModelError(new Error('model kimi-k2.0 is not supported by your token plan'))
    ).toBe(true);
  });
});
