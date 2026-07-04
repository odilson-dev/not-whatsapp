"use client";

import { useUser } from "@clerk/nextjs";
import { useConvexAuth, useMutation } from "convex/react";
import { useEffect } from "react";
import { api } from "../convex/_generated/api";

export function StoreUserInDatabase() {
  const { isAuthenticated } = useConvexAuth();
  const { isLoaded, user } = useUser();
  const storeUser = useMutation(api.users.store);

  useEffect(() => {
    if (!isAuthenticated || !isLoaded || !user) {
      return;
    }

    void storeUser({
      name:
        user.fullName ??
        user.firstName ??
        user.username ??
        undefined,
      email: user.primaryEmailAddress?.emailAddress,
      imageUrl: user.imageUrl,
    });
  }, [isAuthenticated, isLoaded, user, storeUser]);

  return null;
}
