import dynamic from "next/dynamic";

import { PageHeader } from "@/features/dashboard/page-header";

const KnowledgeBaseDashboard = dynamic(() =>
  import("@/components/knowledge/knowledge-base-dashboard").then(
    (mod) => mod.KnowledgeBaseDashboard,
  ),
);

export default function KnowledgeBasePage() {
  return (
    <div>
      <PageHeader
        title="Knowledge Base"
        description="Manage source documents, metadata, collections, indexing state, and retrieval performance."
      />
      <KnowledgeBaseDashboard />
    </div>
  );
}
