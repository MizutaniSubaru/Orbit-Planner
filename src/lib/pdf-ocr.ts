import { normalizeOcrText } from '@/lib/image-ocr';

export const DEFAULT_MAX_PDF_PAGES = 40;

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

type PdfTextToken = {
    height: number;
    text: string;
    width: number;
    x: number;
    y: number;
};

type LineGroup = {
    height: number;
    tokens: PdfTextToken[];
    y: number;
};

function extractPdfTextToken(item: unknown): PdfTextToken | null {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
        return null;
    }

    const value = item as {
        height?: unknown;
        str?: unknown;
        transform?: unknown;
        width?: unknown;
    };

    if (typeof value.str !== 'string') {
        return null;
    }

    const text = value.str.replace(/\s+/g, ' ').trim();
    if (!text) {
        return null;
    }

    const transform = Array.isArray(value.transform) ? value.transform : [];
    const x = typeof transform[4] === 'number' ? transform[4] : 0;
    const y = typeof transform[5] === 'number' ? transform[5] : 0;
    const width = typeof value.width === 'number' ? Math.max(0, value.width) : 0;
    const height = typeof value.height === 'number' ? Math.max(0, value.height) : 0;

    return {
        height,
        text,
        width,
        x,
        y,
    };
}

function estimateCharWidth(token: PdfTextToken) {
    return Math.max(1.8, token.width / Math.max(token.text.length, 1));
}

function normalizeLineText(text: string) {
    return text
        .replace(/\s+/g, ' ')
        .replace(/\s+([,.;:!?])/g, '$1')
        .replace(/([\[(])\s+/g, '$1')
        .replace(/\s+([\])])/g, '$1')
        .trim();
}

function shouldInsertSpace(previousToken: PdfTextToken, currentToken: PdfTextToken, gap: number) {
    if (gap <= 0.5) {
        return false;
    }

    if (previousToken.text === '=' || currentToken.text === '=') {
        return true;
    }

    if (/^[+\-*/=]$/.test(previousToken.text) || /^[+\-*/=]$/.test(currentToken.text)) {
        return true;
    }

    const previousEnd = previousToken.text.slice(-1);
    const currentStart = currentToken.text[0];

    if (/[([{]/.test(previousEnd) || /[)\]},.;:!?]/.test(currentStart)) {
        return false;
    }

    const threshold = Math.min(
        6,
        Math.max(1.8, Math.min(estimateCharWidth(previousToken), estimateCharWidth(currentToken)) * 0.55)
    );

    return gap >= threshold;
}

function splitLineByLargeGaps(tokens: PdfTextToken[]) {
    if (!tokens.length) {
        return [];
    }

    const segments: string[] = [];
    let current = tokens[0].text;

    for (let index = 1; index < tokens.length; index += 1) {
        const previous = tokens[index - 1];
        const token = tokens[index];
        const previousEndX = previous.x + Math.max(previous.width, estimateCharWidth(previous) * previous.text.length);
        const gap = token.x - previousEndX;
        const averageWidth = Math.min(6, Math.max(1.8, Math.min(estimateCharWidth(previous), estimateCharWidth(token))));
        const isLikelyColumnBreak = gap > Math.max(34, averageWidth * 16);

        if (isLikelyColumnBreak) {
            const normalized = normalizeLineText(current);
            if (normalized) {
                segments.push(normalized);
            }

            current = token.text;
            continue;
        }

        if (shouldInsertSpace(previous, token, gap) && !current.endsWith(' ')) {
            current += ' ';
        }

        current += token.text;
    }

    const normalized = normalizeLineText(current);
    if (normalized) {
        segments.push(normalized);
    }

    return segments;
}

function getLineTolerance(group: LineGroup, token: PdfTextToken) {
    return Math.max(2.2, group.height * 0.45, token.height * 0.45);
}

export function reconstructPdfLines(items: unknown[]) {
    const tokens = items
        .map((item) => extractPdfTextToken(item))
        .filter((token): token is PdfTextToken => Boolean(token))
        .sort((left, right) => {
            const yDelta = right.y - left.y;
            if (Math.abs(yDelta) > 0.5) {
                return yDelta;
            }

            return left.x - right.x;
        });

    const groups: LineGroup[] = [];

    for (const token of tokens) {
        let targetIndex = -1;
        let bestDistance = Number.POSITIVE_INFINITY;

        for (let index = 0; index < groups.length; index += 1) {
            const group = groups[index];
            const distance = Math.abs(token.y - group.y);
            if (distance <= getLineTolerance(group, token) && distance < bestDistance) {
                targetIndex = index;
                bestDistance = distance;
            }
        }

        if (targetIndex < 0) {
            groups.push({
                height: token.height,
                tokens: [token],
                y: token.y,
            });
            continue;
        }

        const group = groups[targetIndex];
        group.tokens.push(token);

        const count = group.tokens.length;
        group.y = (group.y * (count - 1) + token.y) / count;
        group.height = (group.height * (count - 1) + token.height) / count;
    }

    return groups
        .sort((left, right) => right.y - left.y)
        .flatMap((group) =>
            splitLineByLargeGaps(group.tokens.sort((left, right) => left.x - right.x))
        )
        .map((line) => normalizeLineText(line))
        .filter(Boolean);
}

