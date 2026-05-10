"use client";

import { Button } from "@rag/ui";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="bg-card text-card-foreground max-w-md space-y-4 rounded-lg border p-6 shadow-sm">
        <p className="text-muted-foreground text-sm font-medium">Application error</p>
        <h1 className="text-2xl font-semibold tracking-normal">
          The assistant workspace could not load.
        </h1>
        <p className="text-muted-foreground text-sm">{error.message}</p>
        <Button onClick={reset}>Retry</Button>
      </div>
    </main>
  );
}
