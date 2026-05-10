import { Skeleton } from "@rag/ui";

export default function Loading() {
  return (
    <main className="min-h-screen p-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-36" />
          <Skeleton className="h-36" />
          <Skeleton className="h-36" />
        </div>
      </div>
    </main>
  );
}
