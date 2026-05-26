import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Navigate, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useMe } from '@/hooks/useMe';
import { loginSchema, type LoginInput } from '@/schemas/auth.schema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function LoginPage() {
  const { data: me, isLoading } = useMe();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { register, handleSubmit, formState: { errors } } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: '', password: '' },
  });

  const login = useMutation({
    mutationFn: async (input: LoginInput) => {
      const { data } = await api.post('/auth/login', input);
      return data.user;
    },
    onSuccess: (user) => {
      qc.setQueryData(['me'], user);
      navigate('/', { replace: true });
    },
    onError: () => {
      toast.error('Đăng nhập thất bại');
    },
  });

  if (isLoading) return null;
  if (me) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40">
      <Card className="w-full max-w-sm">
        <CardHeader><CardTitle>Đăng nhập</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit((v) => login.mutate(v))} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="username">Tên đăng nhập</Label>
              <Input id="username" autoFocus {...register('username')} />
              {errors.username && <p className="text-sm text-destructive">{errors.username.message}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="password">Mật khẩu</Label>
              <Input id="password" type="password" {...register('password')} />
              {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
            </div>
            <Button type="submit" className="w-full" disabled={login.isPending}>
              {login.isPending ? 'Đang đăng nhập…' : 'Đăng nhập'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
