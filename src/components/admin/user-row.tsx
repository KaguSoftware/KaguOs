"use client";

import { useState } from "react";
import {
  Building2,
  ChevronDown,
  KeyRound,
  Loader2,
  Palette,
  Trash2,
} from "lucide-react";
import {
  deleteUser,
  setClientProjects,
  setUserPassword,
  setUserRole,
  updateAccess,
  type AccessMap,
} from "@/lib/actions/admin";
import { Button, ConfirmButton } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { AdminColorPicker } from "@/components/account/color-form";
import { useAction } from "@/lib/use-action";
import { memberColorCss } from "@/lib/colors";
import {
  PROFILE_KINDS,
  PROFILE_KIND_LABELS,
  SECTIONS,
  SECTION_LABELS,
  type ProfileKind,
  type Section,
} from "@/lib/types";
import type { SectionAccess } from "@/lib/data/session";
import { cn, formatRelative } from "@/lib/utils";

/** One project a client account can be pointed at. */
export type AdminProject = {
  id: string;
  name: string;
  client: string | null;
  status: string;
};

export type AdminUser = {
  id: string;
  email: string;
  full_name: string | null;
  /** Team member or client — the app's role axis (0062, 0072). */
  kind: ProfileKind;
  is_admin: boolean;
  color: string | null;
  /** section -> tier. A missing key means no access to that section at all. */
  access: AccessMap;
  /** Projects shared with this account. Meaningful only while kind is 'client'. */
  projectIds: string[];
  last_seen_at: string | null;
};

function shortLabel(section: Section) {
  return SECTION_LABELS[section].replace("Kagu ", "");
}

/** "Last seen" line. Within ~5 min counts as online (the bump throttle window). */
function LastSeen({ at }: { at: string | null }) {
  if (!at) return <p className="text-xs text-faint">Never signed in</p>;
  const online = new Date().getTime() - Date.parse(at) < 6 * 60 * 1000;
  return (
    <p className="flex items-center gap-1.5 text-xs text-faint">
      <span
        aria-hidden
        className={cn(
          "size-1.5 rounded-full",
          online ? "bg-primary" : "bg-line-strong"
        )}
      />
      {online ? "Online now" : `Seen ${formatRelative(at)}`}
    </p>
  );
}

