"use client";

import { UserProfile } from "@clerk/nextjs";

export function ProfileSettings() {
  return (
    <UserProfile
      routing="hash"
      appearance={{
        elements: {
          rootBox: "w-full",
          cardBox: "w-full shadow-none border border-border rounded-lg",
        },
      }}
    />
  );
}
