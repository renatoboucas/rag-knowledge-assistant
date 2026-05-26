import { DashboardSessionRequired } from "@/components/auth/dashboard-session-required";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { getSessionContext } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  let context: Awaited<ReturnType<typeof getSessionContext>> = null;

  try {
    context = await getSessionContext();
  } catch (error) {
    console.error("Dashboard session resolution failed", error);
    return <DashboardSessionRequired detail={error instanceof Error ? error.message : undefined} />;
  }

  if (!context) {
    return (
      <DashboardSessionRequired
        title="Sign in required"
        description="The dashboard could not find an active Clerk session. Sign in again to continue."
      />
    );
  }

  return <DashboardShell>{children}</DashboardShell>;
}
