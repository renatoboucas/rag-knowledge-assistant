import { AdminDashboard } from "@/components/admin/admin-dashboard";
import { PageHeader } from "@/features/dashboard/page-header";

export default function AdminPage() {
  return (
    <div>
      <PageHeader
        title="Admin"
        description="Manage users, workspace operations, AI usage, monitoring, and billing metrics."
      />
      <AdminDashboard />
    </div>
  );
}
