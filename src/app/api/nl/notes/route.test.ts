/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { beforeEach, describe, expect, it, mock } from 'bun:test';

let mockOcrText = 'Chapter 1\nBinary search tree\nDefinition and traversal';
let mockPageCount = 8;
let mockAiMarkdown: string | null = null;
let mockAiError: Error | null = null;
let lastAiRequest: Record<string, unknown> | null = null;

mock.module('@/lib/pdf-ocr', () => ({
    extractPdfTextWithOcr: async () => ({
        pageCount: mockPageCount,
        processedPages: mockPageCount,
        text: mockOcrText,
    }),
}));

mock.module('@/lib/ai-provider', () => ({
    requestAiJson: async (request: Record<string, unknown>) => {
        lastAiRequest = request;

        if (mockAiError) {
            throw mockAiError;
        }

        return mockAiMarkdown
            ? {
                markdown: mockAiMarkdown,
            }
            : null;
    },
}));

const { POST } = await import('./route');

beforeEach(() => {
    mockAiError = null;
    mockAiMarkdown = null;
    mockOcrText = 'Chapter 1\nBinary search tree\nDefinition and traversal';
    mockPageCount = 8;
    lastAiRequest = null;
});

describe('/api/nl/notes POST', () => {
    it('rejects non-multipart requests', async () => {
        const response = await POST(
            new Request('http://localhost/api/nl/notes', {
                body: JSON.stringify({ locale: 'en-US' }),
                headers: {
                    'content-type': 'application/json',
                },
                method: 'POST',
            })
        );

        expect(response.status).toBe(415);
    });

    it('rejects non-PDF uploads', async () => {
        const formData = new FormData();
        formData.append('locale', 'en-US');
        formData.append('file', new File(['hello'], 'notes.txt', { type: 'text/plain' }));

        const response = await POST(
            new Request('http://localhost/api/nl/notes', {
                body: formData,
                method: 'POST',
            })
        );

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toMatchObject({
            error: 'Only PDF files are supported.',
        });
    });

    it('returns AI markdown when provider returns a valid payload', async () => {
        mockAiMarkdown = '# Lecture Notes\n\n## Topic Overview\n- Trees and graphs';

        const formData = new FormData();
        formData.append('locale', 'en-US');
        formData.append('file', new File(['%PDF-1.4'], 'slides.pdf', { type: 'application/pdf' }));

        const response = await POST(
            new Request('http://localhost/api/nl/notes', {
                body: formData,
                method: 'POST',
            })
        );

        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload.mode).toBe('ai');
        expect(payload.markdown).toContain('Topic Overview');
        expect(payload.source.pageCount).toBe(8);
    });

    it('falls back to deterministic markdown when AI is unavailable', async () => {
        mockAiMarkdown = null;

        const formData = new FormData();
        formData.append('locale', 'en-US');
        formData.append('file', new File(['%PDF-1.4'], 'lecture.pdf', { type: 'application/pdf' }));

        const response = await POST(
            new Request('http://localhost/api/nl/notes', {
                body: formData,
                method: 'POST',
            })
        );

        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload.mode).toBe('fallback');
        expect(payload.markdown).toContain('# Courseware Notes (Exam Review)');
        expect(payload.markdown).toContain('## 3. Key Formulas and Conclusions');
    });

    it('falls back to deterministic markdown when AI throws invalid-json style errors', async () => {
        mockAiError = new Error('Model returned invalid JSON.');

        const formData = new FormData();
        formData.append('locale', 'en-US');
        formData.append('file', new File(['%PDF-1.4'], 'lecture.pdf', { type: 'application/pdf' }));

        const response = await POST(
            new Request('http://localhost/api/nl/notes', {
                body: formData,
                method: 'POST',
            })
        );

        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload.mode).toBe('fallback');
        expect(payload.markdown).toContain('Courseware Notes (Exam Review)');
    });

    it('removes slide boilerplate and keeps key formulas in fallback notes', async () => {
        mockAiMarkdown = null;
        mockOcrText = [
            'CELEN037 2026',
            'Lecture 2',
            '1 / 33',
            'Product rule',
            "d/dx(u(x)v(x)) = u\'(x)v(x) + u(x)v\'(x)",
            'Problem 4 Compute dy/dx for y = x sin(x)',
        ].join('\n');

        const formData = new FormData();
        formData.append('locale', 'en-US');
        formData.append('file', new File(['%PDF-1.4'], 'lecture.pdf', { type: 'application/pdf' }));

        const response = await POST(
            new Request('http://localhost/api/nl/notes', {
                body: formData,
                method: 'POST',
            })
        );

        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload.mode).toBe('fallback');
        expect(payload.markdown).not.toContain('Lecture 2');
        expect(payload.markdown).not.toContain('1 / 33');
        expect(payload.markdown).toContain('d/dx(u(x)v(x)) = u\'(x)v(x) + u(x)v\'(x)');
    });

    it('follows source language for fallback output', async () => {
        mockAiMarkdown = null;
        mockOcrText = [
            '\u5bfc\u6570\u6cd5\u5219',
            '\u94fe\u5f0f\u6cd5\u5219',
            '\u4f8b\u9898 1 \u8ba1\u7b97\u5bfc\u6570',
            'dy/dx = 2x',
        ].join('\n');

        const formData = new FormData();
        formData.append('locale', 'en-US');
        formData.append('file', new File(['%PDF-1.4'], 'lecture.pdf', { type: 'application/pdf' }));

        const response = await POST(
            new Request('http://localhost/api/nl/notes', {
                body: formData,
                method: 'POST',
            })
        );

        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload.mode).toBe('fallback');
        expect(payload.markdown).toContain('# \u8bfe\u4ef6\u590d\u4e60\u7b14\u8bb0\uff08\u81ea\u52a8\u6574\u7406\uff09');
        expect(payload.markdown).toContain('## 3. \u5173\u952e\u516c\u5f0f\u4e0e\u7ed3\u8bba');
    });

    it('marks AI requests when source text is truncated semantically', async () => {
        mockAiMarkdown = '# notes';
        mockOcrText = Array.from({ length: 5000 }, (_, index) => `Segment ${index}: derivative rules and examples.`).join('\n');

        const formData = new FormData();
        formData.append('locale', 'en-US');
        formData.append('file', new File(['%PDF-1.4'], 'long-lecture.pdf', { type: 'application/pdf' }));

        const response = await POST(
            new Request('http://localhost/api/nl/notes', {
                body: formData,
                method: 'POST',
            })
        );

        expect(response.status).toBe(200);
        expect(lastAiRequest).not.toBeNull();

        const messages = (lastAiRequest?.messages as Array<{ content: string; role: string }>) ?? [];
        const userMessage = messages.find((message) => message.role === 'user')?.content || '';
        expect(userMessage).toContain('truncated at a semantic boundary');
    });

    it('returns 422 when extracted content only contains placeholder text', async () => {
        mockAiError = null;
        mockAiMarkdown = null;
        mockOcrText = 'Dummy PDF file';

        const formData = new FormData();
        formData.append('locale', 'en-US');
        formData.append('file', new File(['%PDF-1.4'], 'placeholder.pdf', { type: 'application/pdf' }));

        const response = await POST(
            new Request('http://localhost/api/nl/notes', {
                body: formData,
                method: 'POST',
            })
        );

        const payload = await response.json();

        expect(response.status).toBe(422);
        expect(payload.error).toContain('readable text');
    });
});
