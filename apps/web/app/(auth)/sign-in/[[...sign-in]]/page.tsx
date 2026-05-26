import { SignIn } from "@clerk/nextjs";

import { ClerkConfigRequired } from "@/components/auth/clerk-config-required";
import { AuthShell } from "@/components/auth/auth-shell";
import { env } from "@/lib/env";

export default function SignInPage() {
  return (
    <AuthShell
      title="Sign in to your AI workspace"
      description="Access governed knowledge, collaborate with your organization, and manage retrieval workflows."
    >
      {env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? (
        <SignIn
          path="/sign-in"
          routing="path"
          signUpUrl="/sign-up"
          fallbackRedirectUrl="/dashboard"
        />
      ) : (
        <ClerkConfigRequired />
      )}
    </AuthShell>
  );
}
