import { clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { getSessionContext } from "@/lib/session";
import { auditLog } from "@/lib/security/audit-log-service";
import { enforceApiSecurity } from "@/lib/security/request-guard";

const inviteSchema = z.object({
  emailAddress: z.string().email(),
  role: z.enum(["org:admin", "org:member"]).default("org:member"),
});

function membershipRole(role: "org:admin" | "org:member") {
  return role === "org:admin" ? "ADMIN" : "MEMBER";
}

export async function POST(request: Request) {
  const context = await getSessionContext();

  if (!context?.workspace) {
    return NextResponse.json({ message: "An active organization is required." }, { status: 401 });
  }

  const guard = await enforceApiSecurity({
    request,
    context,
    permission: "members:invite",
    action: "member.invite",
    resource: "api.organizations.invitations",
    rateLimit: "default",
  });

  if (guard) {
    return guard;
  }

  const parsed = inviteSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { message: "Invalid invitation payload.", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const client = await clerkClient();
  const organization = await client.organizations.getOrganization({
    organizationId: context.session.orgId!,
  });

  const invitation = await client.organizations.createOrganizationInvitation({
    organizationId: context.session.orgId!,
    inviterUserId: context.session.userId,
    emailAddress: parsed.data.emailAddress,
    role: parsed.data.role,
    redirectUrl: `${env.NEXT_PUBLIC_APP_URL}/dashboard`,
  });

  const dbOrganization = await prisma.organization.upsert({
    where: { clerkId: organization.id },
    update: {
      name: organization.name,
      slug: organization.slug,
      imageUrl: organization.imageUrl,
    },
    create: {
      clerkId: organization.id,
      name: organization.name,
      slug: organization.slug,
      imageUrl: organization.imageUrl,
    },
  });

  await prisma.membership.upsert({
    where: { clerkInvitationId: invitation.id },
    update: {
      clerkRole: parsed.data.role,
      role: membershipRole(parsed.data.role),
      status: "INVITED",
      invitedEmail: parsed.data.emailAddress,
    },
    create: {
      organizationId: dbOrganization.id,
      clerkInvitationId: invitation.id,
      clerkRole: parsed.data.role,
      role: membershipRole(parsed.data.role),
      status: "INVITED",
      invitedEmail: parsed.data.emailAddress,
    },
  });

  await auditLog.record({
    organizationId: dbOrganization.id,
    userId: context.user.id,
    action: "member.invite",
    resource: "membership",
    resourceId: invitation.id,
    request,
    metadata: { emailAddress: parsed.data.emailAddress, role: parsed.data.role },
  });

  return NextResponse.json({ invitationId: invitation.id });
}
