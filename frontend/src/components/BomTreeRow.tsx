import { useState, useRef, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ChevronDown, ChevronRight, Pencil, Check, X } from 'lucide-react';
import { api } from '@/lib/api';
import { TableCell, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NumericInput } from '@/components/ui/numeric-input';
import type { BomTreeNode } from '@/lib/buildBomTree';
import { fmtNum } from '@/lib/utils';

interface EditState {
  componentName: string;
  quantity: string;
  uom: string;
}

interface UpdatePatch {
  componentName?: string;
  quantity?: number;
  uom?: string;
}

interface Props {
  node: BomTreeNode;
  materialCode: string;
  isExpanded: (id: number) => boolean;
  toggle: (materialCode: string, id: number) => void;
}

function fromNode(node: BomTreeNode): EditState {
  return {
    componentName: node.componentName,
    quantity: String(node.quantity),
    uom: node.uom,
  };
}

function buildPatch(state: EditState, node: BomTreeNode): UpdatePatch {
  const patch: UpdatePatch = {};
  if (state.componentName !== node.componentName)
    patch.componentName = state.componentName;
  const qty = parseFloat(state.quantity);
  if (!isNaN(qty) && qty !== node.quantity) patch.quantity = qty;
  if (state.uom !== node.uom) patch.uom = state.uom;
  return patch;
}

export function BomTreeRow({ node, materialCode, isExpanded, toggle }: Props) {
  const [editing, setEditing] = useState(false);
  const [editState, setEditState] = useState<EditState>(() => fromNode(node));
  const nameRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  useEffect(() => {
    if (editing) nameRef.current?.focus();
  }, [editing]);

  const updateMut = useMutation({
    mutationFn: async (data: UpdatePatch) =>
      (await api.patch(`/bom/items/${node.id}`, data)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bom', materialCode] });
      toast.success(`Đã cập nhật ${node.componentCode}`);
      setEditing(false);
    },
    onError: () => {
      toast.error(`Cập nhật ${node.componentCode} thất bại`);
    },
  });

  const startEdit = () => {
    setEditState(fromNode(node));
    setEditing(true);
  };
  const cancelEdit = () => setEditing(false);
  const saveEdit = () => {
    const patch = buildPatch(editState, node);
    if (Object.keys(patch).length === 0) {
      setEditing(false);
      return;
    }
    updateMut.mutate(patch);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') saveEdit();
    if (e.key === 'Escape') cancelEdit();
  };

  const hasChildren = node.children.length > 0;
  const open = isExpanded(node.id);

  return (
    <TableRow>
      <TableCell style={{ paddingLeft: 8 + (node.level - 1) * 24 }}>
        <div className="flex items-center gap-1">
          {hasChildren ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => toggle(materialCode, node.id)}
            >
              {open ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          ) : (
            <span className="w-6 inline-block" />
          )}
          <span className="font-mono">{node.componentCode}</span>
        </div>
      </TableCell>
      <TableCell>
        {editing ? (
          <Input
            ref={nameRef}
            value={editState.componentName}
            onChange={(e) =>
              setEditState((s) => ({ ...s, componentName: e.target.value }))
            }
            onKeyDown={handleKeyDown}
            className="h-7 text-sm"
          />
        ) : (
          <span className="block truncate" title={node.componentName}>
            {node.componentName}
          </span>
        )}
      </TableCell>
      <TableCell className="text-right">
        {editing ? (
          <NumericInput
            value={editState.quantity}
            onChange={(e) =>
              setEditState((s) => ({ ...s, quantity: e.target.value }))
            }
            onKeyDown={handleKeyDown}
            className="h-7 text-sm text-right w-24"
          />
        ) : (
          fmtNum(node.quantity)
        )}
      </TableCell>
      <TableCell>
        {editing ? (
          <Input
            value={editState.uom}
            onChange={(e) =>
              setEditState((s) => ({ ...s, uom: e.target.value }))
            }
            onKeyDown={handleKeyDown}
            className="h-7 text-sm w-20"
          />
        ) : (
          node.uom
        )}
      </TableCell>
      <TableCell className="text-right text-muted-foreground">
        {fmtNum(node.actualStock)}
      </TableCell>
      <TableCell className="text-right text-muted-foreground">
        {fmtNum(node.standardStock)}
      </TableCell>
      <TableCell className="text-right">{node.level}</TableCell>
      <TableCell>
        {editing ? (
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={saveEdit}
              disabled={updateMut.isPending}
            >
              <Check className="h-4 w-4 text-green-600" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={cancelEdit}
            >
              <X className="h-4 w-4 text-red-600" />
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={startEdit}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}
