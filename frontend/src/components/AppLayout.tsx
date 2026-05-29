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
import { LayoutDashboard, Upload, Users, ChevronDown, LogOut, KeyRound, Package } from 'lucide-react';

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
    'flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors duration-150';
  const navDefault = 'text-muted-foreground hover:text-foreground hover:bg-accent';
  const navActive = 'text-primary bg-primary/10';

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 border-b bg-white/80 backdrop-blur-md">
        <div className="w-full px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg gradient-primary flex items-center justify-center">
                <span className="text-white font-bold text-sm">B</span>
              </div>
              <span className="font-bold text-lg tracking-tight">BOM Calculate</span>
            </Link>
            <nav className="flex items-center gap-1">
              <NavLink
                to="/"
                end
                className={({ isActive }) => cn(navItem, isActive ? navActive : navDefault)}
              >
                <LayoutDashboard className="h-4 w-4" />
                Danh sách BOM
              </NavLink>
              <NavLink
                to="/upload"
                className={({ isActive }) => cn(navItem, isActive ? navActive : navDefault)}
              >
                <Upload className="h-4 w-4" />
                Upload
              </NavLink>
              <NavLink
                to="/materials"
                className={({ isActive }) => cn(navItem, isActive ? navActive : navDefault)}
              >
                <Package className="h-4 w-4" />
                Vật tư
              </NavLink>
              {me?.role === 'ADMIN' && (
                <NavLink
                  to="/users"
                  className={({ isActive }) => cn(navItem, isActive ? navActive : navDefault)}
                >
                  <Users className="h-4 w-4" />
                  Quản lý user
                </NavLink>
              )}
            </nav>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2 px-3">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-sm font-semibold text-primary">
                    {(me?.name ?? me?.username ?? '?')[0].toUpperCase()}
                  </span>
                </div>
                <span className="text-sm font-medium">{me?.name ?? me?.username}</span>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => navigate('/account/change-password')}>
                <KeyRound className="h-4 w-4 mr-2" />
                Đổi mật khẩu
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => logout.mutate()} className="text-destructive focus:text-destructive">
                <LogOut className="h-4 w-4 mr-2" />
                Đăng xuất
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      <main className="w-full px-4 sm:px-6 lg:px-8 flex-1 py-8">
        <Outlet />
      </main>
    </div>
  );
}
