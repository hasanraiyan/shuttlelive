"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { Field, GoogleButton, Notice, OrDivider, PrimaryButton } from "@/components/auth/form";
import { safePath } from "@/lib/safe-redirect";
import { createClient } from "@/lib/supabase/client";

function SignInContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = safePath(searchParams.get("redirect"));
  const linkError = searchParams.get("error") === "link";

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(
    linkError ? "That sign-in link has expired or was already used. Sign in again." : null
  );

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error: signInError } = await createClient().auth.signInWithPassword({ email, password });
      if (signInError) {
        // Same message for unknown email and wrong password, so accounts can't be probed.
        setError(
          /confirm/i.test(signInError.message)
            ? "Confirm your email first. Check your inbox for the link we sent."
            : "That email and password don't match. Try again or reset your password."
        );
        return;
      }
      router.replace(redirectTo);
      router.refresh();
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setLoading(true);
    const { error: oauthError } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirectTo)}` },
    });
    if (oauthError) {
      setError("Google sign-in isn't available right now. Use your email instead.");
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Sign in" subtitle="Manage your tournaments, draws and live scoring.">
      {error && <Notice tone="error">{error}</Notice>}
      <GoogleButton onClick={handleGoogleSignIn} disabled={loading}>
        Continue with Google
      </GoogleButton>
      <OrDivider />
      <form onSubmit={handleEmailSignIn} className="flex flex-col gap-4">
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
        <Field
          id="password"
          label="Password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <PrimaryButton type="submit" disabled={loading} className="mt-2">
          {loading ? "Signing in…" : "Sign in"}
        </PrimaryButton>
      </form>
      <p className="mt-6 text-sm text-ink-soft">
        New to ShuttleLive?{" "}
        <Link href="/sign-up" className="font-semibold text-ink underline underline-offset-4 hover:text-court">
          Create an account
        </Link>
      </p>
    </AuthShell>
  );
}

export default function SignInPage() {
  return (
    <React.Suspense fallback={<div className="flex min-h-screen items-center justify-center text-sm text-ink-soft">Loading…</div>}>
      <SignInContent />
    </React.Suspense>
  );
}
