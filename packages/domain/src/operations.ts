import { z } from 'zod';
export const textInputSchema = z.strictObject({ text: z.string().min(1).max(30000) });
export const textOutputSchema = z.strictObject({
  characters: z.number().int().nonnegative(), words: z.number().int().nonnegative(),
  uniqueWords: z.number().int().nonnegative(), readingSeconds: z.number().int().nonnegative(),
  topWords: z.array(z.strictObject({ word: z.string(), count: z.number().int().positive() })).max(10),
});
export const jsonInputSchema = z.strictObject({
  records: z.array(z.record(z.string().max(100), z.json())).max(100),
  select: z.array(z.string().min(1).max(100)).min(1).max(20),
});
export const jsonOutputSchema = z.strictObject({ records: z.array(z.record(z.string(), z.json())).max(100) });
export const operationSchemas = {
  'text.analyze': { input: textInputSchema, output: textOutputSchema },
  'json.transform': { input: jsonInputSchema, output: jsonOutputSchema },
};
