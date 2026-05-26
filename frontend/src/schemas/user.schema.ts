import { z } from 'zod';

export const createUserSchema = z.object({
  username: z.string().min(1, 'Bắt buộc'),
  name: z.string().min(1, 'Bắt buộc'),
  password: z
    .string()
    .min(6, 'Tối thiểu 6 ký tự')
    .regex(/^(?=.*[A-Za-z])(?=.*\d).+$/, 'Phải có cả chữ và số'),
  role: z.enum(['USER', 'ADMIN']),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;
