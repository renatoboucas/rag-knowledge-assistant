"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <main className="flex min-h-screen items-center justify-center p-6">
          <div className="max-w-md space-y-4 rounded-lg border p-6">
            <h1 className="text-2xl font-semibold">Unexpected failure</h1>
            <p>{error.message}</p>
            <button type="button" onClick={reset}>
              Retry
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
