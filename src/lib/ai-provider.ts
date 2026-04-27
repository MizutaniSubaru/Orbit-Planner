import { OpenAI } from 'openai';
import type { APIError } from 'openai/error';

const DEFAULT_KIMI_BASE_URL = 'https://api.moonshot.cn/v1';
const DEFAULT_KIMI_MODEL = 'kimi-k2.6';
const DEFAULT_KIMI_FAST_MODEL = 'kimi-k2-turbo-preview';
const KIMI_MODEL_FALLBACKS = [
  'kimi-k2.6',
  'kimi-k2-turbo-preview',
  'kimi-k2.5',
  'kimi-k2',
] as const;

const TASK_MODEL_ENV_KEYS = {
  default: ['KIMI_MODEL', 'MOONSHOT_MODEL', 'OPENAI_MODEL'],
  notes: ['KIMI_NOTES_MODEL', 'MOONSHOT_NOTES_MODEL'],
  parse: ['KIMI_PARSE_MODEL', 'MOONSHOT_PARSE_MODEL'],
  'search-intent': ['KIMI_SEARCH_INTENT_MODEL', 'MOONSHOT_SEARCH_INTENT_MODEL'],
  'search-rerank': ['KIMI_SEARCH_RERANK_MODEL', 'MOONSHOT_SEARCH_RERANK_MODEL'],
} as const;

const TASK_DEFAULT_MODELS = {
  default: DEFAULT_KIMI_MODEL,
  notes: DEFAULT_KIMI_MODEL,
  parse: DEFAULT_KIMI_FAST_MODEL,
  'search-intent': DEFAULT_KIMI_MODEL,
  'search-rerank': DEFAULT_KIMI_MODEL,
} as const;

const TASK_MAX_COMPLETION_TOKENS = {
  notes: 1536,
  parse: 512,
  'search-intent': 384,
  'search-rerank': 768,
} as const;

const TASK_MAX_TOKEN_ENV_KEYS = {
  notes: ['KIMI_NOTES_MAX_COMPLETION_TOKENS', 'MOONSHOT_NOTES_MAX_COMPLETION_TOKENS'],
  parse: ['KIMI_PARSE_MAX_COMPLETION_TOKENS', 'MOONSHOT_PARSE_MAX_COMPLETION_TOKENS'],
  'search-intent': [
    'KIMI_SEARCH_INTENT_MAX_COMPLETION_TOKENS',
    'MOONSHOT_SEARCH_INTENT_MAX_COMPLETION_TOKENS',
  ],
  'search-rerank': [
    'KIMI_SEARCH_RERANK_MAX_COMPLETION_TOKENS',
    'MOONSHOT_SEARCH_RERANK_MAX_COMPLETION_TOKENS',
  ],
} as const;

type AiJsonTask = keyof typeof TASK_MAX_COMPLETION_TOKENS;

export type AiTask = keyof typeof TASK_MODEL_ENV_KEYS;

export type AiProvider = 'kimi';

export type AiConfig = {
  apiKey: string | undefined;
  baseURL: string;
  candidateModels: string[];
  model: string;
  provider: AiProvider;
  task: AiTask;
};

type AiJsonMessage = {
  content: string;
  role: 'assistant' | 'system' | 'user';
};

type AiJsonMetrics = {
  cachedTokens?: number | null;
  completionTokens?: number | null;
  durationMs?: number;
  fastPath?: boolean;
  model?: string;
  outcome: 'error' | 'invalid_json' | 'no_api_key' | 'skip' | 'success';
  promptTokens?: number | null;
  reasoningTokens?: number | null;
  reason?: string;
  task: AiTask;
  totalTokens?: number | null;
};

function uniqueNonEmpty(values: string[]) {
  return values.filter((value, index, array) => Boolean(value) && array.indexOf(value) === index);
}

function readFirstEnv(keys: readonly string[]) {
  for (const key of keys) {
    const value = process.env[key];
    if (value) {
      return value;
    }
  }

  return undefined;
}

function readPositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : fallback;
}

function getConfiguredGlobalModel() {
  return readFirstEnv(TASK_MODEL_ENV_KEYS.default);
}

function getTaskModel(task: AiTask) {
  if (task === 'default') {
    return getConfiguredGlobalModel() || TASK_DEFAULT_MODELS.default;
  }

  if (task === 'parse') {
    return readFirstEnv(TASK_MODEL_ENV_KEYS.parse) || TASK_DEFAULT_MODELS.parse;
  }

  return (
    readFirstEnv(TASK_MODEL_ENV_KEYS[task]) ||
    getConfiguredGlobalModel() ||
    TASK_DEFAULT_MODELS[task]
  );
}

function getTaskFallbacks(task: AiTask) {
  return [TASK_DEFAULT_MODELS[task], ...KIMI_MODEL_FALLBACKS];
}

function getUsageMetric(source: unknown, path: string[]) {
  let current = source;
  for (const key of path) {
    if (!current || typeof current !== 'object' || Array.isArray(current)) {
      return null;
    }
    current = (current as Record<string, unknown>)[key];
  }

  return typeof current === 'number' && Number.isFinite(current) ? current : null;
}

