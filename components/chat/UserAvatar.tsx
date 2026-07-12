import { cn } from "@/lib/utils";
import { User, Users } from "lucide-react";

export function UserAvatar({
  name,
  imageUrl,
  className,
  online,
  statusClassName,
  group,
}: {
  name: string;
  imageUrl?: string;
  className?: string;
  online?: boolean;
  statusClassName?: string;
  group?: boolean;
}) {
  const FallbackIcon = group ? Users : User;
  return (
    <div className={cn("relative shrink-0", className)}>
      <div className="flex size-full items-center justify-center overflow-hidden rounded-full bg-[#6b7c85]">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={name} className="size-full object-cover" />
        ) : (
          <FallbackIcon className="size-[55%] text-white/80" />
        )}
      </div>
      {online !== undefined && (
        <span
          aria-label={online ? "online" : "offline"}
          className={cn(
            "absolute right-0 bottom-0 size-3 rounded-full border-2 border-background",
            online ? "bg-[#00D95F]" : "bg-muted-foreground",
            statusClassName,
          )}
        />
      )}
    </div>
  );
}