export function UserRow({
  user,
  isSelf,
  projects,
}: {
  user: AdminUser;
  isSelf: boolean;
  projects: AdminProject[];
}) {
  const { pending: busy, run } = useAction();
  const [open, setOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showColor, setShowColor] = useState(false);
  const [newPassword, setNewPassword] = useState("");

  const isClientAccount = user.kind === "client";
  const granted = SECTIONS.filter((s) => user.access[s]);
  const shared = projects.filter((p) => user.projectIds.includes(p.id));

  function apply(access: AccessMap, isAdmin: boolean) {
    run(() => updateAccess(user.id, access, isAdmin));
  }

  /**
   * Set one section to a tier, or remove it entirely with null. Every section is
   * independent — no implied grants, nothing that refuses to come off. Work used
   * to force Learn and Debug on; 0051 removed that rule.
   */
  function setSection(section: Section, tier: SectionAccess | null) {
    const next: AccessMap = { ...user.access };
    if (tier === null) delete next[section];
    else next[section] = tier;
    apply(next, user.is_admin);
  }

  /** Share a project with this client, or stop sharing it. */
  function toggleProject(projectId: string) {
    const next = user.projectIds.includes(projectId)
      ? user.projectIds.filter((id) => id !== projectId)
      : [...user.projectIds, projectId];
    run(() => setClientProjects(user.id, next));
  }

  return (
    <div className="border-b border-line last:border-b-0">
      {/* Collapsed summary — identity, access at a glance, one way in */}
      <div className="flex items-center gap-3 px-4 py-2.5">
        <span
          aria-hidden
          className="size-2 shrink-0 rounded-full"
          style={{ backgroundColor: memberColorCss(user.id, user.color) }}
        />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 truncate text-sm font-medium text-ink">
            {user.full_name || user.email}
            {isSelf && <span className="text-xs font-normal text-faint">(you)</span>}
            {user.is_admin && <Badge tone="green">admin</Badge>}
            {isClientAccount && <Badge tone="info">client</Badge>}
          </p>
          <p className="truncate text-[calc(13px*var(--text-scale,1))] text-faint">{user.email}</p>
          <LastSeen at={user.last_seen_at} />
        </div>

        {/* What this account can reach, compact. A client's answer is a list of
            projects, not a list of sections — same slot, different question,
            because that IS the difference between the two roles. */}
        <p className="hidden max-w-[45%] truncate text-[calc(13px*var(--text-scale,1))] text-muted sm:block">
          {isClientAccount
            ? shared.length > 0
              ? shared.map((p) => p.name).join(" · ")
              : "No projects shared"
            : granted.length > 0
              ? granted
                  .map((s) =>
                    user.access[s] === "read" ? `${shortLabel(s)} (view)` : shortLabel(s)
                  )
                  .join(" · ")
              : "No sections"}
        </p>

        {busy && <Loader2 className="size-3.5 shrink-0 animate-spin text-faint" aria-hidden />}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[calc(13px*var(--text-scale,1))] text-muted transition-colors duration-150 hover:bg-raised hover:text-ink"
        >
          Manage
          <ChevronDown
            className={cn("size-3.5 transition-transform duration-150", open && "rotate-180")}
            aria-hidden
          />
        </button>
      </div>

      {/* Expanded: everything editable lives here, out of the default view */}
      {open && (
        <div className="space-y-4 border-t border-line bg-surface/60 px-4 py-3.5">
          {/* ---- Role. Above everything else, because it decides what the rest
              of this panel even means: a client holds no sections and a member
              holds no project assignments, and the database refuses both the
              other way round. */}
          <div>
            <p className="mb-2 text-xs font-medium text-faint">Role</p>
            <div
              role="group"
              aria-label="Account role"
              className="flex w-fit overflow-hidden rounded-md border border-line"
            >
              {PROFILE_KINDS.map((kind) => (
                <button
                  key={kind}
                  type="button"
                  aria-pressed={user.kind === kind}
                  // Turning your own account into a client would remove the
                  // page you are standing on, with no screen left to undo it.
                  disabled={busy || (isSelf && kind === "client")}
                  onClick={() => {
                    if (user.kind === kind) return;
                    run(() => setUserRole(user.id, kind), {
                      success:
                        kind === "client"
                          ? "Now a client — pick their projects below."
                          : "Now a team member.",
                    });
                  }}
                  className={cn(
                    "px-3 py-1 text-[calc(13px*var(--text-scale,1))] transition-colors duration-150 disabled:opacity-50",
                    user.kind === kind
                      ? "bg-raised text-ink"
                      : "text-faint hover:text-muted"
                  )}
                >
                  {PROFILE_KIND_LABELS[kind]}
                </button>
              ))}
            </div>
            <p className="mt-1.5 max-w-[70ch] text-[calc(12px*var(--text-scale,1))] text-faint">
              {isClientAccount
                ? "A client sees only the projects shared with them and their own input pack. No sections, no team chat, no roster — enforced in the database, not just hidden here."
                : "A team member belongs to sections. Switching them to a client removes every section they hold."}
            </p>
          </div>

          {isClientAccount ? (
            /* ---- Client: which projects. The exact counterpart of the
                sections grid below — same shape, same immediacy, different
                question. */
            <div>
              <p className="mb-2 text-xs font-medium text-faint">
                Projects shared with them
              </p>
              {projects.length === 0 ? (
                <p className="text-[calc(13px*var(--text-scale,1))] text-faint">
                  No projects exist yet. Create one in Work first.
                </p>
              ) : (
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {projects.map((project) => (
                    <Checkbox
                      key={project.id}
                      size="sm"
                      className="min-w-0 text-[calc(13px*var(--text-scale,1))]"
                      label={
                        <span className="min-w-0">
                          <span className="text-ink">{project.name}</span>
                          {project.client && (
                            <span className="text-faint"> · {project.client}</span>
                          )}
                        </span>
                      }
                      checked={user.projectIds.includes(project.id)}
                      onChange={() => toggleProject(project.id)}
                      disabled={busy}
                    />
                  ))}
                </div>
              )}
              <p className="mt-2 flex items-start gap-1.5 text-[calc(12px*var(--text-scale,1))] text-faint">
                <Building2 className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                They&rsquo;ll see the project&rsquo;s name and its input pack —
                never the repo, the notes, the board, or anyone else&rsquo;s
                project.
              </p>
            </div>
          ) : (
            <div>
              <p className="mb-2 text-xs font-medium text-faint">Access</p>
              {/* Two decisions per section, kept visually separate: the
                  checkbox says WHETHER, the segmented control says HOW MUCH. A
                  tri-state checkbox would collapse them into one control with a
                  state nobody can name. View/Edit only appears once the section
                  is on — there is no tier for access you don't have. */}
              <div className="grid gap-1.5 sm:grid-cols-2">
                {SECTIONS.map((section) => {
                  const tier = user.access[section];
                  return (
                    <div key={section} className="flex items-center gap-2">
                      <Checkbox
                        size="sm"
                        className="min-w-0 flex-1 text-[calc(13px*var(--text-scale,1))]"
                        label={shortLabel(section)}
                        checked={Boolean(tier)}
                        onChange={() => setSection(section, tier ? null : "write")}
                        disabled={busy}
                      />
                      {tier && (
                        <div
                          role="group"
                          aria-label={`${shortLabel(section)} access level`}
                          className="flex shrink-0 overflow-hidden rounded-md border border-line"
                        >
                          {(["read", "write"] as const).map((level) => (
                            <button
                              key={level}
                              type="button"
                              aria-pressed={tier === level}
                              disabled={busy}
                              onClick={() => setSection(section, level)}
                              className={cn(
                                "px-2 py-0.5 text-[calc(11px*var(--text-scale,1))] transition-colors duration-150 disabled:opacity-50",
                                tier === level
                                  ? "bg-raised text-ink"
                                  : "text-faint hover:text-muted"
                              )}
                            >
                              {level === "read" ? "View" : "Edit"}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="mt-2.5 border-t border-line pt-2.5">
                <Checkbox
                  size="sm"
                  className="text-[calc(13px*var(--text-scale,1))]"
                  label="Admin — full write access everywhere, plus this page"
                  checked={user.is_admin}
                  onChange={() => apply(user.access, !user.is_admin)}
                  disabled={busy || isSelf}
                />
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowColor((v) => !v);
                setShowPassword(false);
              }}
            >
              <Palette className="size-3.5" aria-hidden />
              Color
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowPassword((v) => !v);
                setShowColor(false);
              }}
            >
              <KeyRound className="size-3.5" aria-hidden />
              Password
            </Button>
            {!isSelf && (
              <ConfirmButton
                size="sm"
                confirmLabel="Really delete?"
                onConfirm={() =>
                  run(() => deleteUser(user.id), { success: "User deleted." })
                }
              >
                <Trash2 className="size-3.5" aria-hidden />
                Delete
              </ConfirmButton>
            )}
          </div>

          {showColor && <AdminColorPicker userId={user.id} current={user.color} />}

          {showPassword && (
            <form
              className="flex max-w-md items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                run(() => setUserPassword(user.id, newPassword), {
                  success: "Password set.",
                  onSuccess: () => {
                    setNewPassword("");
                    setShowPassword(false);
                  },
                });
              }}
            >
              <Input
                type="text"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                minLength={8}
                required
                placeholder="New temp password (min 8 chars)"
                className="h-8 text-[calc(13px*var(--text-scale,1))]"
              />
              <Button type="submit" variant="primary" size="sm" disabled={busy}>
                Set
              </Button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
