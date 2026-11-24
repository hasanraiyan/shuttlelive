"use client";

import * as React from "react";
import Link from "next/link";
import { ActionForm, useAction } from "@/components/app/action-form";
import { Button, EmptyState, Input, Label, Notice, Section, Select, StatusPill } from "@/components/app/ui";
import {
  changeMemberRole,
  createInvite,
  deleteOrganization,
  removeMember,
  renameOrganization,
  revokeInvite,
  setOrganizationLogo,
} from "@/lib/actions/orgs";
import { formatDateRange, siteUrl } from "@/lib/format";
import { prepareImage, ACCEPTED } from "@/lib/image";
import { createClient } from "@/lib/supabase/client";
import { MEDIA_BUCKET, mediaUrl } from "@/lib/supabase/env";
import type { ActionResult, Organization, OrgInvite, OrgMember, OrgRole, Tournament } from "@/lib/types";

type Props = {
  org: Organization;
  myRole: OrgRole;
  members: OrgMember[];
  invites: OrgInvite[];
  tournaments: Tournament[];
  me: string;
};

const ROLE_LABEL: Record<OrgRole, string> = { OWNER: "Owner", ORGANIZER: "Organizer" };

export function OrgManager({ org, myRole, members, invites, tournaments, me }: Props) {
  const owner = myRole === "OWNER";
  return (
    <div className="space-y-12">
      <header>
        <div className="flex items-center gap-4">
          {mediaUrl(org.logo_path) && (
            // eslint-disable-next-line @next/next/no-img-element -- organization logo from storage
            <img src={mediaUrl(org.logo_path)!} alt="" className="size-14 rounded-lg border border-line object-cover" />
          )}
          <div>
            <StatusPill tone="plain">You are {owner ? "an owner" : "an organizer"}</StatusPill>
            <h1 className="mt-2 font-display text-[clamp(2.25rem,5vw,3.5rem)]">{org.name}</h1>
          </div>
        </div>
        <p className="mt-2 max-w-2xl text-sm text-ink-soft">
          Everyone here can run this organization&apos;s tournaments: players, draws and scoring. Owners can also invite
          people, change roles and delete tournaments.
        </p>
      </header>

      <Section
        title="Tournaments"
        action={
          <Link
            href="/dashboard/new"
            className="inline-flex h-9 items-center rounded-md bg-court px-3 text-sm font-semibold text-court-line hover:bg-court-deep"
          >
            Create a tournament
          </Link>
        }
      >
        {tournaments.length ? (
          <ul className="divide-y divide-line border-y border-line">
            {tournaments.map((t) => (
              <li key={t.id}>
                <Link href={`/dashboard/t/${t.id}`} className="flex items-center justify-between gap-3 py-3 hover:bg-surface-2 sm:px-3">
                  <span className="truncate font-medium">{t.name}</span>
                  <span className="shrink-0 text-sm text-ink-soft">{formatDateRange(t.start_date, t.end_date)}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No tournaments yet">
            When you create a tournament, choose this organization under &quot;Belongs to&quot;.
          </EmptyState>
        )}
      </Section>

      <Members orgId={org.id} members={members} owner={owner} me={me} />
      {owner && <Invites orgId={org.id} invites={invites} />}
      {owner && <Details org={org} />}
      {owner && <DeleteOrg org={org} />}
    </div>
  );
}

function Members({ orgId, members, owner, me }: { orgId: string; members: OrgMember[]; owner: boolean; me: string }) {
  const { pending, error, run } = useAction();
  return (
    <Section title={`Members (${members.length})`}>
      <ul className="divide-y divide-line border-y border-line">
        {members.map((m) => {
          const self = m.user_id === me;
          return (
            <li key={m.user_id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <span className="min-w-0 truncate">
                {m.email ?? "Member"}
                {self && <span className="ml-2 text-sm text-ink-soft">(you)</span>}
              </span>
              <span className="flex items-center gap-2">
                {owner && !self ? (
                  <Select
                    aria-label={`Role for ${m.email ?? "member"}`}
                    className="h-9 w-36"
                    disabled={pending}
                    value={m.role}
                    onChange={(e) => run(() => changeMemberRole(orgId, m.user_id, e.target.value))}
                  >
                    <option value="ORGANIZER">Organizer</option>
                    <option value="OWNER">Owner</option>
                  </Select>
                ) : (
                  <span className="text-sm text-ink-soft">{ROLE_LABEL[m.role]}</span>
                )}
                {(owner || self) && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() =>
                      run(
                        () => removeMember(orgId, m.user_id),
                        self ? "Leave this organization? You'll lose access to its tournaments." : `Remove ${m.email ?? "this member"}?`
                      )
                    }
                  >
                    {self ? "Leave" : "Remove"}
                  </Button>
                )}
              </span>
            </li>
          );
        })}
      </ul>
      {error && (
        <div className="mt-3">
          <Notice tone="error">{error}</Notice>
        </div>
      )}
    </Section>
  );
}

function Invites({ orgId, invites }: { orgId: string; invites: OrgInvite[] }) {
  const [state, formAction, pending] = React.useActionState(
    createInvite.bind(null, orgId) as (p: ActionResult<{ token: string }>, fd: FormData) => Promise<ActionResult<{ token: string }>>,
    { ok: true } as ActionResult<{ token: string }>
  );
  const revoke = useAction();
  const formRef = React.useRef<HTMLFormElement>(null);
  React.useEffect(() => {
    if (state.ok && state.data) formRef.current?.reset();
  }, [state]);
  const [now] = React.useState(() => Date.now());

  return (
    <Section
      title="Invite people"
      description="Each invite link works once, for the email you enter, and expires after 7 days. Send it however you like."
    >
      <form ref={formRef} action={formAction} className="flex max-w-2xl flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1">
          <Label htmlFor="invite-email">Email</Label>
          <Input id="invite-email" name="email" type="email" required maxLength={320} placeholder="friend@example.com" />
        </div>
        <div className="w-40">
          <Label htmlFor="invite-role">Role</Label>
          <Select id="invite-role" name="role" defaultValue="ORGANIZER">
            <option value="ORGANIZER">Organizer</option>
            <option value="OWNER">Owner</option>
          </Select>
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create invite link"}
        </Button>
      </form>
      {!state.ok && (
        <div className="mt-3">
          <Notice tone="error">{state.error}</Notice>
        </div>
      )}
      {state.ok && state.data && (
        <div className="mt-3">
          <InviteLink token={state.data.token} note={state.message} />
        </div>
      )}

      {invites.length > 0 && (
        <ul className="mt-6 divide-y divide-line border-y border-line">
          {invites.map((i) => {
            const expired = Date.parse(i.expires_at) < now;
            return (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <span className="min-w-0">
                  <span className="block truncate">{i.email}</span>
                  <span className="text-sm text-ink-soft">
                    {ROLE_LABEL[i.role]}, {expired ? "expired" : "waiting to be accepted"}
                  </span>
                </span>
                <span className="flex gap-1">
                  {!expired && <CopyButton text={siteUrl(`/invite/${i.token}`)} />}
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={revoke.pending}
                    onClick={() => revoke.run(() => revokeInvite(orgId, i.id), `Cancel the invite for ${i.email}?`)}
                  >
                    {expired ? "Remove" : "Cancel invite"}
                  </Button>
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {revoke.error && (
        <div className="mt-3">
          <Notice tone="error">{revoke.error}</Notice>
        </div>
      )}
    </Section>
  );
}

function InviteLink({ token, note }: { token: string; note?: string }) {
  const url = siteUrl(`/invite/${token}`);
  return (
    <div className="rounded-md bg-surface-2 p-3 text-sm">
      {note && <p className="mb-2 font-semibold">{note} Send them this link:</p>}
      <div className="flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 truncate">{url}</code>
        <CopyButton text={url} />
        <a
          href={`https://wa.me/?text=${encodeURIComponent(`Join me on ShuttleLive: ${url}`)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md bg-court px-3 py-1.5 font-semibold text-court-line hover:bg-court-deep"
        >
          Share on WhatsApp
        </a>
      </div>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <Button
      size="sm"
      variant="secondary"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          /* clipboard blocked */
        }
      }}
    >
      {copied ? "Copied" : "Copy link"}
    </Button>
  );
}

function Details({ org }: { org: Organization }) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const logo = mediaUrl(org.logo_path);

  const upload = async (file: File) => {
    setError(null);
    setBusy(true);
    try {
      const img = await prepareImage(file, "logo");
      const name = `orgs/${org.id}/logo-${crypto.randomUUID()}.${img.ext}`;
      const supabase = createClient();
      const { error: upErr } = await supabase.storage.from(MEDIA_BUCKET).upload(name, img.blob, {
        contentType: img.ext === "webp" ? "image/webp" : "image/jpeg",
        cacheControl: "31536000",
        upsert: false,
      });
      if (upErr) return setError("Upload failed. Check your connection and try again.");
      const res = await setOrganizationLogo(org.id, name);
      if (!res.ok) {
        await supabase.storage.from(MEDIA_BUCKET).remove([name]);
        setError(res.error);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "That image couldn't be used.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section title="Name and logo" description="Shown on your tournaments' public pages when a tournament has no logo or host name of its own.">
      <div className="grid max-w-2xl gap-6 sm:grid-cols-[1fr_10rem]">
        <ActionForm action={renameOrganization.bind(null, org.id)} className="flex flex-wrap items-end gap-3">
          {(pending) => (
            <>
              <div className="min-w-56 flex-1">
                <Label htmlFor="org-name">Name</Label>
                <Input id="org-name" name="name" required minLength={2} maxLength={120} defaultValue={org.name} />
              </div>
              <Button type="submit" variant="secondary" disabled={pending}>
                Save name
              </Button>
            </>
          )}
        </ActionForm>
        <div>
          <p className="mb-2 text-sm font-semibold">Logo</p>
          <div className="flex aspect-square items-center justify-center overflow-hidden rounded-md border border-dashed border-line bg-surface-2">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element -- organization logo from storage
              <img src={logo} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-sm text-ink-soft">None yet</span>
            )}
          </div>
          <div className="mt-2 flex gap-2">
            <label
              htmlFor="org-logo"
              className="inline-flex h-8 cursor-pointer items-center rounded-md border border-line px-3 text-sm font-semibold hover:border-ink"
            >
              {busy ? "Uploading…" : logo ? "Replace" : "Upload"}
            </label>
            <input
              id="org-logo"
              type="file"
              accept={ACCEPTED.join(",")}
              className="sr-only"
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void upload(f);
              }}
            />
            {logo && (
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  const res = await setOrganizationLogo(org.id, null);
                  if (!res.ok) setError(res.error);
                  setBusy(false);
                }}
              >
                Remove
              </Button>
            )}
          </div>
          {error && (
            <div className="mt-2">
              <Notice tone="error">{error}</Notice>
            </div>
          )}
        </div>
      </div>
    </Section>
  );
}

function DeleteOrg({ org }: { org: Organization }) {
  return (
    <Section
      title="Delete organization"
      description="Its tournaments are kept and go back to the people who created them. Members lose access to tournaments they didn't create."
    >
      <ActionForm action={deleteOrganization.bind(null, org.id)} className="flex max-w-md flex-wrap items-end gap-3">
        {(pending) => (
          <>
            <div className="flex-1">
              <Label htmlFor="confirm-org" hint={`type ${org.name}`}>
                Confirm
              </Label>
              <Input id="confirm-org" name="confirm" autoComplete="off" required />
            </div>
            <Button type="submit" variant="danger" disabled={pending}>
              Delete organization
            </Button>
          </>
        )}
      </ActionForm>
    </Section>
  );
}
