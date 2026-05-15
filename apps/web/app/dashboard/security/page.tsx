import { SecurityDashboard } from "@/components/security/security-dashboard";
import { PageHeader } from "@/features/dashboard/page-header";

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
