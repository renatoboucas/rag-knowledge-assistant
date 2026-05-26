import { AlertTriangle } from "lucide-react";

import { Card, CardContent } from "@rag/ui";

export function ClerkConfigRequired() {
  return (
    <Card className="w-full border-amber-500/40 bg-amber-500/10">
      <CardContent className="space-y-3 p-6">
        <div className="flex items-center gap-2 font-semibold text-amber-200">
          <AlertTriangle className="size-5" />
          Clerk is not configured
        </div>
        <p className="text-muted-foreground text-sm leading-6">
          Add <code>NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</code> and <code>CLERK_SECRET_KEY</code> to
          the deployment environment, then redeploy the application.
        </p>
      </CardContent>
    </Card>
  );
}
