"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Fancybox as NativeFancybox } from "@fancyapps/ui";
import "@fancyapps/ui/dist/fancybox/fancybox.css";

// Thin React wrapper that binds Fancybox to any descendant anchor carrying a
// `data-fancybox` attribute. Uses `display: contents` so it never affects the
// surrounding flex layout.
export function Fancybox({ children }: { children: ReactNode }) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    NativeFancybox.bind(container, "[data-fancybox]", {});

    return () => {
      NativeFancybox.unbind(container);
      NativeFancybox.close();
    };
  }, []);

  return (
    <div ref={containerRef} className="contents">
      {children}
    </div>
  );
}
