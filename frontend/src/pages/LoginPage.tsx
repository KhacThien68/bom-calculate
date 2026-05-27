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
    <div className="min-h-screen flex">
      {/* Left panel - branding */}
      <div className="hidden lg:flex lg:w-1/2 gradient-primary items-center justify-center p-12">
        <div className="text-white max-w-md space-y-6">
          <div className="h-16 w-16 rounded-2xl bg-white/20 flex items-center justify-center">
            <span className="text-3xl font-bold">B</span>
          </div>
          <h1 className="text-4xl font-bold leading-tight">BOM Calculate</h1>
          <p className="text-lg text-white/80">
            Quản lý Bill of Materials chuyên nghiệp. Upload, so sánh và cập nhật BOM dễ dàng.
          </p>
        </div>
      </div>

      {/* Right panel - login form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-gradient-to-br from-slate-50 to-blue-50/30">
        <Card className="w-full max-w-sm shadow-card">
          <CardHeader className="space-y-1 pb-4">
            <div className="lg:hidden flex items-center gap-2 mb-4">
              <div className="h-8 w-8 rounded-lg gradient-primary flex items-center justify-center">
                <span className="text-white font-bold text-sm">B</span>
              </div>
              <span className="font-bold text-lg">BOM Calculate</span>
            </div>
            <CardTitle className="text-2xl">Đăng nhập</CardTitle>
            <p className="text-sm text-muted-foreground">Nhập thông tin để truy cập hệ thống</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit((v) => login.mutate(v))} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Tên đăng nhập</Label>
                <Input id="username" autoFocus placeholder="Nhập username" {...register('username')} />
                {errors.username && <p className="text-sm text-destructive">{errors.username.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Mật khẩu</Label>
                <Input id="password" type="password" placeholder="••••••••" {...register('password')} />
                {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
              </div>
              <Button type="submit" className="w-full gradient-primary text-white" disabled={login.isPending}>
                {login.isPending ? 'Đang đăng nhập…' : 'Đăng nhập'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
