import { useEffect } from "react";
import { useUploadWizardStore } from "@/stores/uploadWizard.store";
import { UploadStepSelect } from "@/components/UploadStepSelect";
import { UploadStepPreview } from "@/components/UploadStepPreview";
import { Upload, Eye, CheckCircle2 } from "lucide-react";

const steps = [
  { key: "select", label: "Chọn file", icon: Upload },
  { key: "preview", label: "Preview & Xác nhận", icon: Eye },
  { key: "done", label: "Hoàn tất", icon: CheckCircle2 },
] as const;

export default function UploadPage() {
  const step = useUploadWizardStore((s) => s.step);
  const reset = useUploadWizardStore((s) => s.reset);

  useEffect(() => {
    return () => reset();
  }, [reset]);

  const currentIdx = steps.findIndex((s) => s.key === step);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Upload BOM</h1>
        <p className="text-muted-foreground mt-1">
          Upload file Excel để tạo hoặc cập nhật BOM
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {steps.map((s, i) => {
          const Icon = s.icon;
          const isActive = i === currentIdx;
          const isDone = i < currentIdx;
          return (
            <div key={s.key} className="flex items-center gap-2">
              {i > 0 && (
                <div
                  className={`h-px w-8 ${isDone ? "bg-primary" : "bg-border"}`}
                />
              )}
              <div className="flex items-center gap-2">
                <div
                  className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                    isActive
                      ? "gradient-primary text-white"
                      : isDone
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <span
                  className={`text-sm font-medium ${
                    isActive ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {s.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {step === "select" && <UploadStepSelect />}
      {step === "preview" && <UploadStepPreview />}
    </div>
  );
}
