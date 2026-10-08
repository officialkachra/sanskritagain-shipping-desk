"use client";
import { useActionState } from "react";
import type { ActionState } from "@/app/actions";

/** Wraps a server action; shows the real result (success or error). Inputs are uncontrolled, so they keep their values after an error. */
export function ActionForm({ action, children, className, submit, variant = "secondary", disabled }: {
  action: (s: ActionState, fd: FormData) => Promise<ActionState>; children?: React.ReactNode; className?: string; submit: string; variant?: "primary" | "secondary" | "danger"; disabled?: boolean;
}) {
  const [state, act, pending] = useActionState(action, undefined);
  return (
    <form action={act} className={className}>
      {children}
      <button className={`btn btn-${variant}`} disabled={pending || disabled}>{pending ? "Working…" : submit}</button>
      {state && <p className={`msg ${state.ok ? "ok" : "bad"}`} role="status">{state.message}</p>}
    </form>
  );
}

export function ActionButton({ action, label, variant = "secondary", disabled }: { action: () => Promise<ActionState>; label: string; variant?: "primary" | "secondary" | "danger"; disabled?: boolean }) {
  const [state, act, pending] = useActionState(async () => action(), undefined);
  return (
    <form action={act} className="inline-act">
      <button className={`btn btn-${variant}`} disabled={pending || disabled}>{pending ? "Working…" : label}</button>
      {state && <span className={`msg ${state.ok ? "ok" : "bad"}`} role="status">{state.message}</span>}
    </form>
  );
}
