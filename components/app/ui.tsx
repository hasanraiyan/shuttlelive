import * as React from "react";
import { cn } from "@/lib/utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
};

export function Button({ variant = "primary", size = "md", className, ...props }: ButtonProps) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md font-semibold whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" && "h-8 px-3 text-sm",
        size === "md" && "h-10 px-4 text-sm",
        size === "lg" && "h-14 px-5 text-base",
        variant === "primary" && "bg-court text-court-line hover:bg-court-deep",
        variant === "secondary" && "border border-line bg-surface text-ink hover:border-ink",
        variant === "ghost" && "text-ink-soft hover:bg-surface-2 hover:text-ink",
        variant === "danger" && "border border-fault/40 bg-surface text-fault hover:bg-fault hover:text-on-dark",
        className
      )}
    />
  );
}

export const fieldClass =
  "w-full rounded-md border border-line bg-surface px-3 text-[15px] text-ink outline-none placeholder:text-ink-soft/70 focus:border-court focus:ring-1 focus:ring-court disabled:opacity-60";

export function Label({ htmlFor, children, hint }: { htmlFor: string; children: React.ReactNode; hint?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-semibold text-ink">
      {children}
      {hint && <span className="ml-1 font-normal text-ink-soft">{hint}</span>}
    </label>
  );
}

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(fieldClass, "h-10", className)} />;
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(fieldClass, "min-h-24 py-2 leading-relaxed", className)} />;
}

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(fieldClass, "h-10 pr-8", className)} />;
}

export function Notice({ tone, children }: { tone: "error" | "success" | "info"; children: React.ReactNode }) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "rounded-md border-l-4 px-3 py-2 text-sm text-ink",
        tone === "error" && "border-fault bg-fault/10",
        tone === "success" && "border-live bg-live/10",
        tone === "info" && "border-line bg-surface-2"
      )}
    >
      {children}
    </p>
  );
}

export function Section({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("border-t border-line pt-6", className)}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <h2 className="font-display text-2xl">{title}</h2>
          {description && <p className="mt-1 text-sm leading-relaxed text-ink-soft">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function StatusPill({ tone, children }: { tone: "live" | "draft" | "done" | "plain"; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold",
        tone === "live" && "bg-live/15 text-court-deep",
        tone === "draft" && "bg-warn/15 text-ink",
        tone === "done" && "bg-surface-2 text-ink-soft",
        tone === "plain" && "border border-line text-ink-soft"
      )}
    >
      {tone === "live" && <span className="size-1.5 rounded-full bg-live" aria-hidden="true" />}
      {children}
    </span>
  );
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-line px-5 py-8 text-center">
      <p className="font-semibold">{title}</p>
      {children && <div className="mt-1 text-sm text-ink-soft">{children}</div>}
    </div>
  );
}