function normalizeBoilerplateKey(line: string) {
    return line
        .toLowerCase()
        .replace(/\d+\s*\/\s*\d+/g, '<page>')
        .replace(/\blecture\s*\d+\b/g, 'lecture <n>')
        .replace(/\bslide\s*\d+\b/g, 'slide <n>')
        .replace(/\s+/g, ' ')
        .trim();
}

function looksLikeBoilerplate(line: string) {
    const normalized = line.trim().toLowerCase();
    if (!normalized) {
        return true;
    }

    if (PLACEHOLDER_LINE_PATTERNS.some((pattern) => pattern.test(normalized))) {
        return true;
    }

    if (/^(lecture|slide|page)\b/.test(normalized)) {
        return true;
    }

    if (normalized.length <= 42 && /^[a-z]{2,}\d{2,}(\s+\d{4})?$/.test(normalized)) {
        return true;
    }

    return false;
}

export function removeRepeatedPdfBoilerplate(pageLines: string[][]) {
    if (!pageLines.length) {
        return [];
    }

    const appearanceCount = new Map<string, number>();

    for (const lines of pageLines) {
        const seen = new Set<string>();

        for (const line of lines) {
            const key = normalizeBoilerplateKey(line);
            if (!key || seen.has(key)) {
                continue;
            }

            seen.add(key);
            appearanceCount.set(key, (appearanceCount.get(key) ?? 0) + 1);
        }
    }

    const threshold = Math.max(2, Math.ceil(pageLines.length * 0.6));
    const frequentBoilerplate = new Set(
        [...appearanceCount.entries()]
            .filter(([key, count]) => count >= threshold && looksLikeBoilerplate(key))
            .map(([key]) => key)
    );

    return pageLines.map((lines) =>
        lines.filter((line) => {
            const normalized = line.trim();
            if (!normalized || looksLikeBoilerplate(normalized)) {
                return false;
            }

            return !frequentBoilerplate.has(normalizeBoilerplateKey(normalized));
        })
    );
}

function isPlaceholderLine(line: string) {
    const normalized = line.trim();
    if (!normalized) {
        return true;
    }

    return PLACEHOLDER_LINE_PATTERNS.some((pattern) => pattern.test(normalized));
}

export async function extractPdfTextWithOcr(input: {
    locale: string;
    maxPages?: number;
    pdfData: Uint8Array;
    scale?: number;
}) {
    const maxPages = Math.max(1, Math.floor(input.maxPages ?? DEFAULT_MAX_PDF_PAGES));
    // Locale is kept in the API contract for future OCR-language expansion.
    void input.locale;
    void input.scale;

    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const loadingTask = pdfjs.getDocument({
        data: input.pdfData,
        isEvalSupported: false,
        stopAtErrors: true,
        useSystemFonts: true,
    });

    const document = await loadingTask.promise;
    const pageCount = document.numPages;

    if (pageCount > maxPages) {
        await document.destroy();
        throw new Error(`PDF exceeds the ${maxPages}-page limit.`);
    }

    const pageLines: string[][] = [];

    try {
        for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
            const page = await document.getPage(pageNumber);

            try {
                const content = await page.getTextContent();
                const textLines = reconstructPdfLines(content.items)
                    .map((line) => normalizeOcrText(line))
                    .map((line) => line.trim())
                    .filter((line) => line && !isPlaceholderLine(line));

                pageLines.push(textLines);
            } finally {
                page.cleanup();
            }
        }
    } finally {
        await document.destroy();
    }

    const cleanedPages = removeRepeatedPdfBoilerplate(pageLines);
    const pageTexts = cleanedPages
        .map((lines) => lines.join('\n'))
        .filter(Boolean);

    return {
        pageCount,
        processedPages: pageCount,
        text: normalizeOcrText(pageTexts.join('\n\n')),
    };
}
