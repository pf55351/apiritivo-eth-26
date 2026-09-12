import { z } from 'zod';
import { textInputSchema, jsonInputSchema } from '../../domain/src/operations.ts';
export type Operation = { input: z.ZodType; run: (input: unknown, signal: AbortSignal) => Promise<unknown> };
// Actual deterministic APIs executed behind the gateway; they require no upstream API keys.
// Add paid upstreams here with fixed URLs, validated input and AbortSignal support.
export const operations: Record<string, Operation> = {
  'text.analyze': {
    input: textInputSchema,
    async run(input, signal) {
      signal.throwIfAborted();
      const { text } = textInputSchema.parse(input);
      const words = [...new Intl.Segmenter('en', { granularity: 'word' }).segment(text)].filter(s => s.isWordLike).map(s => s.segment.toLowerCase());
      const frequencies = new Map<string, number>();
      for (const word of words) frequencies.set(word, (frequencies.get(word) ?? 0) + 1);
      return { characters: [...text].length, words: words.length, uniqueWords: frequencies.size,
        readingSeconds: Math.ceil(words.length / 200 * 60), topWords: [...frequencies].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([word, count]) => ({ word, count })) };
    },
  },
  'json.transform': {
    input: jsonInputSchema,
    async run(input, signal) {
      signal.throwIfAborted();
      const { records, select } = jsonInputSchema.parse(input);
      return { records: records.map(record => Object.fromEntries(select.filter(key => Object.hasOwn(record, key)).map(key => [key, record[key]]))) };
    },
  },
};
