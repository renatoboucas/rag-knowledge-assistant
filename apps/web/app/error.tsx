"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { Button } from "@rag/ui";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="bg-card text-card-foreground max-w-md space-y-4 rounded-lg border p-6 shadow-sm">
        <p className="text-muted-foreground text-sm font-medium">Application error</p>
        <h1 className="text-2xl font-semibold tracking-normal">
          The assistant workspace could not load.
        </h1>
        <p className="text-muted-foreground text-sm">
          Retry the request. If the issue continues, share the error reference with support.
        </p>
        {error.digest ? (
          <p className="text-muted-foreground rounded-md border px-3 py-2 text-xs">
            Reference: {error.digest}
          </p>
        ) : null}
        <Button onClick={reset}>Retry</Button>
      </div>
    </main>
  );
}
