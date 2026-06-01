import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMaterialUploadStore } from "@/stores/materialUploadWizard.store";
import { parseMaterialExcel } from "@/lib/excel";
import { useCommitMaterials, usePreviewMaterials } from "@/hooks/useMaterials";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { fmtNum } from "@/lib/utils";

export default function MaterialUploadPage() {
  const s = useMaterialUploadStore();
  const preview = usePreviewMaterials();
  const commit = useCommitMaterials();
  const nav = useNavigate();
  const [file, setFile] = useState<File | null>(null);

  const handleParse = async () => {
    if (!file) return toast.error("Chọn file trước");
    const rows = await parseMaterialExcel(file);
    s.setRows(rows);
    const diff = await preview.mutateAsync({ mode: s.mode, items: rows });
    s.setDiff(diff);
    s.goPreview();
  };

  const handleCommit = async () => {
    if (!s.diff) return;
    await commit.mutateAsync(s.diff.previewToken);
    toast.success("Đã import");
    s.reset();
    nav("/materials");
  };

  if (s.step === "select") {
    return (
      <div className="space-y-4 p-6 max-w-xl">
        <h1 className="text-2xl font-semibold">Upload Vật tư</h1>
        <div>
          <label className="mr-2">Mode:</label>
          <select
            value={s.mode}
            onChange={(e) => s.setMode(e.target.value as 'full' | 'append')}
            className="border p-1"
          >
            <option value="append">Append (chỉ thêm/sửa)</option>
            <option value="full">
              Full (xoá những row không có trong file)
            </option>
          </select>
        </div>
        <Input
          type="file"
          accept=".xlsx,.xls"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <Button onClick={handleParse} disabled={!file || preview.isPending}>
          Xem trước
        </Button>
      </div>
    );
  }

  // step === 'preview'
  return (
    <div className="space-y-4 p-6">
      <h1 className="text-2xl font-semibold">
        Preview ({s.diff?.summary.new} mới, {s.diff?.summary.changed} sửa,{" "}
        {s.diff?.summary.unchanged} giữ, {s.diff?.summary.removed} xoá)
      </h1>
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => s.reset()}>
          Huỷ
        </Button>
        <Button onClick={handleCommit} disabled={commit.isPending}>
          Commit
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Status</TableHead>
            <TableHead>Mã</TableHead>
            <TableHead>Tên</TableHead>
            <TableHead>ĐVT</TableHead>
            <TableHead>Tồn</TableHead>
            <TableHead>Tồn ĐM</TableHead>
            <TableHead>MOQ</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {s.diff?.items.map((r, idx) => (
            <TableRow
              key={idx}
              className={
                r.status === "new"
                  ? "bg-green-50"
                  : r.status === "changed"
                    ? "bg-yellow-50"
                    : r.status === "removed"
                      ? "bg-red-50"
                      : ""
              }
            >
              <TableCell>{r.status}</TableCell>
              <TableCell className="font-mono">{r.code}</TableCell>
              <TableCell>{r.name}</TableCell>
              <TableCell>{r.uom}</TableCell>
              <TableCell>{fmtNum(r.actualStock)}</TableCell>
              <TableCell>{fmtNum(r.standardStock)}</TableCell>
              <TableCell>{fmtNum(r.moq)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
