"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";

export default function ProfilePage() {
  const [name, setName] = useState<string>("Sundara");
  const [email, setEmail] = useState<string>("sundaravelselvarajfr@gmail.com");
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setSaving(true);
    // No backend endpoint yet — log + toast.
    // eslint-disable-next-line no-console
    console.info("[profile] save (mock)", { name, email });
    await new Promise((r) => setTimeout(r, 350));
    toast.success("Saved (mock)");
    setSaving(false);
  };

  const initials =
    name
      .split(/\s+/)
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "S";

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 p-8">
      <header className="flex flex-col gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--hc-accent-coral)]">
          Settings
        </span>
        <h1 className="text-3xl font-semibold tracking-tight">Profile</h1>
        <p className="text-sm text-muted-foreground">
          Update your display name and contact email.
        </p>
      </header>

      <form onSubmit={handleSave} className="flex flex-col gap-6">
        <section className="flex items-center gap-5">
          <div
            aria-hidden
            className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-[color:var(--hc-accent-coral)] to-[#e87a5a] text-2xl font-semibold text-white shadow-[0_8px_24px_-8px_var(--hc-accent-coral-soft)]"
          >
            {initials}
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium">Avatar</span>
            <span className="text-xs text-muted-foreground">
              Initials placeholder. Image upload coming soon.
            </span>
          </div>
        </section>

        <label className="flex flex-col gap-2">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Name
          </span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="hc-glass w-full rounded-xl border border-[color:var(--color-border)] bg-[color:var(--hc-surface-elevated)] px-3 py-2 text-sm focus-visible:border-[color:var(--hc-accent-coral)] focus-visible:outline-none"
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Email
          </span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="hc-glass w-full rounded-xl border border-[color:var(--color-border)] bg-[color:var(--hc-surface-elevated)] px-3 py-2 text-sm focus-visible:border-[color:var(--hc-accent-coral)] focus-visible:outline-none"
          />
        </label>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-full bg-[color:var(--hc-accent-coral)] px-5 py-2 text-sm font-semibold text-white shadow-[0_4px_12px_var(--hc-accent-coral-soft)] transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
