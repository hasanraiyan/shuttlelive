"use client";

import * as React from "react";
import type { PersonaVoiceState, UseVoiceResult } from "@personaai/react";
import { sakura, type Avatar, type AvatarPack } from "@personaai/avatar";
import { mapVoiceState, useVoiceAvatar } from "@personaai/avatar/persona";
import { cn } from "@/lib/utils";
import { AvatarSlotContext } from "./avatar-slot";

export type AvatarState = "idle" | "listening" | "thinking" | "speaking";
export type AvatarEmotion =
  | "neutral"
  | "happy"
  | "thinking"
  | "surprised"
  | "shy"
  | "sad";

export interface AnimeVoiceAvatarProps {
  pack?: AvatarPack;
  voice?: Partial<UseVoiceResult>;
  state?: PersonaVoiceState;
  emotion?: AvatarEmotion;
  volume?: number;
  size?: number | string;
  mouseTracking?: boolean;
  autoBlink?: boolean;
  backgroundColor?: string;
  className?: string;
  onStateChange?: (state: AvatarState) => void;
  onAvatarReady?: (avatar: Avatar | null) => void;
}

/**
 * Interactive 2D voice avatar bound to `@personaai/react` voice state and audio.
 */
export function AnimeVoiceAvatar({
  pack = sakura,
  voice,
  state: explicitState,
  emotion: explicitEmotion,
  volume,
  size = 240,
  mouseTracking = true,
  autoBlink = true,
  backgroundColor = "transparent",
  className,
  onStateChange,
  onAvatarReady,
}: AnimeVoiceAvatarProps) {
  const voiceState = explicitState ?? voice?.state ?? "idle";
  const avatarState = mapVoiceState(voiceState);

  const { ref, avatar } = useVoiceAvatar(
    { ...voice, state: voiceState },
    {
      pack,
      options: { mouseTracking, autoBlink, background: backgroundColor },
    },
  );

  React.useEffect(() => {
    if (avatar && explicitEmotion) avatar.setEmotion(explicitEmotion);
  }, [avatar, voiceState, explicitEmotion]);

  React.useEffect(() => {
    if (avatar && volume !== undefined) avatar.feedVolume(volume);
  }, [avatar, volume]);

  React.useEffect(() => {
    onStateChange?.(avatarState);
  }, [avatarState, onStateChange]);

  const onReadyRef = React.useRef(onAvatarReady);
  React.useEffect(() => {
    onReadyRef.current = onAvatarReady;
  }, [onAvatarReady]);

  React.useEffect(() => {
    if (!avatar) return;
    onReadyRef.current?.(avatar);
    return () => onReadyRef.current?.(null);
  }, [avatar]);

  const slot = React.useContext(AvatarSlotContext);
  const setSlotted = slot?.setAvatar;
  React.useEffect(() => {
    if (!avatar || !setSlotted) return;
    setSlotted(avatar);
    return () => setSlotted(null);
  }, [avatar, setSlotted]);

  const styleSize = typeof size === "number" ? `${size}px` : size;

  return (
    <div
      ref={ref}
      className={cn(
        "relative flex items-center justify-center overflow-hidden transition-all duration-300",
        className,
      )}
      style={{ width: styleSize, height: styleSize }}
      aria-label={`Voice avatar (${voiceState})`}
    />
  );
}
