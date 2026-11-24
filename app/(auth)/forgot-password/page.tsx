"use client";

import * as React from "react";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { Field, Notice, PrimaryButton } from "@/components/auth/form";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error: resetError } = await createClient().auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?redirect=/reset-password`,
      });
      // Show the same message whether or not the account exists, so emails can't be probed.
      if (resetError && /rate|too many/i.test(resetError.message)) {
        setError("Too many attempts. Wait a minute and try again.");
      } else {
        setSent(true);
      }
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Reset your password" subtitle="Enter your account email and we'll send you a link to choose a new password.">
      {error && <Notice tone="error">{error}</Notice>}
      {sent ? (
        <Notice tone="success">
          If an account exists for <strong>{email}</strong>, a reset link is on its way. The link works once and expires
          after an hour.
        </Notice>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field
            id="email"
            label="Email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
          <PrimaryButton type="submit" disabled={loading}>
            {loading ? "Sending…" : "Send reset link"}
          </PrimaryButton>
        </form>
      )}
      <p className="mt-6 text-sm text-ink-soft">
        Remembered it?{" "}
        <Link href="/sign-in" className="font-semibold text-ink underline underline-offset-4 hover:text-court">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
