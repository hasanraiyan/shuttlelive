"use client";

import * as React from "react";

/**
 * Publishes the current tournament's voice-assistant setting to the root
 * ShuttleAssistant so organizers can turn it off for a specific event.
 */
export function VoiceAssistantPolicy({ enabled }: { enabled: boolean }) {
  React.useEffect(() => {
    document.documentElement.dataset.voiceAssistant = enabled ? "on" : "off";
    window.dispatchEvent(new Event("shuttlelive:voice-policy"));
    return () => {
      delete document.documentElement.dataset.voiceAssistant;
      window.dispatchEvent(new Event("shuttlelive:voice-policy"));
    };
  }, [enabled]);

  return null;
}
