import { z } from 'zod';

export const loginSchema = z.object({
  username: z.string().min(1, 'Bắt buộc'),
  password: z.string().min(1, 'Bắt buộc'),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Bắt buộc'),
    newPassword: z
      .string()
      .min(6, 'Tối thiểu 6 ký tự')
      .regex(/^(?=.*[A-Za-z])(?=.*\d).+$/, 'Phải có cả chữ và số'),
    confirmNewPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmNewPassword, {
    path: ['confirmNewPassword'],
    message: 'Mật khẩu xác nhận không khớp',
  });
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
