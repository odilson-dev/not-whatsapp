"use client";

import { useUser } from "@clerk/nextjs";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useEffect, useRef } from "react";
import { api } from "../convex/_generated/api";

/** Ensures a Convex `users` row exists for the signed-in Clerk identity. */
export function StoreUserInDatabase() {
  const { isAuthenticated } = useConvexAuth();
  const { isLoaded, user } = useUser();
  const storeUser = useMutation(api.users.store);
  const existingUser = useQuery(
    api.users.me,
    isAuthenticated ? {} : "skip",
  );
  const inFlight = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || !isLoaded || !user) {
      return;
    }
    // Already provisioned — nothing to do.
    if (existingUser) {
      return;
    }
    // Still loading the me query.
    if (existingUser === undefined) {
      return;
    }
    if (inFlight.current) {
      return;
    }

    inFlight.current = true;
    void storeUser({
      name:
        user.fullName ??
        user.firstName ??
        user.username ??
        undefined,
      email: user.primaryEmailAddress?.emailAddress,
      imageUrl: user.imageUrl,
    })
      .catch((error: unknown) => {
        console.error("Failed to store user in Convex:", error);
      })
      .finally(() => {
        inFlight.current = false;
      });
  }, [isAuthenticated, isLoaded, user, storeUser, existingUser]);

  return null;
}
