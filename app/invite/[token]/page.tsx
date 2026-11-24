import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AcceptInvite } from "@/components/dashboard/accept-invite";
import { Logo } from "@/components/layout/app-icon";
import { currentUserId } from "@/lib/auth";

export const metadata: Metadata = { title: "Join an organization", robots: { index: false, follow: false } };

type Preview = {
  organization: string;
  role: "OWNER" | "ORGANIZER";
  expired: boolean;
  accepted: boolean;
  email_matches: boolean;
  email_hint: string;
};

export default function InvitePage({ params }: PageProps<"/invite/[token]">) {
  return (
    <div className="flex min-h-screen flex-col bg-surface px-4 py-8 text-ink sm:px-8">
      <Logo />
      <main className="m-auto w-full max-w-md py-12">
        <Suspense fallback={<p className="text-sm text-ink-soft">Checking your invite…</p>}>
          <Content params={params} />
        </Suspense>
      </main>
    </div>
  );
}

async function Content({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const back = `/invite/${token}`;
  const { supabase, userId } = await currentUserId();

  if (!userId) {
    return (
      <>
        <h1 className="font-display text-5xl">You&apos;ve been invited</h1>
        <p className="mt-3 leading-relaxed text-ink-soft">
          Sign in with the email address the invite was sent to, and you&apos;ll come straight back here to join.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href={`/sign-in?redirect=${encodeURIComponent(back)}`}
            className="inline-flex h-11 items-center rounded-md bg-court px-5 font-semibold text-court-line hover:bg-court-deep"
          >
            Sign in
          </Link>
          <Link
            href={`/sign-up?redirect=${encodeURIComponent(back)}`}
            className="inline-flex h-11 items-center rounded-md border border-line px-5 font-semibold hover:border-ink"
          >
            Create an account
          </Link>
        </div>
      </>
    );
  }

  const { data } = /^[0-9a-f]{48}$/.test(token)
    ? await supabase.rpc("invite_preview", { p_token: token })
    : { data: null };
  const p = data as Preview | null;

  const problem = !p
    ? "This invite link isn't valid. Check you copied the whole link."
    : p.accepted
      ? "This invite has already been used."
      : p.expired
        ? "This invite has expired. Ask the organization owner for a new one."
        : !p.email_matches
          ? `This invite was sent to ${p.email_hint}. Sign out and sign in with that email to accept it.`
          : null;

  if (problem) {
    return (
      <>
        <h1 className="font-display text-5xl">Can&apos;t use this invite</h1>
        <p className="mt-3 leading-relaxed text-ink-soft">{problem}</p>
        <Link href="/dashboard" className="mt-6 inline-block font-semibold underline underline-offset-4 hover:text-court">
          Go to your dashboard
        </Link>
      </>
    );
  }

  return (
    <>
      <h1 className="font-display text-5xl">Join {p!.organization}</h1>
      <p className="mt-3 leading-relaxed text-ink-soft">
        You&apos;ll join as {p!.role === "OWNER" ? "an owner" : "an organizer"}. You&apos;ll be able to run this
        organization&apos;s tournaments{p!.role === "OWNER" ? ", invite people and manage members" : ""}.
      </p>
      <AcceptInvite token={token} />
    </>
  );
}
