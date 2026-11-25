"use client";

import * as React from "react";
import { useVoice } from "@personaai/react";
import type { AvatarPack } from "@personaai/avatar";
import { VoiceDock } from "./voice-dock";

export interface VoiceFabProps {
  agentId: string;
  threadId?: string;
  agentVersion?: number;
  environment?: "development" | "production";
  hideWhenIdle?: boolean;
  pack?: AvatarPack;
  proactiveGreeting?: string | boolean;
}

export function VoiceFab({
  agentId,
  threadId,
  agentVersion,
  environment = "production",
  hideWhenIdle = false,
  pack,
  proactiveGreeting,
}: VoiceFabProps) {
  const voice = useVoice({
    agentId,
    threadId,
    agentVersion,
    environment,
    autoPrefetch: true,
    ...(proactiveGreeting !== undefined ? ({ proactiveGreeting } as Record<string, unknown>) : {}),
  });

  const live = !["idle", "ended", "error"].includes(voice.state);

  const handleStart = React.useCallback(() => {
    void voice.start();
  }, [voice]);

  React.useEffect(() => {
    if (voice.state === "ended" || voice.state === "error") {
      console.warn("[voice-fab] call ended", {
        state: voice.state,
        endReason: voice.endReason,
        error: voice.error?.message,
      });
    }
  }, [voice.state, voice.endReason, voice.error]);

  if (hideWhenIdle && !live) return null;
  return <VoiceDock voice={voice} pack={pack} onStart={handleStart} />;
}
