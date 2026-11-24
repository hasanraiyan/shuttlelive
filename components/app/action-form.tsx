"use client";

import * as React from "react";
import { Notice } from "@/components/app/ui";
import type { ActionResult } from "@/lib/types";

type FormAction = (prev: ActionResult, fd: FormData) => Promise<ActionResult>;

/** A form wired to a server action, showing its success or error message. */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess = false,
}: {
  action: FormAction;
  children: (pending: boolean) => React.ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
}) {
  const [state, formAction, pending] = React.useActionState(action, { ok: true } as ActionResult);
  const ref = React.useRef<HTMLFormElement>(null);

  React.useEffect(() => {
    if (resetOnSuccess && state.ok && state.message) ref.current?.reset();
  }, [state, resetOnSuccess]);

  return (
    <form ref={ref} action={formAction} className={className}>
      {children(pending)}
      {!state.ok && (
        <div className="mt-3">
          <Notice tone="error">{state.error}</Notice>
        </div>
      )}
      {state.ok && state.message && (
        <div className="mt-3">
          <Notice tone="success">{state.message}</Notice>
        </div>
      )}
    </form>
  );
}

/** Runs a one-off server action from a button, with pending state and error display. */
export function useAction() {
  const [pending, start] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const run = React.useCallback((fn: () => Promise<ActionResult<unknown>>, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setError(null);
    start(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error);
    });
  }, []);
  return { pending, error, run, clearError: () => setError(null) };
}
