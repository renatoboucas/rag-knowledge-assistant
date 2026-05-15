"use client";

import { OrganizationSwitcher } from "@clerk/nextjs";

export function WorkspaceSelector() {
  return (
    <OrganizationSwitcher
      hidePersonal
      afterCreateOrganizationUrl="/dashboard"
      afterSelectOrganizationUrl="/dashboard"
      afterLeaveOrganizationUrl="/dashboard"
      appearance={{
        elements: {
          rootBox: "max-w-56",
          organizationSwitcherTrigger:
            "h-10 rounded-md border border-input bg-background px-3 text-sm shadow-sm",
        },
      }}
    />
  );
}
