"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { Field, GoogleButton, Notice, OrDivider, PrimaryButton, inputClass } from "@/components/auth/form";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Mode = "organizer" | "umpire";

const CONFIG_ERROR = "Sign-in isn't connected yet. Add your Supabase URL and key to .env.local, then restart the dev server.";

function SignInContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirect") || "/dashboard";

  const [mode, setMode] = React.useState<Mode>(
    searchParams.get("mode") === "umpire" ? "umpire" : "organizer"
  );
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [umpirePin, setUmpirePin] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null);

  const supabase = createClient();

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setSuccessMsg(null);
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setError(
          signInError.message.includes("fetch") || signInError.message.includes("placeholder")
            ? CONFIG_ERROR
            : signInError.message
        );
        return;
      }
      if (data.user) router.push(redirectUrl);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Sign-in failed. Check your email and password.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirectUrl)}`,
        },
      });
      if (oauthError) setError(oauthError.message);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Google sign-in failed. Try again or use email.");
    } finally {
      setLoading(false);
    }
  };

  const handleUmpirePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (umpirePin.length < 6) {
      setError("The PIN has 6 digits. Check the number your organizer gave you.");
      return;
    }
    setLoading(true);
    setSuccessMsg("Opening your court…");
    router.push(`/scorer?pin=${umpirePin}`);
  };

  return (
    <AuthShell
      title={mode === "organizer" ? "Sign in" : "Score a match"}
      subtitle={
        mode === "organizer"
          ? "Manage your tournaments, draws and courts."
          : "Enter the 6-digit PIN from your organizer to open the court you're umpiring."
      }
    >
      <div role="tablist" aria-label="Sign in as" className="mb-7 grid grid-cols-2 rounded-md bg-surface-2 p-1">
        {(
          [
            ["organizer", "Organizer"],
            ["umpire", "Umpire"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={mode === value}
            onClick={() => switchMode(value)}
            className={cn(
              "rounded py-2 text-sm font-semibold",
              mode === value ? "bg-surface text-ink shadow-sm" : "text-ink-soft hover:text-ink"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <Notice tone="error">{error}</Notice>}
      {successMsg && <Notice tone="success">{successMsg}</Notice>}

      {mode === "organizer" ? (
        <>
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
              action={
                <Link href="/forgot-password" className="text-sm text-ink-soft hover:text-ink">
                  Forgot password?
                </Link>
              }
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
        </>
      ) : (
        <form onSubmit={handleUmpirePinSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="pin" className="mb-1.5 block text-sm font-semibold">
              Court PIN
            </label>
            <input
              id="pin"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              autoFocus
              value={umpirePin}
              onChange={(e) => setUmpirePin(e.target.value.replace(/\D/g, ""))}
              placeholder="000000"
              className={cn(inputClass, "font-score h-16 text-center text-5xl tracking-[0.35em]")}
            />
          </div>
          <PrimaryButton type="submit" disabled={loading || umpirePin.length < 6}>
            {loading ? "Opening court…" : "Start scoring"}
          </PrimaryButton>
          <p className="mt-2 text-sm text-ink-soft">
            No PIN? Ask the tournament desk. You don&apos;t need an account to umpire.
          </p>
        </form>
      )}
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
