"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { Field, Notice, PrimaryButton } from "@/components/auth/form";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [hasSession, setHasSession] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => setHasSession(Boolean(data.user)));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError("Use at least 8 characters.");
    if (password !== confirm) return setError("The two passwords don't match.");
    setLoading(true);
    const { error: updateError } = await createClient().auth.updateUser({ password });
    setLoading(false);
    if (updateError) {
      setError(
        /different from the old/i.test(updateError.message)
          ? "Choose a password you haven't used before."
          : /weak|short|characters/i.test(updateError.message)
            ? "That password is too weak. Use at least 8 characters with a mix of letters and numbers."
            : "Couldn't change the password. Request a new reset link and try again."
      );
      return;
    }
    router.replace("/dashboard");
    router.refresh();
  };

  if (hasSession === false) {
    return (
      <AuthShell title="Link expired" subtitle="This reset link is no longer valid.">
        <Notice tone="error">Reset links work once and expire after an hour. Request a new one.</Notice>
        <Link href="/forgot-password" className="mt-6 font-semibold text-ink underline underline-offset-4 hover:text-court">
          Send a new reset link
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Choose a new password" subtitle="You'll stay signed in after saving it.">
      {error && <Notice tone="error">{error}</Notice>}
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field
          id="password"
          label="New password"
          hint="at least 8 characters"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Field
          id="confirm"
          label="Type it again"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
        <PrimaryButton type="submit" disabled={loading || hasSession === null}>
          {loading ? "Saving…" : "Save new password"}
        </PrimaryButton>
      </form>
    </AuthShell>
  );
}
