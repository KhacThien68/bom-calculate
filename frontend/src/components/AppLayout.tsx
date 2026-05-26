import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMe } from '@/hooks/useMe';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export function AppLayout() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const logout = useMutation({
    mutationFn: async () => {
      await api.post('/auth/logout');
    },
    onSuccess: () => {
      qc.clear();
      navigate('/login', { replace: true });
    },
  });

  const navItem =
    'px-3 py-2 text-sm rounded-md hover:bg-accent hover:text-accent-foreground';
  const active = 'bg-accent text-accent-foreground';

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b">
        <div className="container flex items-center justify-between h-14">
          <div className="flex items-center gap-2">
            <Link to="/" className="font-semibold">BOM Calculate</Link>
            <nav className="ml-4 flex items-center gap-1">
              <NavLink to="/" end className={({ isActive }) => cn(navItem, isActive && active)}>Danh sách BOM</NavLink>
              <NavLink to="/upload" className={({ isActive }) => cn(navItem, isActive && active)}>Upload</NavLink>
              {me?.role === 'ADMIN' && (
                <NavLink to="/users" className={({ isActive }) => cn(navItem, isActive && active)}>Quản lý user</NavLink>
              )}
            </nav>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">{me?.name ?? me?.username}</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => navigate('/account/change-password')}>
                Đổi mật khẩu
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => logout.mutate()}>
                Đăng xuất
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      <main className="container flex-1 py-6"><Outlet /></main>
    </div>
  );
}
