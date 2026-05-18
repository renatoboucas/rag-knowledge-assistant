import { WorkflowsDashboard } from "@/components/workflows/workflows-dashboard";
import { PageHeader } from "@/features/dashboard/page-header";

export default function WorkflowsPage() {
  return (
    <div>
      <PageHeader
        title="Workflows"
        description="Build AI-powered automations for ingestion, sync, summaries, and scheduled operations."
      />
      <WorkflowsDashboard />
    </div>
  );
}
