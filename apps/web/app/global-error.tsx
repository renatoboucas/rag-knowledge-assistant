"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function GlobalError({
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
    <html lang="en">
      <body>
        <main className="flex min-h-screen items-center justify-center p-6">
          <div className="max-w-md space-y-4 rounded-lg border p-6">
            <h1 className="text-2xl font-semibold">Unexpected failure</h1>
            <p>The application hit an unexpected error. Retry the request or contact support.</p>
            {error.digest ? <p className="text-sm">Reference: {error.digest}</p> : null}
            <button type="button" onClick={reset}>
              Retry
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
