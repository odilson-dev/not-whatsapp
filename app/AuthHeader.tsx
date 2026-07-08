"use client";

import { UserButton, useAuth } from "@clerk/nextjs";
import { usePathname } from "next/navigation";

export function AuthHeader() {
  const { isSignedIn } = useAuth();
  const pathname = usePathname();

  if (!isSignedIn || pathname.startsWith("/chat")) {
    return null;
  }

  return (
    <header className="fixed right-4 top-4 z-50">
      <UserButton />
    </header>
  );
}
