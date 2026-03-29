import { NextResponse } from 'next/server';
import { requestAiJson } from '@/lib/ai-provider';
import { extractPdfTextWithOcr } from '@/lib/pdf-ocr';

export const runtime = 'nodejs';

const MAX_PDF_BYTES = 20 * 1024 * 1024;
const MAX_PDF_PAGES = 40;
const MAX_AI_SOURCE_CHARS = 50_000;

const PLACEHOLDER_LINE_PATTERNS = [
    /^dummy\s*pdf\s*file$/i,
    /^sample\s*(pdf|document|file)$/i,
    /^page\s*\d+\s*(of\s*\d+)?$/i,
    /^slide\s*\d+\s*(of\s*\d+)?$/i,
    /^lecture\s*\d+$/i,
    /^\d+\s*\/\s*\d+$/,
    /^[a-z]{2,}\d{2,}(\s+\d{4})?$/i,
    /^confidential$/i,
    /^copyright\b/i,
] as const;

const CONCEPT_KEYWORDS = [
    'derivative',
    'differentiation',
    'linearity',
    'product rule',
    'quotient rule',
    'chain rule',
    'implicit',
    'inverse function',
    'core concept',
    '\u5bfc\u6570',
    '\u5fae\u5206',
    '\u6cd5\u5219',
    '\u94fe\u5f0f',
    '\u9690\u51fd\u6570',
] as const;

const PROBLEM_KEYWORDS = [
    'problem',
    'exercise',
    'example',
    'compute',
    'find',
    'evaluate',
    '\u4f8b\u9898',
    '\u4e60\u9898',
    '\u8ba1\u7b97',
    '\u6c42',
] as const;

type NotesAiPayload = {
    markdown?: string;
};

function normalizeLocale(value: unknown) {
    if (typeof value !== 'string' || !value.trim()) {
        return 'en-US';
    }

    return value;
}

function isPdfFile(file: File) {
    const lowerName = file.name.toLowerCase();
    return file.type === 'application/pdf' || lowerName.endsWith('.pdf');
}

function normalizeSourceLine(line: string) {
    return line.replace(/\s+/g, ' ').trim();
}

function dedupeLines(lines: string[]) {
    const result: string[] = [];
    const seen = new Set<string>();

    for (const line of lines) {
        const normalized = normalizeSourceLine(line);
        if (!normalized) {
            continue;
        }

        const key = normalized.toLowerCase();
        if (seen.has(key)) {
            continue;
        }

        seen.add(key);
        result.push(normalized);
    }

    return result;
}

function detectDominantLanguage(sourceText: string, locale: string) {
    const chineseCharacters = sourceText.match(/[\u4e00-\u9fff]/g)?.length ?? 0;
    if (chineseCharacters >= Math.max(8, Math.floor(sourceText.length * 0.03))) {
        return 'zh';
    }

    return locale.startsWith('zh') ? 'zh' : 'en';
}

function isLowValueLine(line: string) {
    const normalized = line.trim().toLowerCase();
    if (!normalized) {
        return true;
    }

    if (PLACEHOLDER_LINE_PATTERNS.some((pattern) => pattern.test(normalized))) {
        return true;
    }

    if (/^\d+$/.test(normalized)) {
        return true;
    }

    if (normalized.length <= 2 && !/[a-z0-9\u4e00-\u9fff]/i.test(normalized)) {
        return true;
    }

    return false;
}

function isFormulaLine(line: string) {
    const normalized = line.trim();
    if (!normalized) {
        return false;
    }

    return (
        /\bdy\s*\/\s*dx\b/i.test(normalized) ||
        /\bd\s*\/\s*d[xyt]\b/i.test(normalized) ||
        /\b(sin|cos|tan|ln|log|exp)\b/i.test(normalized) ||
        /[=+\-*/^]/.test(normalized)
    );
}

