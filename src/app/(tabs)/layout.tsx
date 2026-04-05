import { AppHeader } from "@/components/layout/app-header";
import { BottomNav } from "@/components/layout/bottom-nav";

export default function TabsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen bg-surface-0">
      <AppHeader />
      <main className="pb-20">{children}</main>
      <BottomNav />
    </div>
  );
}
