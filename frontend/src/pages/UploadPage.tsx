import { useUploadWizardStore } from '@/stores/uploadWizard.store';
import { UploadStepSelect } from '@/components/UploadStepSelect';
import { UploadStepPreview } from '@/components/UploadStepPreview';

export default function UploadPage() {
  const step = useUploadWizardStore((s) => s.step);
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Upload BOM</h1>
      {step === 'select' && <UploadStepSelect />}
      {step === 'preview' && <UploadStepPreview />}
    </div>
  );
}
