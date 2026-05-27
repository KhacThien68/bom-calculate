import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { createUserSchema, type CreateUserInput } from '@/schemas/user.schema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronRight, UserPlus } from 'lucide-react';

export default function UserCreatePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const {
    register, handleSubmit, control, formState: { errors },
  } = useForm<CreateUserInput>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { username: '', name: '', password: '', role: 'USER' },
  });

  const mut = useMutation({
    mutationFn: async (v: CreateUserInput) => (await api.post('/users', v)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      toast.success('Tạo user thành công');
      navigate('/users');
    },
    onError: (err: any) => {
      if (err?.response?.status === 409) toast.error('Username đã tồn tại');
      else toast.error('Tạo user thất bại');
    },
  });

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm text-muted-foreground">
        <Link to="/users" className="hover:text-foreground transition-colors">Quản lý user</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground font-medium">Tạo user mới</span>
      </nav>

      <Card className="max-w-md shadow-card">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <UserPlus className="h-4 w-4 text-primary" />
            </div>
            <CardTitle>Tạo user mới</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit((v) => mut.mutate(v))} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input id="username" placeholder="Nhập username" {...register('username')} />
              {errors.username && <p className="text-sm text-destructive">{errors.username.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Tên</Label>
              <Input id="name" placeholder="Nhập tên hiển thị" {...register('name')} />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Mật khẩu</Label>
              <Input id="password" type="password" placeholder="••••••••" {...register('password')} />
              {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Controller
                name="role"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USER">USER</SelectItem>
                      <SelectItem value="ADMIN">ADMIN</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="submit" className="gradient-primary text-white" disabled={mut.isPending}>
                {mut.isPending ? 'Đang tạo…' : 'Tạo user'}
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate('/users')}>Huỷ</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
