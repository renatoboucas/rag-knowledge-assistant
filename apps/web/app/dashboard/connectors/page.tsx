import { ConnectorsDashboard } from "@/components/connectors/connectors-dashboard";
import { PageHeader } from "@/features/dashboard/page-header";

export default function ConnectorsPage() {
  return (
    <div>
      <PageHeader
        title="Connectors"
        description="Manage enterprise source connectors, sync schedules, webhooks, and ingestion jobs."
      />
      <ConnectorsDashboard />
    </div>
  );
}
