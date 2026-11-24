import * as React from "react";
import { GOOGLE_SIGN_IN_ENABLED } from "@/lib/features";
import { cn } from "@/lib/utils";

export const inputClass =
  "h-11 w-full rounded-md border border-line bg-surface px-3.5 text-[15px] text-ink outline-none placeholder:text-ink-soft/70 focus:border-court focus:ring-1 focus:ring-court";

export function Field({
  label,
  hint,
  action,
  id,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  action?: React.ReactNode;
  id: string;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm font-semibold text-ink">
          {label}
          {hint && <span className="ml-1 font-normal text-ink-soft">{hint}</span>}
        </label>
        {action}
      </div>
      <input id={id} {...props} className={cn(inputClass, props.className)} />
    </div>
  );
}

export function PrimaryButton({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cn(
        "flex h-11 w-full items-center justify-center rounded-md bg-court text-[15px] font-semibold text-court-line hover:bg-court-deep disabled:opacity-50 disabled:hover:bg-court",
        className
      )}
    />
  );
}

export function GoogleButton({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const off = !GOOGLE_SIGN_IN_ENABLED;
  return (
    <button
      type="button"
      {...props}
      onClick={off ? undefined : props.onClick}
      disabled={off || props.disabled}
      aria-describedby={off ? "google-soon" : undefined}
      className="flex h-11 w-full items-center justify-center gap-2.5 rounded-md border border-line bg-surface text-[15px] font-semibold text-ink hover:border-ink disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-line"
    >
      <svg className="size-4" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
      </svg>
      {children}
      {off && (
        <span id="google-soon" className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium text-ink-soft">
          Coming soon
        </span>
      )}
    </button>
  );
}

export function OrDivider() {
  return (
    <div className="my-5 flex items-center gap-3 text-sm text-ink-soft">
      <span className="h-px flex-1 bg-line" />
      or use email
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

export function Notice({ tone, children }: { tone: "error" | "success"; children: React.ReactNode }) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "mb-5 rounded-md border-l-4 px-4 py-3 text-sm",
        tone === "error" ? "border-fault bg-fault/10 text-ink" : "border-live bg-live/10 text-ink"
      )}
    >
      {children}
    </div>
  );
}
