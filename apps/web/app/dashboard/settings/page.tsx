import { Card, CardContent, CardHeader, CardTitle, Input } from "@rag/ui";

import { PageHeader } from "@/features/dashboard/page-header";
import { BillingSettings } from "@/features/settings/billing-settings";
import { ProfileSettings } from "@/features/settings/profile-settings";

export default function SettingsPage() {
  return (
    <div>
      <PageHeader
        title="Settings"
        description="Configure workspace identity, theme defaults, retrieval providers, and operational guardrails."
      />
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Workspace</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="workspace-name">
                Name
              </label>
              <Input id="workspace-name" defaultValue="RAG Knowledge Assistant" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="default-model">
                Default model
              </label>
              <Input id="default-model" defaultValue="Configured in provider layer" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Retrieval</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground space-y-3 text-sm">
            <p>
              Provider settings placeholder for vector store, embedding model, chunking strategy,
              and citation policy.
            </p>
            <p>Environment validation is ready to expand as backend integrations are added.</p>
          </CardContent>
        </Card>
      </div>
      <div className="mt-4">
        <BillingSettings />
      </div>
      <div className="mt-4">
        <ProfileSettings />
      </div>
    </div>
  );
}