function isProblemLine(line: string) {
    const normalized = line.toLowerCase();
    return PROBLEM_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

function isConceptLine(line: string) {
    const normalized = line.toLowerCase();
    return CONCEPT_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

function isLikelyTopicLine(line: string) {
    if (isLowValueLine(line) || isFormulaLine(line)) {
        return false;
    }

    return line.length >= 4 && line.length <= 90;
}

function pickLines(lines: string[], predicate: (line: string) => boolean, maxItems: number) {
    const result: string[] = [];

    for (const line of lines) {
        if (!predicate(line)) {
            continue;
        }

        result.push(line);
        if (result.length >= maxItems) {
            break;
        }
    }

    return result;
}

function smartTruncateSourceText(sourceText: string, maxChars: number) {
    if (sourceText.length <= maxChars) {
        return {
            text: sourceText,
            truncated: false,
        };
    }

    const minBoundary = Math.floor(maxChars * 0.6);
    const candidate = sourceText.slice(0, maxChars + 1200);
    const boundaryHints = ['\n\n', '\n', '. ', '; ', ': ', '\u3002', '\uff1b', '\uff1a'];

    let cutIndex = -1;
    for (const hint of boundaryHints) {
        const boundary = candidate.lastIndexOf(hint, maxChars);
        if (boundary >= minBoundary && boundary > cutIndex) {
            cutIndex = boundary + hint.length;
        }
    }

    if (cutIndex < 0) {
        const whitespace = candidate.lastIndexOf(' ', maxChars);
        if (whitespace >= minBoundary) {
            cutIndex = whitespace;
        }
    }

    if (cutIndex < 0) {
        cutIndex = maxChars;
    }

    return {
        text: sourceText.slice(0, cutIndex).trim(),
        truncated: true,
    };
}

function isPlaceholderOnlyText(text: string) {
    const lines = text
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);

    if (lines.length === 0) {
        return true;
    }

    return lines.every((line) => PLACEHOLDER_LINE_PATTERNS.some((pattern) => pattern.test(line)));
}

function parseNotesPayload(content: string | null) {
    if (!content) {
        return null;
    }

    try {
        const payload = JSON.parse(content) as NotesAiPayload;
        if (typeof payload.markdown !== 'string' || !payload.markdown.trim()) {
            return null;
        }

        return {
            markdown: payload.markdown.trim(),
        };
    } catch {
        return null;
    }
}

function buildNotesSystemPrompt(input: {
    locale: string;
    sourceText: string;
}) {
    const isChinese = detectDominantLanguage(input.sourceText, input.locale) === 'zh';
    const outputLanguage = isChinese
        ? 'Simplified Chinese'
        : 'English';

    const requiredSections = isChinese
        ? [
            '## 1. \u4e3b\u9898\u5bfc\u56fe',
            '## 2. \u6838\u5fc3\u89c4\u5219\u4e0e\u6982\u5ff5',
            '## 3. \u5173\u952e\u516c\u5f0f\u4e0e\u7ed3\u8bba',
            '## 4. \u5e38\u89c1\u9898\u578b',
            '## 5. \u901f\u67e5\u6e05\u5355',
        ]
        : [
            '## 1. Topic Map',
            '## 2. Core Rules and Concepts',
            '## 3. Key Formulas and Conclusions',
            '## 4. Typical Question Patterns',
            '## 5. Quick Review Checklist',
        ];

    return [
        'You are an academic teaching assistant writing exam-review notes for university students.',
        'The source text comes from slides and may contain broken line artifacts.',
        'Reconstruct fragmented lines into readable sentences and formulas before summarizing.',
        'Use ONLY information from the courseware text. Do not add outside facts or assumptions.',
        'Focus on examinable content: definitions, rules, key formulas, and typical problem patterns.',
        'Keep key formulas and final conclusions, and remove repeated slide boilerplate.',
        'Do NOT mention AI, OCR, extraction, prompt, model, or implementation details.',
        'Write as a teaching note, not as a technical report.',
        'Explain briefly but clearly, and use bullets when it improves revision speed.',
        `Use these section headings when information is available: ${requiredSections.join(' | ')}.`,
        'If a section has no reliable content, omit that section instead of guessing.',
        'Do not include meta commentary such as "based on provided text".',
        'The output language must follow the dominant language of the source text.',
        `Write the markdown in ${outputLanguage}.`,
        'Return ONLY a JSON object with exactly one key: markdown.',
    ].join(' ');
}

function buildFallbackMarkdown(input: {
    locale: string;
    sourceText: string;
}) {
    const isChinese = detectDominantLanguage(input.sourceText, input.locale) === 'zh';
    const cleanedLines = dedupeLines(
        input.sourceText
            .split('\n')
            .map((line) => normalizeSourceLine(line))
            .filter(Boolean)
            .filter((line) => !isLowValueLine(line))
    ).slice(0, 320);

    const topicMap = pickLines(cleanedLines, (line) => isLikelyTopicLine(line) && !isProblemLine(line), 6);
    const concepts = pickLines(
        cleanedLines,
        (line) => isConceptLine(line) && !isProblemLine(line) && !isFormulaLine(line),
        10
    );
    const keyFormulas = pickLines(cleanedLines, (line) => isFormulaLine(line), 10);
    const questionPatterns = pickLines(cleanedLines, (line) => isProblemLine(line), 8);

    const fallbackTopicMap = topicMap.length
        ? topicMap
        : cleanedLines.slice(0, Math.min(6, cleanedLines.length));

    const fallbackConcepts = concepts.length
        ? concepts
        : cleanedLines.filter((line) => !isFormulaLine(line) && !isProblemLine(line)).slice(0, 8);

    const fallbackFormulas = keyFormulas.length
        ? keyFormulas
        : [
            isChinese
                ? '\u672a\u68c0\u7d22\u5230\u53ef\u786e\u8ba4\u7684\u5173\u952e\u516c\u5f0f\uff0c\u8bf7\u5bf9\u7167\u539f\u6587\u8865\u5145\u3002'
                : 'No reliable key formulas were detected. Please verify formulas directly from the source slides.',
        ];

    const fallbackPatterns = questionPatterns.length
        ? questionPatterns
        : [
            isChinese
                ? '\u4ece\u8bfe\u4ef6\u4e2d\u63d0\u53d6\u201c\u6c42\u5bfc\u3001\u6c42\u503c\u3001\u5957\u7528\u6cd5\u5219\u201d\u7c7b\u9898\u578b\u8fdb\u884c\u7ec3\u4e60\u3002'
                : 'Extract and practise question types such as compute, evaluate, and apply-rule exercises.',
        ];

    const sectionTitle = isChinese
        ? {
            concepts: '## 2. \u6838\u5fc3\u89c4\u5219\u4e0e\u6982\u5ff5',
            formulas: '## 3. \u5173\u952e\u516c\u5f0f\u4e0e\u7ed3\u8bba',
            header: '# \u8bfe\u4ef6\u590d\u4e60\u7b14\u8bb0\uff08\u81ea\u52a8\u6574\u7406\uff09',
            patterns: '## 4. \u5e38\u89c1\u9898\u578b',
            review: '## 5. \u901f\u67e5\u6e05\u5355',
            topicMap: '## 1. \u4e3b\u9898\u5bfc\u56fe',
        }
        : {
            concepts: '## 2. Core Rules and Concepts',
            formulas: '## 3. Key Formulas and Conclusions',
            header: '# Courseware Notes (Exam Review)',
            patterns: '## 4. Typical Question Patterns',
            review: '## 5. Quick Review Checklist',
            topicMap: '## 1. Topic Map',
        };

    const checklist = isChinese
        ? [
            '- [ ] \u80fd\u53e3\u8ff0\u6bcf\u6761\u6cd5\u5219\u7684\u9002\u7528\u6761\u4ef6',
            '- [ ] \u80fd\u72ec\u7acb\u5199\u51fa\u5173\u952e\u516c\u5f0f\u5e76\u68c0\u67e5\u7b26\u53f7\u6b63\u8bef',
            '- [ ] \u5bf9\u6bcf\u79cd\u9898\u578b\u81f3\u5c11\u5b8c\u6210\u4e24\u9898\u7ec3\u4e60',
        ]
        : [
            '- [ ] Explain when each rule should be applied',
            '- [ ] Reproduce key formulas with correct signs and notation',
            '- [ ] Complete at least two practice questions per question type',
        ];

    const toBullets = (lines: string[]) => lines.map((line) => `- ${line}`).join('\n');

    return [
        sectionTitle.header,
        '',
        sectionTitle.topicMap,
        toBullets(fallbackTopicMap),
        '',
        sectionTitle.concepts,
        toBullets(fallbackConcepts),
        '',
        sectionTitle.formulas,
        toBullets(fallbackFormulas),
        '',
        sectionTitle.patterns,
        toBullets(fallbackPatterns),
        '',
        sectionTitle.review,
        checklist.join('\n'),
    ].join('\n');
}

export async function POST(request: Request) {
    try {
        const contentType = request.headers.get('content-type') || '';
        if (!contentType.toLowerCase().includes('multipart/form-data')) {
            return NextResponse.json(
                { error: 'multipart/form-data is required.' },
                { status: 415 }
            );
        }

        const formData = await request.formData();
        const locale = normalizeLocale(formData.get('locale'));
        const file = formData.get('file');

        if (!(file instanceof File)) {
            return NextResponse.json({ error: 'PDF file is required.' }, { status: 400 });
        }

        if (!isPdfFile(file)) {
            return NextResponse.json({ error: 'Only PDF files are supported.' }, { status: 400 });
        }

        if (file.size <= 0) {
            return NextResponse.json({ error: 'Uploaded file is empty.' }, { status: 400 });
        }

        if (file.size > MAX_PDF_BYTES) {
            return NextResponse.json(
                { error: `PDF is too large. Limit: ${Math.floor(MAX_PDF_BYTES / (1024 * 1024))}MB.` },
                { status: 400 }
            );
        }

        const buffer = await file.arrayBuffer();
        const ocrResult = await extractPdfTextWithOcr({
            locale,
            maxPages: MAX_PDF_PAGES,
            pdfData: new Uint8Array(buffer),
        });

        const sourceText = ocrResult.text.trim();
        if (!sourceText || isPlaceholderOnlyText(sourceText)) {
            return NextResponse.json(
                { error: 'OCR did not produce readable text from this PDF.' },
                { status: 422 }
            );
        }

        const truncatedSource = smartTruncateSourceText(sourceText, MAX_AI_SOURCE_CHARS);
        const aiSourceText = truncatedSource.text;

        let aiPayload: { markdown: string } | null = null;
        try {
            aiPayload = await requestAiJson<{ markdown: string }>({
                messages: [
                    {
                        content: buildNotesSystemPrompt({
                            locale,
                            sourceText: aiSourceText,
                        }),
                        role: 'system',
                    },
                    {
                        content: [
                            'Extracted courseware text:',
                            aiSourceText,
                            '',
                            truncatedSource.truncated
                                ? '[Note] The source text is truncated at a semantic boundary due to length limits.'
                                : '',
                        ]
                            .filter(Boolean)
                            .join('\n'),
                        role: 'user',
                    },
                ],
                parse: parseNotesPayload,
                task: 'notes',
            });
        } catch {
            aiPayload = null;
        }

        const markdown = aiPayload?.markdown || buildFallbackMarkdown({ locale, sourceText });

        return NextResponse.json({
            markdown,
            mode: aiPayload?.markdown ? 'ai' : 'fallback',
            source: {
                charCount: sourceText.length,
                fileName: file.name,
                pageCount: ocrResult.pageCount,
                processedPages: ocrResult.processedPages,
            },
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to generate notes from PDF.';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
