"use client";

import * as React from "react";
import type { Avatar } from "@personaai/avatar";

interface AvatarSlot {
  avatar: Avatar | null;
  setAvatar: (avatar: Avatar | null) => void;
}

export const AvatarSlotContext = React.createContext<AvatarSlot | null>(null);

export function AvatarSlotProvider({ children }: { children: React.ReactNode }) {
  const [avatar, setAvatar] = React.useState<Avatar | null>(null);
  const value = React.useMemo(() => ({ avatar, setAvatar }), [avatar]);
  return <AvatarSlotContext.Provider value={value}>{children}</AvatarSlotContext.Provider>;
}

/** The avatar currently published to the slot, or null. */
export function useSlottedAvatar(): Avatar | null {
  return React.useContext(AvatarSlotContext)?.avatar ?? null;
}
