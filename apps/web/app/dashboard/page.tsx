import { Activity, Database, MessageSquareText, ShieldCheck } from "lucide-react";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@rag/ui";

import { PageHeader } from "@/features/dashboard/page-header";

const metrics = [
  { label: "Indexed documents", value: "12,840", icon: Database },
  { label: "Answered questions", value: "3,216", icon: MessageSquareText },
  { label: "Citation coverage", value: "98.2%", icon: ShieldCheck },
  { label: "Avg retrieval time", value: "420ms", icon: Activity },
];

export default function DashboardPage() {
  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Monitor retrieval quality, knowledge freshness, and assistant readiness from one operational workspace."
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <Card key={metric.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{metric.label}</CardTitle>
              <metric.icon className="text-muted-foreground size-4" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{metric.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Knowledge pipeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {["Ingestion", "Chunking", "Embedding", "Retrieval QA"].map((step, index) => (
              <div key={step} className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <p className="text-sm font-medium">{step}</p>
                  <p className="text-muted-foreground text-xs">
                    Stage {index + 1} health check passed
                  </p>
                </div>
                <Badge variant="secondary">Ready</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Assistant readiness</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground space-y-3 text-sm">
            <p>
              Core interface, routes, theming, and shared packages are configured for production
              expansion.
            </p>
            <p>
              Connect retrieval services, auth, storage, and observability as the next backend
              layer.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
