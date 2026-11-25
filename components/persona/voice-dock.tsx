"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { MessageCircle, Mic, MicOff, PhoneOff, X } from "lucide-react";
import type { UseVoiceResult } from "@personaai/react";
import type { Avatar, AvatarPack } from "@personaai/avatar";
import { playGoodbye } from "@personaai/avatar/persona";
import { cn } from "@/lib/utils";
import { VoiceIndicator } from "./voice-indicator";

const CAPTION_LINGER_MS = 4500;
const GOODBYE_MS = 2200;

const emptySubscribe = () => () => {};
function useIsClient() {
  return React.useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

/** Strip leaked audio emotion tags or raw XML tags from live caption text. */
function cleanVoiceCaption(text: string): string {
  if (!text) return "";
  let cleaned = text;
  cleaned = cleaned.replace(/<?speaker:audio_emotion\b[^>]*>[\s\S]*?<\/speaker:audio_emotion>/gi, "");
  cleaned = cleaned.replace(/<?speaker:audio_emotion\b[^<\n]*<\/speaker:audio_emotion>/gi, "");
  cleaned = cleaned.replace(/<?speaker:audio_emotion\b[^>]*\/?>/gi, "");
  cleaned = cleaned.replace(/<trigger_avatar_reaction\b[^>]*>[\s\S]*?<\/trigger_avatar_reaction>/gi, "");
  cleaned = cleaned.replace(/<trigger_avatar_reaction\b[^>]*\/?>/gi, "");
  cleaned = cleaned.replace(/<set_avatar_emotion\b[^>]*>[\s\S]*?<\/set_avatar_emotion>/gi, "");
  cleaned = cleaned.replace(/<set_avatar_emotion\b[^>]*\/?>/gi, "");
  cleaned = cleaned.replace(/<(?:action|reaction|emotion)\b[^>]*>[\s\S]*?<\/(?:action|reaction|emotion)>/gi, "");
  cleaned = cleaned.replace(/<(?:action|reaction|emotion)\b[^>]*\/?>/gi, "");
  cleaned = cleaned.replace(/<[a-zA-Z_:][a-zA-Z0-9_.:-]*\b[^>]*\/?>/gi, "");
  cleaned = cleaned.replace(/<\/[a-zA-Z_:][a-zA-Z0-9_.:-]*\s*>/gi, "");
  cleaned = cleaned.replace(/<[a-zA-Z_:][^>]*$/g, "");
  cleaned = cleaned.replace(/\[blocked\][a-zA-Z0-9_]+/gi, "");
  return cleaned.replace(/[ \t]+/g, " ").replace(/\n\s*\n/g, "\n").trim();
}

function useVanishingCaption(voice: UseVoiceResult): string {
  const isAgentPartial = voice.partial?.speaker === "agent";
  const rawPartialText = isAgentPartial ? (voice.partial?.text?.trim() ?? "") : "";
  const partialText = cleanVoiceCaption(rawPartialText);

  let lastAgentText = "";
  for (let i = voice.transcript.length - 1; i >= 0; i--) {
    if (voice.transcript[i]?.speaker === "agent") {
      const cleaned = cleanVoiceCaption(voice.transcript[i]?.text?.trim() ?? "");
      if (cleaned) {
        lastAgentText = cleaned;
        break;
      }
    }
  }

  const live = partialText || lastAgentText;
  const [expiredFor, setExpiredFor] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!live || partialText) return;
    const t = window.setTimeout(() => setExpiredFor(live), CAPTION_LINGER_MS);
    return () => window.clearTimeout(t);
  }, [live, partialText]);

  if (!live || (!partialText && expiredFor === live)) return "";
  return live;
}

const RING: Record<string, string> = {
  listening: "ring-court/50",
  speaking: "ring-court",
  thinking: "ring-court/70 animate-pulse",
  connecting: "ring-ink/25 animate-pulse",
};

