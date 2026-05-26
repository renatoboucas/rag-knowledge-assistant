import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { Button, Card, CardContent } from "@rag/ui";

export function DashboardSessionRequired({
  title = "Workspace session could not load",
  description = "Your sign-in succeeded, but the dashboard could not resolve a complete workspace session. Check the production Clerk and database environment variables, then try again.",
  detail,
}: {
  title?: string;
  description?: string;
  detail?: string;
}) {
  return (
    <main className="bg-background flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-lg border-amber-500/40 bg-amber-500/10">
        <CardContent className="space-y-5 p-6">
          <div className="flex items-center gap-2 font-semibold text-amber-200">
            <AlertTriangle className="size-5" />
            {title}
          </div>
          <p className="text-muted-foreground text-sm leading-6">{description}</p>
          {detail ? (
            <pre className="bg-background/70 text-muted-foreground overflow-auto rounded-md border p-3 text-xs">
              {detail}
            </pre>
          ) : null}
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/dashboard">Retry dashboard</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/sign-in">Return to sign in</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
