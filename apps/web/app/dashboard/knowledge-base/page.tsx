import { KnowledgeBaseDashboard } from "@/components/knowledge/knowledge-base-dashboard";
import { PageHeader } from "@/features/dashboard/page-header";

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
