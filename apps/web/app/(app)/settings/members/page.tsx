"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Mail, UserPlus, X } from "lucide-react";
import { toast } from "sonner";

interface MemberRow {
  id: string;
  name: string;
  email: string;
  role: string;
  status: "Active" | "Pending";
  initials: string;
}

const SEED_MEMBERS: MemberRow[] = [
  {
    id: "owner",
    name: "Sundara",
    email: "sundaravelselvarajfr@gmail.com",
    role: "Owner",
    status: "Active",
    initials: "S",
  },
];

export default function MembersPage() {
  const [open, setOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSend = useCallback(
    async (e: FormEvent<HTMLFormElement>): Promise<void> => {
      e.preventDefault();
      if (!inviteEmail.trim()) {
        toast.error("Enter an email to invite.");
        return;
      }
      setSubmitting(true);
      // No backend endpoint — log + toast.
      // eslint-disable-next-line no-console
      console.info("[members] invite (mock)", inviteEmail);
      await new Promise((r) => setTimeout(r, 350));
      toast.success(`Invite sent to ${inviteEmail} (mock)`);
      setInviteEmail("");
      setSubmitting(false);
      setOpen(false);
    },
    [inviteEmail],
  );

  // Close-on-Escape for the custom modal.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 p-8">
      <header className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--hc-accent-coral)]">
            Settings
          </span>
          <h1 className="text-3xl font-semibold tracking-tight">Members</h1>
          <p className="text-sm text-muted-foreground">
            Manage who has access to this organization.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-full bg-[color:var(--hc-accent-coral)] px-4 py-2 text-sm font-semibold text-white shadow-[0_4px_12px_var(--hc-accent-coral-soft)] transition-transform hover:-translate-y-0.5"
        >
          <UserPlus size={14} />
          Invite member
        </button>
      </header>

      <section className="overflow-hidden rounded-xl border border-[color:var(--color-border)] bg-[color:var(--hc-surface-elevated)]">
        <table className="w-full text-sm">
          <thead className="border-b border-[color:var(--color-border)] bg-[color:var(--hc-surface)]">
            <tr className="text-left">
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Member
              </th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Email
              </th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Role
              </th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {SEED_MEMBERS.map((m) => (
              <tr
                key={m.id}
                className="border-b border-[color:var(--color-border)] last:border-b-0"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[color:var(--hc-accent-coral)] to-[#e87a5a] text-xs font-semibold text-white">
                      {m.initials}
                    </span>
                    <span className="font-medium">{m.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{m.email}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center rounded-full border border-[color:var(--color-border)] px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider">
                    {m.role}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1.5 text-xs">
                    <span
                      aria-hidden
                      className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500"
                    />
                    {m.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="invite-title"
          className="fixed inset-0 z-50 flex items-center justify-center"
        >
          <button
            type="button"
            aria-label="Close"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />
          <div className="relative z-10 w-[min(90vw,420px)] rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--hc-surface-elevated)] p-6 shadow-[0_24px_64px_-16px_rgba(0,0,0,0.32)]">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close dialog"
              className="absolute right-4 top-4 inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-[color:var(--hc-surface)] hover:text-foreground"
            >
              <X size={14} />
            </button>
            <h2
              id="invite-title"
              className="text-lg font-semibold tracking-tight"
            >
              Invite a member
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              They'll get an email with a link to join your organization.
            </p>
            <form onSubmit={handleSend} className="mt-5 flex flex-col gap-4">
              <label className="flex flex-col gap-2">
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Email
                </span>
                <div className="relative">
                  <Mail
                    size={14}
                    aria-hidden
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  />
                  <input
                    type="email"
                    autoFocus
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="teammate@company.com"
                    className="hc-glass w-full rounded-xl border border-[color:var(--color-border)] bg-[color:var(--hc-surface)] py-2 pl-9 pr-3 text-sm focus-visible:border-[color:var(--hc-accent-coral)] focus-visible:outline-none"
                  />
                </div>
              </label>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-full px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-full bg-[color:var(--hc-accent-coral)] px-4 py-2 text-sm font-semibold text-white shadow-[0_4px_12px_var(--hc-accent-coral-soft)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? "Sending…" : "Send invite"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
