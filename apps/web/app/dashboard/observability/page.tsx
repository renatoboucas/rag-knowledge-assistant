import dynamic from "next/dynamic";

import { PageHeader } from "@/features/dashboard/page-header";

const ObservabilityDashboard = dynamic(() =>
  import("@/components/observability/observability-dashboard").then(
    (mod) => mod.ObservabilityDashboard,
  ),
);

export default function ObservabilityPage() {
  return (
    <div>
      <PageHeader
        title="Observability"
        description="Track AI usage, retrieval quality, latency, errors, user analytics, and model cost."
      />
      <ObservabilityDashboard />
    </div>
  );
}
