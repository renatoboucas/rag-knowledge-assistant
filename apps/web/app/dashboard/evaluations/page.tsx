import dynamic from "next/dynamic";

import { PageHeader } from "@/features/dashboard/page-header";

const EvaluationsDashboard = dynamic(() =>
  import("@/components/evaluations/evaluations-dashboard").then((mod) => mod.EvaluationsDashboard),
);

export default function EvaluationsPage() {
  return (
    <div>
      <PageHeader
        title="Evaluations"
        description="Benchmark retrieval quality, hallucination risk, answer quality, and regression coverage across workspace knowledge."
      />
      <EvaluationsDashboard />
    </div>
  );
}
