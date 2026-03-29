import { describe, expect, it } from 'bun:test';
import { reconstructPdfLines, removeRepeatedPdfBoilerplate } from '@/lib/pdf-ocr';

describe('pdf text reconstruction', () => {
    it('rebuilds readable lines from positioned tokens', () => {
        const items = [
            { height: 12, str: 'Derivative', transform: [1, 0, 0, 1, 12, 700], width: 46 },
            { height: 12, str: 'rules', transform: [1, 0, 0, 1, 64, 700], width: 22 },
            { height: 12, str: 'd/dx(sin(x))', transform: [1, 0, 0, 1, 12, 680], width: 68 },
            { height: 12, str: '=', transform: [1, 0, 0, 1, 84, 680], width: 6 },
            { height: 12, str: 'cos(x)', transform: [1, 0, 0, 1, 96, 680], width: 30 },
        ];

        const lines = reconstructPdfLines(items);

        expect(lines).toEqual(['Derivative rules', 'd/dx(sin(x)) = cos(x)']);
    });

    it('splits likely multi-column content instead of merging distant tokens', () => {
        const items = [
            { height: 12, str: 'Chain rule', transform: [1, 0, 0, 1, 10, 620], width: 58 },
            { height: 12, str: 'Problem 5', transform: [1, 0, 0, 1, 420, 620], width: 54 },
        ];

        const lines = reconstructPdfLines(items);

        expect(lines).toEqual(['Chain rule', 'Problem 5']);
    });
});

describe('pdf boilerplate cleanup', () => {
    it('removes repeated lecture headers while keeping unique content', () => {
        const pages = [
            ['CELEN037 2026', 'Lecture 2', 'Derivatives of standard functions'],
            ['CELEN037 2026', 'Lecture 2', 'The product rule'],
            ['CELEN037 2026', 'Lecture 2', 'The chain rule'],
        ];

        const cleaned = removeRepeatedPdfBoilerplate(pages);

        expect(cleaned).toEqual([
            ['Derivatives of standard functions'],
            ['The product rule'],
            ['The chain rule'],
        ]);
    });
});
