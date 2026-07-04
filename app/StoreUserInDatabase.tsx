"use client";

import { useConvexAuth, useMutation } from "convex/react";
import { useEffect } from "react";
import { api } from "../convex/_generated/api";

export function StoreUserInDatabase() {
  const { isAuthenticated } = useConvexAuth();
  const storeUser = useMutation(api.users.store);

  useEffect(() => {
    if (isAuthenticated) {
      void storeUser();
    }
  }, [isAuthenticated, storeUser]);

  return null;
}
