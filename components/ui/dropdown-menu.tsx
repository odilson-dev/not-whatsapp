"use client";

import { Menu } from "@base-ui/react/menu";
import type * as React from "react";

import { cn } from "@/lib/utils";

function DropdownMenu(props: React.ComponentProps<typeof Menu.Root>) {
  return <Menu.Root {...props} />;
}

function DropdownMenuTrigger({
  className,
  ...props
}: React.ComponentProps<typeof Menu.Trigger>) {
  return (
    <Menu.Trigger
      data-slot="dropdown-menu-trigger"
      className={className}
      {...props}
    />
  );
}

function DropdownMenuContent({
  className,
  sideOffset = 6,
  align = "end",
  side = "bottom",
  children,
  ...props
}: React.ComponentProps<typeof Menu.Popup> & {
  sideOffset?: number;
  align?: "start" | "center" | "end";
  side?: "top" | "bottom" | "left" | "right";
}) {
  return (
    <Menu.Portal>
      <Menu.Positioner
        sideOffset={sideOffset}
        align={align}
        side={side}
        className="z-50 outline-none"
      >
        <Menu.Popup
          data-slot="dropdown-menu-content"
          className={cn(
            "min-w-[220px] origin-(--transform-origin) overflow-hidden rounded-lg bg-[#233138] py-2 text-white shadow-2xl ring-1 ring-black/40",
            "transition-[transform,opacity] data-starting-style:scale-95 data-starting-style:opacity-0 data-ending-style:scale-95 data-ending-style:opacity-0",
            className,
          )}
          {...props}
        >
          {children}
        </Menu.Popup>
      </Menu.Positioner>
    </Menu.Portal>
  );
}

function DropdownMenuItem({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<typeof Menu.Item> & {
  variant?: "default" | "destructive";
}) {
  return (
    <Menu.Item
      data-slot="dropdown-menu-item"
      className={cn(
        "flex cursor-pointer select-none items-center gap-3 px-5 py-2.5 text-sm text-white/90 outline-none transition-colors",
        "data-highlighted:bg-white/10 data-disabled:pointer-events-none data-disabled:opacity-50",
        "[&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-white/60",
        variant === "destructive" &&
          "text-red-400 [&_svg]:text-red-400 data-highlighted:bg-red-500/10",
        className,
      )}
      {...props}
    />
  );
}

function DropdownMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof Menu.Separator>) {
  return (
    <Menu.Separator
      data-slot="dropdown-menu-separator"
      className={cn("my-1 h-px bg-white/10", className)}
      {...props}
    />
  );
}

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
};
