"use client";

import { useState } from "react";

// Returns a timestamp captured once on mount. Computed in a lazy initializer so
// it stays stable across renders without recomputing on every render.
export function useNow(): number {
  const [now] = useState(() => Date.now());
  return now;
}
