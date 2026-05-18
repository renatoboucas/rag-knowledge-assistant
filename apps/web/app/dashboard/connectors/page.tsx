import dynamic from "next/dynamic";

import { PageHeader } from "@/features/dashboard/page-header";

const ConnectorsDashboard = dynamic(() =>
  import("@/components/connectors/connectors-dashboard").then((mod) => mod.ConnectorsDashboard),
);

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
