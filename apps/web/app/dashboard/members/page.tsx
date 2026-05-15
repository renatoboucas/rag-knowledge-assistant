import { Badge, Card, CardContent, CardHeader, CardTitle } from "@rag/ui";

import { InviteMemberForm } from "@/components/workspace/invite-member-form";
import { PageHeader } from "@/features/dashboard/page-header";
import { getSessionContext } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export default async function MembersPage() {
  const context = await getSessionContext();
  const memberships = context?.workspace
    ? await prisma.membership.findMany({
        where: { organizationId: context.workspace.id },
        include: { user: true },
        orderBy: { createdAt: "desc" },
      })
    : [];

  return (
    <div>
      <PageHeader
        title="Members"
        description="Invite teammates, review workspace roles, and maintain organization-scoped access."
      />
      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Invite member</CardTitle>
          </CardHeader>
          <CardContent>
            <InviteMemberForm />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Workspace access</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {memberships.length ? (
              memberships.map((membership) => (
                <div
                  key={membership.id}
                  className="flex flex-col gap-3 rounded-md border p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium">
                      {membership.user?.email ?? membership.invitedEmail ?? "Pending member"}
                    </p>
                    <p className="text-muted-foreground text-sm">{membership.clerkRole}</p>
                  </div>
                  <Badge variant={membership.status === "ACTIVE" ? "secondary" : "outline"}>
                    {membership.status.toLowerCase()}
                  </Badge>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground text-sm">
                Select or create an organization to manage members.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
