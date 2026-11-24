import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

/* Brand artwork lives in public/brand. Replace those files to update the logo everywhere. */
const MARK = { src: "/brand/logo-mark.png", width: 480, height: 270 };
const WORDMARK = { src: "/brand/logo-wordmark.png", width: 600, height: 89 };
const FULL = { src: "/brand/logo.png", width: 720, height: 465 };

/** Shuttle-and-court mark on its own. */
export function AppIcon({ className }: { className?: string }) {
  return (
    <Image
      {...MARK}
      alt=""
      aria-hidden="true"
      className={cn("h-9 w-auto shrink-0", className)}
      priority
    />
  );
}

/** Mark + wordmark side by side, linking home. */
export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" aria-label="ShuttleLive home" className={cn("inline-flex w-fit items-center gap-2 rounded-md", className)}>
      <AppIcon />
      <Image {...WORDMARK} alt="ShuttleLive" className="h-[22px] w-auto" priority />
    </Link>
  );
}

/** The full stacked logo, for larger placements. */
export function LogoFull({ className }: { className?: string }) {
  return <Image {...FULL} alt="ShuttleLive" className={cn("h-auto w-48", className)} />;
}
