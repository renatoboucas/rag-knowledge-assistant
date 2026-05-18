import dynamic from "next/dynamic";

import { PageHeader } from "@/features/dashboard/page-header";

const SecurityDashboard = dynamic(() =>
  import("@/components/security/security-dashboard").then((mod) => mod.SecurityDashboard),
);

export default function SecurityPage() {
  return (
    <div>
      <PageHeader
        title="Security"
        description="Review audit activity, governance settings, rate limits, and data protection controls."
      />
      <SecurityDashboard />
    </div>
  );
}
