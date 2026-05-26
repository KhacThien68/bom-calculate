import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { changePasswordSchema, type ChangePasswordInput } from '@/schemas/auth.schema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function ChangePasswordPage() {
  const {
    register, handleSubmit, reset, setError, formState: { errors },
  } = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmNewPassword: '' },
  });

  const mut = useMutation({
    mutationFn: async (v: ChangePasswordInput) => {
      await api.post('/auth/change-password', {
        currentPassword: v.currentPassword,
        newPassword: v.newPassword,
      });
    },
    onSuccess: () => {
      toast.success('Đổi mật khẩu thành công');
      reset();
    },
    onError: (err: any) => {
      if (err?.response?.status === 400) {
        setError('currentPassword', { message: 'Mật khẩu hiện tại không đúng' });
      } else {
        toast.error('Đổi mật khẩu thất bại');
      }
    },
  });

  return (
    <Card className="max-w-md">
      <CardHeader><CardTitle>Đổi mật khẩu</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit((v) => mut.mutate(v))} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="currentPassword">Mật khẩu hiện tại</Label>
            <Input id="currentPassword" type="password" {...register('currentPassword')} />
            {errors.currentPassword && <p className="text-sm text-destructive">{errors.currentPassword.message}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="newPassword">Mật khẩu mới</Label>
            <Input id="newPassword" type="password" {...register('newPassword')} />
            {errors.newPassword && <p className="text-sm text-destructive">{errors.newPassword.message}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="confirmNewPassword">Xác nhận mật khẩu mới</Label>
            <Input id="confirmNewPassword" type="password" {...register('confirmNewPassword')} />
            {errors.confirmNewPassword && <p className="text-sm text-destructive">{errors.confirmNewPassword.message}</p>}
          </div>
          <Button type="submit" disabled={mut.isPending}>
            {mut.isPending ? 'Đang lưu…' : 'Lưu'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
