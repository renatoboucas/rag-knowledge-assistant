import { SignUp } from "@clerk/nextjs";

import { AuthShell } from "@/components/auth/auth-shell";

export default function SignUpPage() {
  return (
    <AuthShell
      title="Create a secure knowledge workspace"
      description="Start with Clerk-backed identity, organization membership, and production-ready RBAC primitives."
    >
      <SignUp
        path="/sign-up"
        routing="path"
        signInUrl="/sign-in"
        fallbackRedirectUrl="/dashboard"
      />
    </AuthShell>
  );
}
