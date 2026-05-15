import Link from "next/link";
import { BrainCircuit } from "lucide-react";

export function AuthShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <main className="bg-background relative flex min-h-screen overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.16),transparent_34%),linear-gradient(135deg,hsl(var(--background)),hsl(var(--muted)))]" />
      <section className="container grid flex-1 items-center gap-10 py-10 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="hidden max-w-xl lg:block">
          <Link href="/" className="mb-10 flex items-center gap-2 font-semibold">
            <span className="bg-primary text-primary-foreground flex size-9 items-center justify-center rounded-md">
              <BrainCircuit className="size-5" />
            </span>
            RAG Knowledge Assistant
          </Link>
          <h1 className="text-4xl font-semibold tracking-normal">{title}</h1>
          <p className="text-muted-foreground mt-4 text-lg leading-8">{description}</p>
          <div className="text-muted-foreground mt-10 grid gap-3 text-sm">
            <div className="bg-card/80 rounded-lg border p-4 backdrop-blur">
              Organization-scoped workspaces with role-aware access controls.
            </div>
            <div className="bg-card/80 rounded-lg border p-4 backdrop-blur">
              Secure sessions, protected routes, and validated server actions.
            </div>
          </div>
        </div>
        <div className="mx-auto flex w-full max-w-md justify-center">{children}</div>
      </section>
    </main>
  );
}
