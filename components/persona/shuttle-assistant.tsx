"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { PersonaProvider, useFrontendTool } from "@personaai/react";
import { useAvatarTools } from "@personaai/avatar/persona";
import { createClient } from "@/lib/supabase/client";
import { AvatarSlotProvider, useSlottedAvatar } from "./avatar-slot";
import { VoiceFab } from "./voice-fab";

const UID_COOKIE = "shuttlelive_uid";

function ensureVisitorCookie() {
  if (document.cookie.split("; ").some((c) => c.startsWith(`${UID_COOKIE}=`))) return;
  const id = crypto.randomUUID();
  document.cookie = `${UID_COOKIE}=${id}; path=/; max-age=31536000; SameSite=Lax`;
}

const PAGES = {
  home: { path: "/", label: "the home page" },
  tournaments: { path: "/#tournaments", label: "the tournaments directory" },
  sign_in: { path: "/sign-in", label: "sign in" },
  sign_up: { path: "/sign-up", label: "create an account" },
  dashboard: { path: "/dashboard", label: "the organizer dashboard" },
} as const;

type PageKey = keyof typeof PAGES;
type ScrollTarget = "up" | "down" | "top" | "bottom";

function listHeadings() {
  return Array.from(document.querySelectorAll("main h1, main h2, main h3"))
    .map((el) => ({
      id: el.id || undefined,
      text: el.textContent?.trim() ?? "",
    }))
    .filter((h) => h.text.length > 0)
    .slice(0, 30);
}

function scrollToSection(section: string): string | null {
  const needle = section.trim().toLowerCase();
  const headings = Array.from(document.querySelectorAll("main h1, main h2, main h3"));
  const match = headings.find(
    (el) =>
      el.id.toLowerCase() === needle ||
      (el.textContent?.trim().toLowerCase().includes(needle) ?? false),
  );
  if (!match) return null;
  match.scrollIntoView({ behavior: "smooth", block: "start" });
  return match.textContent?.trim() ?? section;
}

