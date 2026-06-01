import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AdminRoute } from '@/components/AdminRoute';
import { AppLayout } from '@/components/AppLayout';
import LoginPage from '@/pages/LoginPage';
import BomListPage from '@/pages/BomListPage';
import BomDetailPage from '@/pages/BomDetailPage';
import UploadPage from '@/pages/UploadPage';
import UsersPage from '@/pages/UsersPage';
import UserCreatePage from '@/pages/UserCreatePage';
import ChangePasswordPage from '@/pages/ChangePasswordPage';
import MaterialsPage from '@/pages/MaterialsPage';
import MaterialFormPage from '@/pages/MaterialFormPage';
import MaterialUploadPage from '@/pages/MaterialUploadPage';
import MrpPage from '@/pages/MrpPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route index element={<BomListPage />} />
            <Route path="upload" element={<UploadPage />} />
            <Route path="materials" element={<MaterialsPage />} />
            <Route path="materials/new" element={<MaterialFormPage />} />
            <Route path="materials/upload" element={<MaterialUploadPage />} />
            <Route path="materials/:id" element={<MaterialFormPage />} />
            <Route path="bom/:materialCode" element={<BomDetailPage />} />
            <Route path="mrp" element={<MrpPage />} />
            <Route
              path="account/change-password"
              element={<ChangePasswordPage />}
            />
            <Route element={<AdminRoute />}>
              <Route path="users" element={<UsersPage />} />
              <Route path="users/new" element={<UserCreatePage />} />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
