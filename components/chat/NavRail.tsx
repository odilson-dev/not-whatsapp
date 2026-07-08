"use client";

import { UserAvatar } from "@/components/chat/UserAvatar";
import { cn } from "@/lib/utils";
import { CircleDashed, type LucideIcon, MessageSquare, Images, Settings } from "lucide-react";
import Link from "next/link";

export type ChatSection = "chats" | "status" | "media" | "settings";

function RailButton({
  icon: Icon,
  label,
  active,
  onClick,
  dot,
  badge,
}: {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  onClick: () => void;
  dot?: boolean;
  badge?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex size-11 items-center justify-center rounded-full transition-colors [&_svg]:size-6",
        active
          ? "bg-accent text-foreground"
          : "text-foreground/60 hover:bg-accent hover:text-foreground",
      )}
    >
      <Icon />
      {dot ? (
        <span className="absolute right-2 top-2 size-2 rounded-full bg-[#00A884] ring-2 ring-[var(--sidebar)]" />
      ) : null}
      {badge && badge > 0 ? (
        <span className="absolute right-1 top-1 flex min-w-4 items-center justify-center rounded-full bg-[#00A884] px-1 text-[10px] font-semibold text-white ring-2 ring-[var(--sidebar)]">
          {badge > 99 ? "99+" : badge}
        </span>
      ) : null}
    </button>
  );
}

export function NavRail({
  active,
  onChange,
  currentUser,
  unreadChats,
  hasStatusUpdates,
  className,
}: {
  active: ChatSection;
  onChange: (section: ChatSection) => void;
  currentUser: { name: string; profileImage?: string };
  unreadChats?: number;
  hasStatusUpdates?: boolean;
  className?: string;
}) {
  return (
    <nav
      className={cn(
        "flex w-16 shrink-0 flex-col items-center gap-1 border-r border-border bg-[var(--sidebar)] py-3",
        className,
      )}
    >
      <RailButton
        icon={MessageSquare}
        label="Chats"
        active={active === "chats"}
        onClick={() => onChange("chats")}
        badge={unreadChats}
      />
      <RailButton
        icon={CircleDashed}
        label="Status"
        active={active === "status"}
        onClick={() => onChange("status")}
        dot={hasStatusUpdates}
      />

      <div className="mt-auto flex flex-col items-center gap-1">
        <RailButton
          icon={Images}
          label="Media"
          active={active === "media"}
          onClick={() => onChange("media")}
        />
        <RailButton
          icon={Settings}
          label="Settings"
          active={active === "settings"}
          onClick={() => onChange("settings")}
        />
        <Link
          href="/profile"
          aria-label="Profile"
          title="Profile"
          className="mt-1 rounded-full ring-2 ring-transparent transition-all hover:ring-border"
        >
          <UserAvatar
            name={currentUser.name}
            imageUrl={currentUser.profileImage}
            className="size-9"
          />
        </Link>
      </div>
    </nav>
  );
}
