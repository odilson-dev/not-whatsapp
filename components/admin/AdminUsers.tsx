"use client";

import { UserAvatar } from "@/components/chat/UserAvatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import {
  Ban,
  MoreVertical,
  Search,
  Shield,
  ShieldOff,
  Trash2,
  UserCheck,
} from "lucide-react";
import { useState } from "react";
import { Modal } from "./Modal";
import { formatDate, formatRelative, isOnline } from "./format";
import { useNow } from "./useNow";

type Filter = "all" | "active" | "admins" | "banned";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "admins", label: "Admins" },
  { id: "banned", label: "Banned" },
];

export function AdminUsers({
  currentUserId,
}: {
  currentUserId: Id<"users"> | undefined;
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const now = useNow();
  const data = useQuery(api.admin.listUsers, {
    search: search || undefined,
    filter,
    now,
  });

  const setBanned = useMutation(api.admin.setUserBanned);
  const setRole = useMutation(api.admin.setUserRole);
  const deleteUser = useMutation(api.admin.deleteUser);

  const [banTarget, setBanTarget] = useState<{
    id: Id<"users">;
    name: string;
  } | null>(null);
  const [banReason, setBanReason] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{
    id: Id<"users">;
    name: string;
  } | null>(null);
  const [detailId, setDetailId] = useState<Id<"users"> | null>(null);
  const [busy, setBusy] = useState(false);

  const users = data?.users ?? [];

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    try {
      await action();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="pl-9"
          />
        </div>
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors " +
                (filter === f.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground")
              }
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="text-xs text-muted-foreground">
        {data === undefined
          ? "Loading…"
          : `${data.total} user${data.total === 1 ? "" : "s"}`}
      </div>

      <div className="overflow-hidden rounded-xl ring-1 ring-foreground/10">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">User</th>
              <th className="hidden px-4 py-3 font-medium md:table-cell">
                Joined
              </th>
              <th className="hidden px-4 py-3 font-medium sm:table-cell">
                Last seen
              </th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="w-10 px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.map((u) => {
              const online = isOnline(u.lastSeen);
              const isAdmin = u.role === "admin";
              const isSelf = u._id === currentUserId;
              return (
                <tr key={u._id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <UserAvatar
                        name={u.name}
                        imageUrl={u.profileImage}
                        className="size-9"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 font-medium">
                          <span className="truncate">{u.name}</span>
                          {isSelf ? (
                            <span className="text-xs text-muted-foreground">
                              (you)
                            </span>
                          ) : null}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {u.email ?? "no email"}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                    {formatDate(u.createdAt)}
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">
                    {formatRelative(u.lastSeen)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {u.isBanned ? (
                        <Badge variant="destructive">
                          <Ban /> Banned
                        </Badge>
                      ) : online ? (
                        <Badge variant="success">Online</Badge>
                      ) : (
                        <Badge variant="secondary">Offline</Badge>
                      )}
                      {isAdmin ? (
                        <Badge variant="default">
                          <Shield /> Admin
                        </Badge>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        aria-label={`Manage ${u.name}`}
                        className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        <MoreVertical className="size-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => setDetailId(u._id)}>
                          <UserCheck /> View details
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={isSelf}
                          onClick={() =>
                            run(() =>
                              setRole({
                                userId: u._id,
                                role: isAdmin ? "user" : "admin",
                              }),
                            )
                          }
                        >
                          {isAdmin ? <ShieldOff /> : <Shield />}
                          {isAdmin ? "Remove admin" : "Make admin"}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {u.isBanned ? (
                          <DropdownMenuItem
                            onClick={() =>
                              run(() =>
                                setBanned({ userId: u._id, banned: false }),
                              )
                            }
                          >
                            <UserCheck /> Unban user
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            variant="destructive"
                            disabled={isSelf}
                            onClick={() => {
                              setBanReason("");
                              setBanTarget({ id: u._id, name: u.name });
                            }}
                          >
                            <Ban /> Ban user
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          variant="destructive"
                          disabled={isSelf}
                          onClick={() =>
                            setDeleteTarget({ id: u._id, name: u.name })
                          }
                        >
                          <Trash2 /> Delete user
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              );
            })}
            {data !== undefined && users.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-10 text-center text-muted-foreground"
                >
                  No users found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {/* Ban modal */}
      <Modal
        open={banTarget !== null}
        onClose={() => setBanTarget(null)}
        title={`Ban ${banTarget?.name ?? ""}?`}
        description="They will be blocked from sending messages and starting chats, and shown a lockout screen."
      >
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
          Reason (optional, shown to the user)
        </label>
        <Input
          value={banReason}
          onChange={(e) => setBanReason(e.target.value)}
          placeholder="e.g. Spam / abuse"
          autoFocus
        />
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setBanTarget(null)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={busy}
            onClick={() => {
              if (!banTarget) return;
              const id = banTarget.id;
              run(() =>
                setBanned({
                  userId: id,
                  banned: true,
                  reason: banReason || undefined,
                }),
              ).then(() => setBanTarget(null));
            }}
          >
            <Ban /> Ban user
          </Button>
        </div>
      </Modal>

      {/* Delete modal */}
      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title={`Delete ${deleteTarget?.name ?? ""}?`}
        description="This permanently removes the account, their direct chats, and their messages. This cannot be undone."
      >
        <div className="mt-2 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setDeleteTarget(null)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={busy}
            onClick={() => {
              if (!deleteTarget) return;
              const id = deleteTarget.id;
              run(() => deleteUser({ userId: id })).then(() =>
                setDeleteTarget(null),
              );
            }}
          >
            <Trash2 /> Delete permanently
          </Button>
        </div>
      </Modal>

      {/* User detail modal */}
      <UserDetailModal
        userId={detailId}
        onClose={() => setDetailId(null)}
      />
    </div>
  );
}

function UserDetailModal({
  userId,
  onClose,
}: {
  userId: Id<"users"> | null;
  onClose: () => void;
}) {
  const detail = useQuery(
    api.admin.getUserDetail,
    userId ? { userId } : "skip",
  );

  return (
    <Modal open={userId !== null} onClose={onClose} title="User details">
      {detail === undefined ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          Loading…
        </div>
      ) : detail === null ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          User not found.
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex items-center gap-4">
            <UserAvatar
              name={detail.user.name}
              imageUrl={detail.user.profileImage}
              className="size-16"
            />
            <div>
              <div className="flex items-center gap-2 text-lg font-semibold">
                {detail.user.name}
                {detail.user.role === "admin" ? (
                  <Badge variant="default">
                    <Shield /> Admin
                  </Badge>
                ) : null}
                {detail.user.isBanned ? (
                  <Badge variant="destructive">
                    <Ban /> Banned
                  </Badge>
                ) : null}
              </div>
              <div className="text-sm text-muted-foreground">
                {detail.user.email ?? "no email"}
              </div>
              <div className="text-xs text-muted-foreground">
                Joined {formatDate(detail.user.createdAt)} · last seen{" "}
                {formatRelative(detail.user.lastSeen)}
              </div>
            </div>
          </div>

          {detail.user.isBanned && detail.user.banReason ? (
            <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              Ban reason: {detail.user.banReason}
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <MiniStat label="Messages" value={detail.stats.messages} />
            <MiniStat label="Conversations" value={detail.stats.conversations} />
            <MiniStat label="Groups created" value={detail.stats.groupsCreated} />
            <MiniStat label="Blocks made" value={detail.stats.blocksMade} />
            <MiniStat label="Blocked by" value={detail.stats.blockedBy} />
          </div>
        </div>
      )}
    </Modal>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-muted/50 p-3">
      <div className="text-xl font-semibold tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
