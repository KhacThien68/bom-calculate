import { Navigate, Outlet } from 'react-router-dom';
import { useMe } from '@/hooks/useMe';

export function ProtectedRoute() {
  const { data, isLoading } = useMe();
  if (isLoading) return <div className="p-8">Loading…</div>;
  if (!data) return <Navigate to="/login" replace />;
  return <Outlet />;
}