export function VoiceDock({
  voice,
  pack,
  onExpand,
  onStart,
}: {
  voice: UseVoiceResult;
  pack?: AvatarPack;
  onExpand?: () => void;
  onStart?: () => void;
}) {
  const caption = useVanishingCaption(voice);
  const [small, setSmall] = React.useState(false);
  const [saying, setSaying] = React.useState(false);
  const mounted = useIsClient();
  const active = !["idle", "ended", "error"].includes(voice.state);
  const avatarRef = React.useRef<Avatar | null>(null);

  const endTimer = React.useRef<number | null>(null);
  const endWithGoodbye = React.useCallback(() => {
    if (endTimer.current !== null) return;
    setSaying(true);
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      if (endTimer.current !== null) window.clearTimeout(endTimer.current);
      endTimer.current = null;
      setSaying(false);
      setSmall(false);
      voice.stop();
    };
    endTimer.current = window.setTimeout(finish, GOODBYE_MS);

    const avatar = avatarRef.current;
    if (!avatar) return finish();
    const started = Date.now();
    void playGoodbye(avatar)
      .catch(() => null)
      .then(() => {
        const left = 700 - (Date.now() - started);
        if (left > 0) window.setTimeout(finish, left);
        else finish();
      });
  }, [voice]);

  React.useEffect(
    () => () => {
      if (endTimer.current !== null) window.clearTimeout(endTimer.current);
    },
    [],
  );

  const wasActive = React.useRef(false);
  React.useEffect(() => {
    if (wasActive.current && !active && endTimer.current === null) {
      const avatar = avatarRef.current;
      if (avatar) void playGoodbye(avatar).catch(() => null);
    }
    wasActive.current = active;
  }, [active]);

  const [dismissedText, setDismissedText] = React.useState<string | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const errorText = voice.state === "error" ? "Couldn't start the call. Tap to try again." : "";
  const endedText =
    voice.state === "ended" && voice.endReason && voice.endReason !== "client_closed"
      ? "Call ended. Tap to call again."
      : "";
  const shownCaption = saying
    ? "Bye bye! See you soon"
    : active
      ? caption
      : errorText || endedText;

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [shownCaption]);

  const isCaptionVisible = Boolean(shownCaption && shownCaption !== dismissedText);

  if (!mounted) return null;

  const isShrunk = active && small;

  return createPortal(
    <div
      role="region"
      aria-label="Voice assistant"
      className="pointer-events-none fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-50 flex max-w-[calc(100vw-2rem)] flex-col items-end gap-3 sm:right-6 sm:bottom-6"
    >
      <div
        aria-live="polite"
        className={cn(
          "relative w-fit max-w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-line bg-surface/95 px-3.5 py-2.5 text-sm leading-snug text-ink shadow-lg backdrop-blur transition-all duration-300",
          isCaptionVisible
            ? "pointer-events-auto translate-y-0 opacity-100"
            : "pointer-events-none translate-y-1 opacity-0",
        )}
      >
        {isCaptionVisible && (
          <button
            type="button"
            onClick={() => setDismissedText(shownCaption)}
            aria-label="Close transcript"
            className="absolute -top-2 -right-2 flex size-6 items-center justify-center rounded-full border border-line bg-surface text-ink-soft shadow-md transition-all hover:bg-surface-2 hover:text-ink active:scale-95"
          >
            <X className="size-3.5" />
          </button>
        )}
        <div
          ref={scrollRef}
          className="max-h-48 overflow-y-auto select-text [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden sm:max-h-56"
        >
          <span className="whitespace-pre-wrap">{shownCaption || "\u00a0"}</span>
        </div>
      </div>

      <div className="pointer-events-auto relative">
        <button
          type="button"
          onClick={() => {
            if (active) setSmall((v) => !v);
            else {
              setSmall(false);
              onStart?.();
            }
          }}
          aria-label={
            !active
              ? "Start voice call"
              : isShrunk
                ? "Show call controls"
                : "Hide call controls"
          }
          aria-expanded={active ? !isShrunk : undefined}
          className={cn(
            "relative block overflow-hidden rounded-full bg-surface shadow-xl ring-2 transition-[width,height,box-shadow,transform] duration-300 ease-out active:scale-95",
            !active ? "size-16" : isShrunk ? "size-[3.75rem]" : "size-[7.5rem]",
            voice.isMuted
              ? "ring-fault/60"
              : (RING[voice.state] ?? "ring-ink/20"),
          )}
        >
          <div
            className="size-full origin-center"
            style={{ transform: "translateY(10.5%) scale(1.35)" }}
          >
            <VoiceIndicator
              state={voice.state}
              voice={voice}
              pack={pack}
              size={!active ? 64 : isShrunk ? 60 : 120}
              variant="avatar"
              onAvatarReady={(a) => {
                avatarRef.current = a;
              }}
            />
          </div>
        </button>

        <div
          className={cn(
            "pointer-events-none absolute inset-0 transition-all duration-200 [&>button]:pointer-events-auto",
            !active || isShrunk
              ? "scale-75 opacity-0 [&>button]:pointer-events-none"
              : "scale-100 opacity-100",
          )}
          aria-hidden={!active || isShrunk}
        >
          <button
            type="button"
            onClick={() => voice.mute(!voice.isMuted)}
            tabIndex={!active || isShrunk ? -1 : 0}
            aria-label={voice.isMuted ? "Unmute microphone" : "Mute microphone"}
            className={cn(
              "absolute -bottom-3 left-1/2 flex size-8 -translate-x-[calc(100%+0.1875rem)] items-center justify-center rounded-full border border-line bg-surface text-ink shadow-md transition-transform active:scale-95",
              voice.isMuted && "bg-fault/10 text-fault",
            )}
          >
            {voice.isMuted ? <MicOff className="size-4" /> : <Mic className="size-4" />}
          </button>
          <button
            type="button"
            onClick={endWithGoodbye}
            tabIndex={!active || isShrunk ? -1 : 0}
            aria-label="End voice call"
            className="absolute -bottom-3 left-1/2 flex size-8 translate-x-[0.1875rem] items-center justify-center rounded-full bg-fault text-white shadow-md transition-transform active:scale-95"
          >
            <PhoneOff className="size-4" />
          </button>
          {onExpand && (
            <button
              type="button"
              onClick={onExpand}
              tabIndex={!active || isShrunk ? -1 : 0}
              aria-label="Open chat"
              className="absolute -top-0.5 -right-0.5 flex size-7 items-center justify-center rounded-full border border-line bg-surface text-ink shadow-md transition-transform active:scale-95"
            >
              <MessageCircle className="size-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
