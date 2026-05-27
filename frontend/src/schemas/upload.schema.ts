import { z } from 'zod';

export const selectStepSchema = z.object({
  mode: z.enum(['full', 'append']),
});
export type SelectStepInput = z.infer<typeof selectStepSchema>;
