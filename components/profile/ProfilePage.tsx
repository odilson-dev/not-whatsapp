"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { ArrowLeft, Camera, Loader2, Pencil, User } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";

export function ProfilePage() {
  const user = useQuery(api.users.me);
  const generateUploadUrl = useMutation(api.users.generateUploadUrl);
  const updateProfile = useMutation(api.users.updateProfile);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [isSavingName, setIsSavingName] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (user === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)] text-foreground">
        <Loader2 className="size-8 animate-spin text-[#00A884]" />
      </div>
    );
  }

  const startEditingName = () => {
    setNameDraft(user.name);
    setIsEditingName(true);
    setError(null);
  };

  const cancelEditingName = () => {
    setIsEditingName(false);
    setNameDraft("");
    setError(null);
  };

  const saveName = async () => {
    const trimmedName = nameDraft.trim();
    if (trimmedName.length === 0) {
      setError("Name cannot be empty");
      return;
    }

    if (trimmedName === user.name) {
      cancelEditingName();
      return;
    }

    setIsSavingName(true);
    setError(null);

    try {
      await updateProfile({ name: trimmedName });
      setIsEditingName(false);
      setNameDraft("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update name");
    } finally {
      setIsSavingName(false);
    }
  };

  const handleImageSelect = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be smaller than 5 MB");
      return;
    }

    setIsUploadingImage(true);
    setError(null);

    try {
      const uploadUrl = await generateUploadUrl();
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!response.ok) {
        throw new Error("Failed to upload image");
      }

      const { storageId } = (await response.json()) as {
        storageId: Id<"_storage">;
      };
      await updateProfile({ profileImageStorageId: storageId });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload image");
    } finally {
      setIsUploadingImage(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--background)] text-foreground">
      <header className="flex items-center gap-4 px-4 py-5">
        <Link
          href="/"
          className="flex items-center gap-3 text-lg text-foreground/90 transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-5" />
          <span>Profile</span>
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-lg flex-col items-center px-4 pb-10 pt-4">
        <div className="relative mb-10">
          <div className="flex size-44 items-center justify-center overflow-hidden rounded-full bg-[var(--card)] ring-1 ring-border">
            {user.profileImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.profileImage}
                alt={user.name}
                className="size-full object-cover"
              />
            ) : (
              <User className="size-20 text-foreground/30" />
            )}
            {isUploadingImage && (
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50">
                <Loader2 className="size-8 animate-spin text-[#00A884]" />
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploadingImage}
            className="absolute bottom-1 right-1 flex size-11 items-center justify-center rounded-full bg-[#00A884] text-white shadow-lg transition-transform hover:scale-105 disabled:opacity-60"
            aria-label="Change profile photo"
          >
            <Camera className="size-5" />
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageSelect}
          />
        </div>

        <div className="w-full space-y-4">
          <ProfileField
            label="Name"
            action={
              !isEditingName ? (
                <button
                  type="button"
                  onClick={startEditingName}
                  className="text-[#00A884] transition-colors hover:text-[#06cf9c]"
                  aria-label="Edit name"
                >
                  <Pencil className="size-5" />
                </button>
              ) : null
            }
          >
            {isEditingName ? (
              <div className="space-y-3">
                <input
                  value={nameDraft}
                  onChange={(event) => setNameDraft(event.target.value)}
                  className="w-full rounded-lg border border-border bg-[var(--background)] px-3 py-2 text-lg text-foreground outline-none focus:border-[#00A884]"
                  autoFocus
                  disabled={isSavingName}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      void saveName();
                    }
                    if (event.key === "Escape") {
                      cancelEditingName();
                    }
                  }}
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="bg-[#00A884] text-white hover:bg-[#06cf9c]"
                    onClick={() => void saveName()}
                    disabled={isSavingName}
                  >
                    {isSavingName ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      "Save"
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-border bg-transparent text-foreground hover:bg-accent"
                    onClick={cancelEditingName}
                    disabled={isSavingName}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-lg text-foreground">{user.name}</p>
            )}
          </ProfileField>

          <ProfileField label="E-mail">
            <p className="text-lg text-foreground break-all">
              {user.email ?? "No email on file"}
            </p>
          </ProfileField>
        </div>

        {error && (
          <p className="mt-6 w-full rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </p>
        )}
      </main>
    </div>
  );
}

function ProfileField({
  label,
  children,
  action,
}: {
  label: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-2xl bg-[var(--card)] px-5 py-4",
        action && "flex items-start justify-between gap-4",
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="mb-2 text-sm text-foreground/50">{label}</p>
        {children}
      </div>
      {action}
    </section>
  );
}
