import { SignUp } from "@clerk/nextjs";

import { ClerkConfigRequired } from "@/components/auth/clerk-config-required";
import { AuthShell } from "@/components/auth/auth-shell";
import { env } from "@/lib/env";

export default function SignUpPage() {
  return (
    <AuthShell
      title="Create a secure knowledge workspace"
      description="Start with Clerk-backed identity, organization membership, and production-ready RBAC primitives."
    >
      {env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? (
        <SignUp
          path="/sign-up"
          routing="path"
          signInUrl="/sign-in"
          fallbackRedirectUrl="/dashboard"
        />
      ) : (
        <ClerkConfigRequired />
      )}
    </AuthShell>
  );
}
