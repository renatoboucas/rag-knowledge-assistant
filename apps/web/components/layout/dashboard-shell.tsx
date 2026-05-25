import { Sidebar } from "@/components/layout/sidebar";
import { TopNav } from "@/components/layout/top-nav";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-background min-h-screen">
      <aside
        className="bg-background fixed inset-y-0 left-0 z-40 hidden w-72 border-r p-5 lg:block"
        aria-label="Workspace navigation"
      >
        <Sidebar />
      </aside>
      <div className="lg:pl-72">
        <TopNav />
        <main className="p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