export function getAiConfig(task: AiTask = 'default'): AiConfig {
  const isParseTask = task === 'parse';
  const apiKey = isParseTask
    ? process.env.KIMI_API_KEY || process.env.MOONSHOT_API_KEY
    : process.env.KIMI_API_KEY ||
      process.env.MOONSHOT_API_KEY ||
      process.env.OPENAI_API_KEY;
  const baseURL =
    isParseTask
      ? process.env.KIMI_BASE_URL || process.env.MOONSHOT_BASE_URL || DEFAULT_KIMI_BASE_URL
      : process.env.KIMI_BASE_URL ||
        process.env.MOONSHOT_BASE_URL ||
        process.env.OPENAI_BASE_URL ||
        DEFAULT_KIMI_BASE_URL;
  const configuredGlobalModel = getConfiguredGlobalModel();
  const model = getTaskModel(task);
  const candidateModels = uniqueNonEmpty([
    model,
    configuredGlobalModel || '',
    ...getTaskFallbacks(task),
  ]);

  return {
    apiKey,
    baseURL,
    candidateModels,
    model,
    provider: 'kimi',
    task,
  };
}

export function getAiMaxCompletionTokens(task: AiJsonTask) {
  return readPositiveInt(
    readFirstEnv(TASK_MAX_TOKEN_ENV_KEYS[task]),
    TASK_MAX_COMPLETION_TOKENS[task]
  );
}

export function createAiClient(config = getAiConfig()) {
  return new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
  });
}

export function isRetryableModelError(error: unknown) {
  const apiError = error as APIError;
  const message = apiError?.message || (error instanceof Error ? error.message : '');

  return (
    apiError?.status === 404 ||
    /not found the model|permission denied|unknown model|invalid model|model.*not.*found|not support model|not supported|unsupported model/i.test(
      message
    )
  );
}

export function sanitizeAiJsonContent(content: string | null | undefined) {
  if (!content) {
    return null;
  }

  let cleaned = content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

  const fencedMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    cleaned = fencedMatch[1].trim();
  }

  const objectStart = cleaned.indexOf('{');
  const objectEnd = cleaned.lastIndexOf('}');
  if (objectStart >= 0 && objectEnd > objectStart) {
    cleaned = cleaned.slice(objectStart, objectEnd + 1).trim();
  }

  return cleaned || null;
}

export function logAiJsonMetrics(metrics: AiJsonMetrics) {
  try {
    console.info(
      '[ai-json]',
      JSON.stringify({
        ...metrics,
        cachedTokens: metrics.cachedTokens ?? undefined,
        completionTokens: metrics.completionTokens ?? undefined,
        durationMs: metrics.durationMs ?? undefined,
        promptTokens: metrics.promptTokens ?? undefined,
        reasoningTokens: metrics.reasoningTokens ?? undefined,
        totalTokens: metrics.totalTokens ?? undefined,
      })
    );
  } catch {
    // Logging should never block the request path.
  }
}

export async function requestAiJson<T>(input: {
  maxCompletionTokens?: number;
  messages: AiJsonMessage[];
  parse: (content: string | null) => T | null;
  task: AiJsonTask;
}) {
  const aiConfig = getAiConfig(input.task);
  if (!aiConfig.apiKey) {
    logAiJsonMetrics({
      fastPath: false,
      outcome: 'no_api_key',
      reason: 'missing_api_key',
      task: input.task,
    });
    return null;
  }

  const openai = createAiClient(aiConfig);
  const maxCompletionTokens = input.maxCompletionTokens ?? getAiMaxCompletionTokens(input.task);
  let lastError: unknown = null;

  for (const candidate of aiConfig.candidateModels) {
    const startedAt = Date.now();

    try {
      const response = await openai.chat.completions.create({
        max_completion_tokens: maxCompletionTokens,
        messages: input.messages,
        model: candidate,
        response_format: { type: 'json_object' },
      });

      const payload = input.parse(sanitizeAiJsonContent(response.choices[0]?.message?.content));
      const usage = response.usage;
      const baseMetrics = {
        cachedTokens: getUsageMetric(usage, ['prompt_tokens_details', 'cached_tokens']),
        completionTokens: usage?.completion_tokens ?? null,
        durationMs: Date.now() - startedAt,
        model: candidate,
        promptTokens: usage?.prompt_tokens ?? null,
        reasoningTokens: getUsageMetric(usage, ['completion_tokens_details', 'reasoning_tokens']),
        task: input.task,
        totalTokens: usage?.total_tokens ?? null,
      } as const;

      if (payload !== null) {
        logAiJsonMetrics({
          ...baseMetrics,
          outcome: 'success',
        });
        return payload;
      }

      lastError = new Error('Model returned invalid JSON.');
      logAiJsonMetrics({
        ...baseMetrics,
        outcome: 'invalid_json',
      });
    } catch (error) {
      lastError = error;
      logAiJsonMetrics({
        durationMs: Date.now() - startedAt,
        model: candidate,
        outcome: 'error',
        reason: error instanceof Error ? error.message : 'Unknown error',
        task: input.task,
      });

      if (!isRetryableModelError(error)) {
        throw error;
      }
    }
  }

  if (lastError) {
    throw lastError;
  }

  return null;
}
