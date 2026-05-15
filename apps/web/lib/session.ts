import { auth, clerkClient, currentUser } from "@clerk/nextjs/server";
import type { Workspace } from "@rag/types";

import { prisma } from "@/lib/prisma";
import { normalizeClerkRole } from "@/lib/rbac";

export async function getSessionContext() {
  const session = await auth();

  if (!session.userId) {
    return null;
  }

  const user = await currentUser();

  if (!user) {
    return null;
  }

  const primaryEmail =
    user.emailAddresses.find((email) => email.id === user.primaryEmailAddressId)?.emailAddress ??
    user.emailAddresses[0]?.emailAddress;

  if (!primaryEmail) {
    return null;
  }

  const dbUser = await prisma.user.upsert({
    where: { clerkId: user.id },
    update: {
      email: primaryEmail,
      firstName: user.firstName,
      lastName: user.lastName,
      imageUrl: user.imageUrl,
    },
    create: {
      clerkId: user.id,
      email: primaryEmail,
      firstName: user.firstName,
      lastName: user.lastName,
      imageUrl: user.imageUrl,
    },
  });

  let workspace: Workspace | null = null;

  if (session.orgId) {
    const client = await clerkClient();
    const organization = await client.organizations.getOrganization({
      organizationId: session.orgId,
    });
    const role = normalizeClerkRole(session.orgRole);

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
      where: {
        userId_organizationId: {
          userId: dbUser.id,
          organizationId: dbOrganization.id,
        },
      },
      update: {
        clerkRole: session.orgRole ?? "org:member",
        role: role.toUpperCase() as "ADMIN" | "MEMBER" | "VIEWER" | "OWNER",
        status: "ACTIVE",
      },
      create: {
        userId: dbUser.id,
        organizationId: dbOrganization.id,
        clerkRole: session.orgRole ?? "org:member",
        role: role.toUpperCase() as "ADMIN" | "MEMBER" | "VIEWER" | "OWNER",
        status: "ACTIVE",
      },
    });

    workspace = {
      id: dbOrganization.id,
      clerkId: dbOrganization.clerkId,
      name: dbOrganization.name,
      slug: dbOrganization.slug,
      role,
    };
  }

  return {
    user: dbUser,
    clerkUser: user,
    session,
    workspace,
  };
}
