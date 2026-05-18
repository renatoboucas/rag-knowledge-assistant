import dynamic from "next/dynamic";

import { PageHeader } from "@/features/dashboard/page-header";

const WorkflowsDashboard = dynamic(() =>
  import("@/components/workflows/workflows-dashboard").then((mod) => mod.WorkflowsDashboard),
);

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
