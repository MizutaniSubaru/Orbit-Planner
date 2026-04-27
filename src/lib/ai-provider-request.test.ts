import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';

type MockCreateInput = {
  max_completion_tokens: number;
  messages: Array<{ content: string; role: string }>;
  model: string;
  response_format: { type: string };
};

type MockOutcome =
  | {
      content: string;
      type: 'success';
    }
  | {
      message: string;
      status?: number;
      type: 'error';
    };

const originalEnv = {
  KIMI_API_KEY: process.env.KIMI_API_KEY,
  KIMI_MODEL: process.env.KIMI_MODEL,
  KIMI_SEARCH_INTENT_MODEL: process.env.KIMI_SEARCH_INTENT_MODEL,
  MOONSHOT_API_KEY: process.env.MOONSHOT_API_KEY,
  MOONSHOT_MODEL: process.env.MOONSHOT_MODEL,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENAI_MODEL: process.env.OPENAI_MODEL,
};

let callModels: string[] = [];
let queuedOutcomes: MockOutcome[] = [];

mock.module('openai', () => ({
  OpenAI: class MockOpenAI {
    chat = {
      completions: {
        create: async ({ model }: MockCreateInput) => {
          callModels.push(model);
          const outcome = queuedOutcomes.shift();

          if (!outcome) {
            throw new Error(`Missing mock outcome for model ${model}.`);
          }

          if (outcome.type === 'error') {
            const error = new Error(outcome.message) as Error & { status?: number };
            error.status = outcome.status;
            throw error;
          }

          return {
            choices: [{ message: { content: outcome.content } }],
            usage: {
              completion_tokens: 32,
              prompt_tokens: 16,
              total_tokens: 48,
            },
          };
        },
      },
    };
  },
}));

const { requestAiJson } = await import('@/lib/ai-provider');

beforeEach(() => {
  callModels = [];
  queuedOutcomes = [];
  process.env.KIMI_API_KEY = 'test-key';
  delete process.env.MOONSHOT_API_KEY;
  delete process.env.OPENAI_API_KEY;
  delete process.env.KIMI_MODEL;
  delete process.env.MOONSHOT_MODEL;
  delete process.env.OPENAI_MODEL;
  delete process.env.KIMI_SEARCH_INTENT_MODEL;
});

afterEach(() => {
  process.env.KIMI_API_KEY = originalEnv.KIMI_API_KEY;
  process.env.KIMI_MODEL = originalEnv.KIMI_MODEL;
  process.env.KIMI_SEARCH_INTENT_MODEL = originalEnv.KIMI_SEARCH_INTENT_MODEL;
  process.env.MOONSHOT_API_KEY = originalEnv.MOONSHOT_API_KEY;
  process.env.MOONSHOT_MODEL = originalEnv.MOONSHOT_MODEL;
  process.env.OPENAI_API_KEY = originalEnv.OPENAI_API_KEY;
  process.env.OPENAI_MODEL = originalEnv.OPENAI_MODEL;
});

describe('requestAiJson', () => {
  it('retries unsupported search models with the next Kimi fallback candidate', async () => {
    process.env.KIMI_SEARCH_INTENT_MODEL = 'kimi-unknown';
    queuedOutcomes = [
      {
        message: 'model kimi-unknown is not supported by your token plan',
        status: 500,
        type: 'error',
      },
      {
        content: '{"keywords":"advisor","type":"all","date_start":null,"date_end":null}',
        type: 'success',
      },
    ];

    const payload = await requestAiJson({
      messages: [
        { content: 'Return JSON.', role: 'system' },
        { content: 'advisor', role: 'user' },
      ],
      parse: (content) => (content ? JSON.parse(content) : null),
      task: 'search-intent',
    });

    expect(payload).toEqual({
      date_end: null,
      date_start: null,
      keywords: 'advisor',
      type: 'all',
    });
    expect(callModels.slice(0, 2)).toEqual(['kimi-unknown', 'kimi-k2.6']);
  });
});
