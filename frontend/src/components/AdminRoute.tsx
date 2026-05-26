import { Navigate, Outlet } from 'react-router-dom';
import { useMe } from '@/hooks/useMe';

export function AdminRoute() {
  const { data } = useMe();
  if (data?.role !== 'ADMIN') return <Navigate to="/" replace />;
  return <Outlet />;
}
