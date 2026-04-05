import Link from "next/link";
import { IconSearch } from "@/components/ui/icon";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-50 bg-surface-1/95 backdrop-blur border-b border-zinc-800/60">
      <div className="flex items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-white text-sm font-bold">
            A
          </div>
          <span className="text-lg font-bold text-zinc-100">AI Pulse</span>
        </Link>
        <Link
          href="/search"
          className="p-2 rounded-lg hover:bg-surface-2 text-muted transition-colors"
        >
          <IconSearch className="w-5 h-5" />
        </Link>
      </div>
    </header>
  );
}
