import { useEffect } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, useParams } from 'react-router-dom';
import {
  materialFormSchema,
  type MaterialFormInput,
  type MaterialFormValues,
} from '@/schemas/material.schema';
import {
  useCreateMaterial,
  useMaterial,
  useUpdateMaterial,
} from '@/hooks/useMaterials';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NumericInput } from '@/components/ui/numeric-input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/errors';
import { PURCHASE_TYPE_OPTIONS } from '@/lib/labels';

export default function MaterialFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = id !== undefined && id !== 'new';
  const numericId = isEdit ? parseInt(id, 10) : undefined;
  const nav = useNavigate();

  const { data: existing } = useMaterial(numericId);
  const create = useCreateMaterial();
  const update = useUpdateMaterial(numericId ?? 0);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<MaterialFormInput, unknown, MaterialFormValues>({
    resolver: zodResolver(materialFormSchema),
    defaultValues: {
      code: '',
      name: '',
      uom: '',
      actualStock: 0,
      standardStock: 0,
      moq: null,
      purchaseType: 'OPTIONAL',
    },
  });

  useEffect(() => {
    if (existing) reset({ ...existing, moq: existing.moq ?? null });
  }, [existing, reset]);

  const onSubmit: SubmitHandler<MaterialFormValues> = (values) => {
    const action = isEdit
      ? update.mutateAsync(values)
      : create.mutateAsync(values);
    action
      .then(() => {
        toast.success(isEdit ? 'Đã cập nhật' : 'Đã tạo');
        nav('/materials');
      })
      .catch((e: unknown) => toast.error(getApiErrorMessage(e) ?? 'Lỗi'));
  };

  return (
    <div className="max-w-md p-6">
      <h1 className="mb-4 text-2xl font-semibold">
        {isEdit ? 'Sửa material' : 'Tạo material'}
      </h1>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <div>
          <Label>Mã</Label>
          <Input {...register('code')} disabled={isEdit} />
          {errors.code && (
            <p className="text-sm text-red-500">{errors.code.message}</p>
          )}
        </div>
        <div>
          <Label>Tên</Label>
          <Input {...register('name')} />
          {errors.name && (
            <p className="text-sm text-red-500">{errors.name.message}</p>
          )}
        </div>
        <div>
          <Label>ĐVT</Label>
          <Input {...register('uom')} />
          {errors.uom && (
            <p className="text-sm text-red-500">{errors.uom.message}</p>
          )}
        </div>
        <div>
          <Label>Tồn hiện tại</Label>
          <NumericInput {...register('actualStock')} />
        </div>
        <div>
          <Label>Tồn định mức</Label>
          <NumericInput {...register('standardStock')} />
        </div>
        <div>
          <Label>MOQ (để trống nếu không có)</Label>
          <NumericInput {...register('moq')} />
        </div>
        <div>
          <Label>Mua ngoài</Label>
          <select
            {...register('purchaseType')}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {PURCHASE_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {errors.purchaseType && (
            <p className="text-sm text-red-500">{errors.purchaseType.message}</p>
          )}
        </div>
        <Button type="submit">{isEdit ? 'Cập nhật' : 'Tạo'}</Button>
      </form>
    </div>
  );
}
