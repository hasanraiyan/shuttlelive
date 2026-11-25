"use client";

import * as React from "react";
import { Orb, type OrbState } from "orb-ui";
import type { PersonaVoiceState, UseVoiceResult } from "@personaai/react";
import type { Avatar, AvatarPack } from "@personaai/avatar";
import { cn } from "@/lib/utils";
import { AnimeVoiceAvatar } from "./anime-voice-avatar";

function toOrbState(state: PersonaVoiceState): OrbState {
  return state === "ended" ? "idle" : state;
}

export interface VoiceIndicatorProps {
  state: PersonaVoiceState;
  voice?: Partial<UseVoiceResult>;
  volume?: number;
  size?: number;
  className?: string;
  pack?: AvatarPack;
  variant?: "avatar" | "orb";
  onAvatarReady?: (avatar: Avatar | null) => void;
}

export function VoiceIndicator({
  state,
  voice,
  volume,
  size = 28,
  className,
  pack,
  variant = "avatar",
  onAvatarReady,
}: VoiceIndicatorProps) {
  if (variant === "avatar" && size >= 60) {
    return (
      <div
        className={cn(
          "flex animate-in fade-in zoom-in-95 items-center justify-center duration-300",
          className,
        )}
      >
        <AnimeVoiceAvatar
          pack={pack}
          voice={voice}
          state={state}
          volume={volume}
          size={size}
          onAvatarReady={onAvatarReady}
          className="bg-transparent"
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex animate-in fade-in zoom-in-95 items-center justify-center duration-300",
        className,
      )}
    >
      <div className="flex items-center justify-center">
        <Orb
          state={toOrbState(state)}
          theme="cloud"
          size={size}
          interactive={false}
          aria-label={`Voice ${state}`}
        />
      </div>
    </div>
  );
}
