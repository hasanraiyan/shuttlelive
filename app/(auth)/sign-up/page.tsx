"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { Field, GoogleButton, Notice, OrDivider, PrimaryButton } from "@/components/auth/form";
import { createClient } from "@/lib/supabase/client";

const CONFIG_ERROR = "Sign-up isn't connected yet. Add your Supabase URL and key to .env.local, then restart the dev server.";

export default function SignUpPage() {
  const router = useRouter();

  const [name, setName] = React.useState("");
  const [organization, setOrganization] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);

  const supabase = createClient();

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name, organization_name: organization },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (signUpError) {
        setError(
          signUpError.message.includes("fetch") || signUpError.message.includes("placeholder")
            ? CONFIG_ERROR
            : signUpError.message
        );
        return;
      }
      if (data.session) router.push("/dashboard");
      else setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Couldn't create the account. Try again.");
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
        options: { redirectTo: `${window.location.origin}/auth/callback?redirect=/dashboard` },
      });
      if (oauthError) setError(oauthError.message);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Google sign-up failed. Try again or use email.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Create your account"
      subtitle="Free for organizers. Set up your first tournament in a few minutes."
      panelTitle="One account for every tournament you run."
      panelBody="Club cups, academy opens, office leagues and weekend knockouts, each with its own live page."
    >
      {error && <Notice tone="error">{error}</Notice>}
      {success ? (
        <Notice tone="success">
          Check your inbox. We sent a link to <strong>{email}</strong> to confirm your account.
        </Notice>
      ) : (
        <>
          <GoogleButton onClick={handleGoogleSignIn} disabled={loading}>
            Sign up with Google
          </GoogleButton>
          <OrDivider />
          <form onSubmit={handleSignUp} className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                id="name"
                label="Your name"
                required
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <Field
                id="organization"
                label="Club or organization"
                hint="optional"
                autoComplete="organization"
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
              />
            </div>
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
              hint="at least 6 characters"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <PrimaryButton type="submit" disabled={loading} className="mt-2">
              {loading ? "Creating account…" : "Create account"}
            </PrimaryButton>
          </form>
        </>
      )}
      <p className="mt-6 text-sm text-ink-soft">
        Already have an account?{" "}
        <Link href="/sign-in" className="font-semibold text-ink underline underline-offset-4 hover:text-court">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
