import { redirect } from "next/navigation";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { getSessionContext } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  let context: Awaited<ReturnType<typeof getSessionContext>> = null;

  try {
    context = await getSessionContext();
  } catch (error) {
    console.error("Dashboard session resolution failed", error);
    redirect("/sign-in?redirect_url=/dashboard");
  }

  if (!context) {
    redirect("/sign-in?redirect_url=/dashboard");
  }

  return <DashboardShell>{children}</DashboardShell>;
}
