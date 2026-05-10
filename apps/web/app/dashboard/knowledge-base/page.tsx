import { Badge, Card, CardContent, CardHeader, CardTitle } from "@rag/ui";

import { PageHeader } from "@/features/dashboard/page-header";

const sources = [
  ["Policy repository", "Indexed", "4,120 docs"],
  ["Product handbook", "Indexed", "2,880 docs"],
  ["Customer insights", "Processing", "1,640 docs"],
];

export default function KnowledgeBasePage() {
  return (
    <div>
      <PageHeader
        title="Knowledge Base"
        description="Manage sources, ingestion status, and document readiness for retrieval-augmented answers."
      />
      <Card>
        <CardHeader>
          <CardTitle>Sources</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {sources.map(([name, status, count]) => (
            <div
              key={name}
              className="flex flex-col gap-3 rounded-md border p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-medium">{name}</p>
                <p className="text-muted-foreground text-sm">{count}</p>
              </div>
              <Badge variant={status === "Indexed" ? "secondary" : "outline"}>{status}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
