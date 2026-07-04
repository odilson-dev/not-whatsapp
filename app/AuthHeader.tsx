"use client";

import { UserButton, useAuth } from "@clerk/nextjs";

export function AuthHeader() {
  const { isSignedIn } = useAuth();

  if (!isSignedIn) {
    return null;
  }

  return (
    <header className="fixed right-4 top-4 z-50">
      <UserButton />
    </header>
  );
}
