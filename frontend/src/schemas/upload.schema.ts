import { z } from 'zod';

export const selectStepSchema = z.object({
  mode: z.enum(['full', 'append']),
  materialCode: z.string().min(1, 'Bắt buộc'),
  materialDescription: z.string().min(1, 'Bắt buộc'),
});
export type SelectStepInput = z.infer<typeof selectStepSchema>;