function ShuttleTools() {
  const router = useRouter();

  useFrontendTool({
    name: "get_current_page",
    description:
      "Get the page the user is currently viewing on ShuttleLive (path, title, and visible section headings).",
    handler: () => ({
      path: window.location.pathname,
      title: document.title,
      sections: listHeadings().map((h) => h.text),
    }),
  });

  useFrontendTool<{ page: PageKey }>({
    name: "navigate_to_page",
    description:
      "Navigate to a ShuttleLive page: home, tournaments, sign_in, sign_up, or dashboard.",
    parameters: {
      type: "object",
      properties: {
        page: {
          type: "string",
          enum: Object.keys(PAGES),
        },
      },
      required: ["page"],
    },
    handler: ({ page }) => {
      const target = PAGES[page];
      if (!target) throw new Error(`Unknown page "${page}".`);
      router.push(target.path);
      return { navigatedTo: target.label, path: target.path };
    },
  });

  useFrontendTool<{ slug: string }>({
    name: "open_tournament",
    description:
      "Open a public tournament page by its slug (e.g. 'udgam-26'). Use search_tournaments first if you don't know the exact slug.",
    parameters: {
      type: "object",
      properties: {
        slug: { type: "string", pattern: "^[a-z0-9-]{3,60}$" },
      },
      required: ["slug"],
    },
    handler: ({ slug }) => {
      if (!/^[a-z0-9-]{3,60}$/.test(slug)) {
        throw new Error(`Invalid tournament slug "${slug}".`);
      }
      const path = `/t/${slug}`;
      router.push(path);
      return { opened: path };
    },
  });

  useFrontendTool<{ query?: string; status?: "all" | "live" | "upcoming" | "completed" }>({
    name: "search_tournaments",
    description:
      "Search public badminton tournaments on ShuttleLive by name, venue, or host club, and optionally filter by status (all, live, upcoming, completed).",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", maxLength: 100 },
        status: { type: "string", enum: ["all", "live", "upcoming", "completed"] },
      },
    },
    handler: async ({ query, status = "all" }) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("tournaments")
        .select("name, slug, subtitle, host_name, venue_name, start_date, end_date, status")
        .eq("visibility", "PUBLIC")
        .neq("status", "DRAFT")
        .eq("kind", "TOURNAMENT")
        .order("start_date", { ascending: false })
        .limit(40);

      if (error) throw new Error("Could not fetch tournaments.");

      const today = new Date().toISOString().slice(0, 10);
      const q = (query ?? "").trim().toLowerCase();

      const results = (data ?? [])
        .filter((t) => {
          if (status === "live") {
            return t.status === "PUBLISHED" && t.start_date <= today && t.end_date >= today;
          }
          if (status === "upcoming") {
            return t.status === "PUBLISHED" && t.start_date > today;
          }
          if (status === "completed") {
            return t.status === "COMPLETED" || (t.status === "PUBLISHED" && t.end_date < today);
          }
          return true;
        })
        .filter((t) => {
          if (!q) return true;
          return [t.name, t.subtitle, t.host_name, t.venue_name, t.slug]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(q);
        })
        .slice(0, 10);

      return { count: results.length, tournaments: results };
    },
  });

  useFrontendTool<{ direction: ScrollTarget; screens?: number }>({
    name: "scroll_page",
    description:
      "Scroll the current page up, down, to the top, or to the bottom.",
    parameters: {
      type: "object",
      properties: {
        direction: { type: "string", enum: ["up", "down", "top", "bottom"] },
        screens: { type: "number", minimum: 0.1, maximum: 3 },
      },
      required: ["direction"],
    },
    handler: ({ direction, screens = 0.8 }) => {
      if (direction === "top") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else if (direction === "bottom") {
        window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
      } else {
        const delta = window.innerHeight * screens * (direction === "up" ? -1 : 1);
        window.scrollBy({ top: delta, behavior: "smooth" });
      }
      return { scrolled: direction };
    },
  });

  useFrontendTool({
    name: "list_page_sections",
    description: "List the section headings on the current page.",
    handler: () => ({ sections: listHeadings() }),
  });

  useFrontendTool<{ section: string }>({
    name: "open_section",
    description: "Scroll to a section heading on the current page.",
    parameters: {
      type: "object",
      properties: { section: { type: "string", maxLength: 200 } },
      required: ["section"],
    },
    handler: ({ section }) => {
      const opened = scrollToSection(section);
      if (!opened) {
        throw new Error(`No section "${section}" found. Call list_page_sections first.`);
      }
      return { opened };
    },
  });

  useFrontendTool<{ text: string }>({
    name: "copy_to_clipboard",
    description: "Copy a tournament link or text to the user's clipboard.",
    parameters: {
      type: "object",
      properties: { text: { type: "string", maxLength: 5000 } },
      required: ["text"],
    },
    handler: async ({ text }) => {
      await navigator.clipboard.writeText(text);
      return { copied: text.length };
    },
  });

  useAvatarTools(useSlottedAvatar());

  return null;
}

const POLICY_EVENT = "shuttlelive:voice-policy";
function subscribePolicy(cb: () => void) {
  window.addEventListener(POLICY_EVENT, cb);
  return () => window.removeEventListener(POLICY_EVENT, cb);
}
function getPolicySnapshot() {
  if (typeof document === "undefined") return "on";
  return document.documentElement.dataset.voiceAssistant ?? "on";
}

export function ShuttleAssistant({
  voiceAgentId = process.env.NEXT_PUBLIC_VOICE_AGENT_ID ?? "",
}: {
  voiceAgentId?: string;
}) {
  const pathname = usePathname();
  const isPublicPage = pathname === "/" || pathname.startsWith("/t/");
  const policy = React.useSyncExternalStore(subscribePolicy, getPolicySnapshot, () => "on");
  const allowedOnPage = isPublicPage && !(pathname.startsWith("/t/") && policy === "off");

  React.useEffect(() => {
    if (voiceAgentId) ensureVisitorCookie();
  }, [voiceAgentId]);

  if (!voiceAgentId) return null;

  return (
    <PersonaProvider baseUrl="/api/persona" defaultAgentId={voiceAgentId}>
      <AvatarSlotProvider>
        <ShuttleTools />
        <VoiceFab
          agentId={voiceAgentId}
          hideWhenIdle={!allowedOnPage}
          proactiveGreeting="User joined the call on ShuttleLive. Greet them warmly and offer to help find live badminton tournaments, check court scores, or navigate the site."
        />
      </AvatarSlotProvider>
    </PersonaProvider>
  );
}
