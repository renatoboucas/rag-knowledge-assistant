import dynamic from "next/dynamic";

import { PageHeader } from "@/features/dashboard/page-header";

const AdminDashboard = dynamic(() =>
  import("@/components/admin/admin-dashboard").then((mod) => mod.AdminDashboard),
);

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
