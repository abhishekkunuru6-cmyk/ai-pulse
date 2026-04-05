"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { IconHome, IconBook, IconBookmark, IconDatabase, IconSettings } from "@/components/ui/icon";

const NAV_ITEMS = [
  { href: "/", label: "Feed", icon: IconHome },
  { href: "/digest", label: "Digest", icon: IconBook },
  { href: "/saved", label: "Saved", icon: IconBookmark },
  { href: "/sources", label: "Sources", icon: IconDatabase },
  { href: "/settings", label: "Settings", icon: IconSettings },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-surface-1/95 backdrop-blur border-t border-zinc-800/60 pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-around py-2">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);

          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                "flex flex-col items-center gap-0.5 px-3 py-1 transition-colors",
                isActive ? "text-brand-500" : "text-muted",
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px]">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
