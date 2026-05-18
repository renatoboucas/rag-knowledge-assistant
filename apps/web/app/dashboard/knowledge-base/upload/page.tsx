import dynamic from "next/dynamic";

import { PageHeader } from "@/features/dashboard/page-header";

const UploadDashboard = dynamic(() =>
  import("@/components/upload/upload-dashboard").then((mod) => mod.UploadDashboard),
);

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
