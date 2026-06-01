import { useState } from 'react';
import { useMaterialSearch } from '@/hooks/useMaterials';
import { useDebounced } from '@/lib/debounce';
import { Input } from '@/components/ui/input';
import type { Material } from '@/types';

interface Props {
  onSelect: (m: Material) => void;
  placeholder?: string;
}

export function MaterialSearchCombobox({
  onSelect,
  placeholder = 'Tìm theo mã hoặc tên...',
}: Props) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const debounced = useDebounced(q, 250);
  const { data, isLoading } = useMaterialSearch(debounced);

  const handlePick = (m: Material) => {
    onSelect(m);
    setQ('');
    setOpen(false);
  };

  return (
    <div className="relative w-full max-w-md">
      <Input
        value={q}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
      />
      {open && debounced.length > 0 && (
        <div className="absolute z-10 mt-1 max-h-80 w-full overflow-auto rounded border bg-white shadow">
          {isLoading && (
            <p className="p-2 text-sm text-gray-500">Đang tìm...</p>
          )}
          {!isLoading && data?.length === 0 && (
            <p className="p-2 text-sm text-gray-500">Không tìm thấy</p>
          )}
          {data?.map((m) => (
            <button
              key={m.id}
              type="button"
              className="w-full px-2 py-1 text-left hover:bg-gray-100"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handlePick(m)}
            >
              <span className="font-mono text-sm">{m.code}</span> — {m.name}{' '}
              <span className="text-xs text-gray-500">({m.uom})</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
