import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useUsers, useResetPassword } from '@/hooks/useUsers';
import { useMe } from '@/hooks/useMe';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export default function UsersPage() {
  const { data: me } = useMe();
  const { data: users = [], isLoading } = useUsers();
  const reset = useResetPassword();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Quản lý user</h1>
        <Button asChild><Link to="/users/new">Tạo user mới</Link></Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ID</TableHead>
            <TableHead>Username</TableHead>
            <TableHead>Tên</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Tạo lúc</TableHead>
            <TableHead className="text-right">Thao tác</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow><TableCell colSpan={6}>Đang tải…</TableCell></TableRow>
          ) : users.map((u) => (
            <TableRow key={u.id}>
              <TableCell>{u.id}</TableCell>
              <TableCell className="font-mono">{u.username}</TableCell>
              <TableCell>{u.name}</TableCell>
              <TableCell>
                <Badge variant={u.role === 'ADMIN' ? 'default' : 'secondary'}>{u.role}</Badge>
              </TableCell>
              <TableCell>{new Date(u.createdAt).toLocaleString()}</TableCell>
              <TableCell className="text-right">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={u.id === me?.id}
                    >Reset password</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Reset password cho {u.username}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Mật khẩu sẽ được đặt về <strong>Aa123456</strong>. Bạn cần thông báo cho user qua kênh khác.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Huỷ</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => reset.mutate(u.id, {
                          onSuccess: () => toast.success(`Đã reset mật khẩu ${u.username} về Aa123456`),
                          onError: () => toast.error('Reset thất bại'),
                        })}
                      >Xác nhận</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
