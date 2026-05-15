import { UploadDashboard } from "@/components/upload/upload-dashboard";
import { PageHeader } from "@/features/dashboard/page-header";

export default function UploadPage() {
  return (
    <div>
      <PageHeader
        title="Document Uploads"
        description="Upload source documents, monitor processing, and retry failed ingestion jobs."
      />
      <UploadDashboard />
    </div>
  );
}
