import dynamic from "next/dynamic";

import { PageHeader } from "@/features/dashboard/page-header";

const DeveloperDashboard = dynamic(() =>
  import("@/components/developer/developer-dashboard").then((mod) => mod.DeveloperDashboard),
);

export default function DeveloperPage() {
  return (
    <div>
      <PageHeader
        title="Developer"
        description="Manage public API keys, inspect request activity, and access generated API documentation and SDKs."
      />
      <DeveloperDashboard />
    </div>
  );
}
