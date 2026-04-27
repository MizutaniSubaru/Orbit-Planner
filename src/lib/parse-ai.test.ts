import { beforeEach, describe, expect, it, mock } from 'bun:test';

let requestCount = 0;
let lastRequestInput: Record<string, unknown> | null = null;
let mockApiKey: string | undefined = 'test-key';
let queuedError: Error | null = null;
let queuedPayload: Record<string, unknown> | null = null;

mock.module('@/lib/ai-provider', () => ({
  getAiConfig: () => ({
    apiKey: mockApiKey,
    baseURL: 'https://example.test/v1',
    candidateModels: ['kimi-k2-turbo-preview', 'kimi-k2.6'],
    model: 'kimi-k2-turbo-preview',
    provider: 'kimi' as const,
    task: 'parse' as const,
  }),
  logAiJsonMetrics: () => {},
  requestAiJson: async (input: Record<string, unknown>) => {
    requestCount += 1;
    lastRequestInput = input;
    if (queuedError) {
      throw queuedError;
    }

    return queuedPayload;
  },
}));

const { buildParseRequestText } = await import('@/lib/parse-request');
const { AiParseError, parseInputWithAi } = await import('@/lib/parse');

describe('parseInputWithAi', () => {
  beforeEach(() => {
    lastRequestInput = null;
    mockApiKey = 'test-key';
    queuedError = null;
    queuedPayload = null;
    requestCount = 0;
  });

  it('uses fallback parsing only when no Kimi API key is configured', async () => {
    mockApiKey = undefined;

    const parsed = await parseInputWithAi({
      locale: 'zh-CN',
      text: '\u660e\u5929\u65e9\u4e0a\u5341\u70b9\u949f\u6211\u8981\u5728\u5bdd\u5ba4\u91cc\u589e\u7ba1\u589e\u4e24\u4e2a\u5c0f\u65f6',
      timezone: 'Asia/Shanghai',
    });

    expect(requestCount).toBe(0);
    expect(parsed.mode).toBe('fallback');
  });

  it('calls AI even for deterministic event inputs', async () => {
    queuedPayload = {
      ambiguity_reason: null,
      confidence: 0.97,
      location: 'A44',
      needs_confirmation: true,
      priority: 'medium',
      title: 'Meet my advisor',
    };

    const parsed = await parseInputWithAi({
      locale: 'en-US',
      text: 'Meet my advisor tomorrow at 3 PM in A44',
      timezone: 'Asia/Shanghai',
    });

    expect(requestCount).toBe(1);
    expect(parsed.mode).toBe('ai');
    expect(parsed.result.location).toBe('A44');
    expect(parsed.extracted_fields.location).toBe('A44');
    expect(parsed.extracted_fields.time.timezone).toBe('Asia/Shanghai');
    expect(parsed.extracted_fields.time.start_at).not.toBeNull();
    expect(lastRequestInput).not.toBeNull();
    expect(lastRequestInput?.task).toBe('parse');
    expect(Array.isArray(lastRequestInput?.messages)).toBe(true);
    const messages = lastRequestInput?.messages as Array<{ content: string; role: string }>;
    expect(messages[0]?.role).toBe('system');
    expect(messages[0]?.content).toContain('You are a bilingual AI planning assistant.');
    expect(messages[0]?.content).toContain('Return only a JSON object with these keys:');
    expect(messages[0]?.content).not.toContain('estimated_minutes');
    expect(messages[1]?.role).toBe('user');
    expect(messages[1]?.content).toBe('Meet my advisor tomorrow at 3 PM in A44');
  });

  it('throws instead of falling back when a configured Kimi request fails', async () => {
    queuedError = new Error('Kimi API unavailable');

    await expect(
      parseInputWithAi({
        locale: 'zh-CN',
        text: '\u660e\u5929\u65e9\u4e0a\u5341\u70b9\u949f\u6211\u8981\u5728\u5bdd\u5ba4\u91cc\u589e\u7ba1\u589e\u4e24\u4e2a\u5c0f\u65f6',
        timezone: 'Asia/Shanghai',
      })
    ).rejects.toThrow('Kimi parse request failed.');
    expect(requestCount).toBe(1);
  });

  it('throws instead of falling back when Kimi returns an empty payload', async () => {
    queuedPayload = null;

    await expect(
      parseInputWithAi({
        locale: 'en-US',
        text: 'Meet my advisor tomorrow at 3 PM in A44',
        timezone: 'Asia/Shanghai',
      })
    ).rejects.toThrow(AiParseError);
    expect(requestCount).toBe(1);
  });

  it('calls AI even for short todo inputs that previously used the fast path', async () => {
    queuedPayload = {
      ambiguity_reason: null,
      confidence: 0.93,
      location: 'Jubilee Campus',
      needs_confirmation: false,
      priority: 'high',
      title: '\u5f00\u7ec4\u4f1a',
    };

    const parsed = await parseInputWithAi({
      locale: 'zh-CN',
      text: '\u5c3d\u5feb\u5728Jubilee Campus\u5f00\u7ec4\u4f1a',
      timezone: 'Asia/Shanghai',
    });

    expect(requestCount).toBe(1);
    expect(parsed.mode).toBe('ai');
    expect(parsed.result.title).toBe('\u5f00\u7ec4\u4f1a');
    expect(parsed.result.location).toBe('Jubilee Campus');
    expect(parsed.extracted_fields.priority).toBe('high');
  });

  it('keeps labeled OCR sections intact when building AI messages', async () => {
    queuedPayload = {
      ambiguity_reason: null,
      confidence: 0.91,
      location: 'Trent Building',
      needs_confirmation: false,
      priority: 'medium',
      title: 'Meet my advisor',
    };

    const combinedRequest = buildParseRequestText({
      imageText: 'Wednesday 3:00 PM Trent Building',
      text: 'Book a meeting with my advisor',
    });

    await parseInputWithAi({
      locale: 'en-US',
      text: combinedRequest,
      timezone: 'Asia/Shanghai',
    });

    const messages = lastRequestInput?.messages as Array<{ content: string; role: string }>;
    expect(messages[0]?.content).toContain('Extracted from image');
    expect(messages[1]?.content).toBe(combinedRequest);
  });
});
