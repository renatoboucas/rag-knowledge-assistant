import { ObservabilityDashboard } from "@/components/observability/observability-dashboard";
import { PageHeader } from "@/features/dashboard/page-header";

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
