import { cn } from "@/lib/utils";
import { User } from "lucide-react";

export function UserAvatar({
  name,
  imageUrl,
  className,
}: {
  name: string;
  imageUrl?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#6b7c85]",
        className,
      )}
    >
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt={name} className="size-full object-cover" />
      ) : (
        <User className="size-[55%] text-white/80" />
      )}
    </div>
  );
}
