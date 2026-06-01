import { z } from 'zod';

export const materialFormSchema = z.object({
  code: z.string().min(1, 'Mã không được trống'),
  name: z.string().min(1, 'Tên không được trống'),
  uom: z.string().min(1, 'ĐVT không được trống'),
  actualStock: z.coerce.number().min(0),
  standardStock: z.coerce.number().min(0),
  moq: z.union([z.coerce.number().min(0), z.literal('').transform(() => null)]).nullable(),
});

export type MaterialFormInput = z.input<typeof materialFormSchema>;
export type MaterialFormValues = z.output<typeof materialFormSchema>;
