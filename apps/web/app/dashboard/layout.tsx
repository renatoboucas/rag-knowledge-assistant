import { DashboardShell } from "@/components/layout/dashboard-shell";
import { getSessionContext } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await getSessionContext();

  return <DashboardShell>{children}</DashboardShell>;
}
