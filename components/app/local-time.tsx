"use client";

import * as React from "react";

const fmt = new Intl.DateTimeFormat(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" });

/** Renders a time in the viewer's own timezone. */
export function LocalTime({ iso, className }: { iso: string; className?: string }) {
  const [text, setText] = React.useState<string | null>(null);
  React.useEffect(() => {
    // Formatting after mount avoids a server/client timezone mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setText(fmt.format(new Date(iso)));
  }, [iso]);
  return (
    <time dateTime={iso} className={className} suppressHydrationWarning>
      {text ?? ""}
    </time>
  );
}
