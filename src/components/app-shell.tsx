import Link from "next/link";

import { SidebarNav } from "@/components/sidebar-nav";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="border-b border-white/10 bg-[var(--sidebar)] text-[var(--sidebar-ink)] lg:fixed lg:inset-y-0 lg:left-0 lg:w-[220px] lg:border-r lg:border-b-0">
        <div className="flex h-16 items-center justify-between px-4 lg:h-[76px] lg:items-start lg:pt-4">
          <Link href="/" className="group block text-inherit no-underline">
            <span className="block text-[18px] font-[760] tracking-[-0.02em]">TAMYZ Ops</span>
            <span className="mt-0.5 hidden text-[10px] font-semibold uppercase tracking-[0.13em] text-white/50 lg:block">
              агентский тест · v0.1
            </span>
          </Link>
          <span className="rounded border border-white/15 px-2 py-1 text-[10px] font-semibold text-white/65 lg:hidden">
            v0.1
          </span>
        </div>
        <SidebarNav />
        <div className="hidden border-t border-white/10 px-4 py-4 text-[11px] leading-4 text-white/48 lg:absolute lg:inset-x-0 lg:bottom-0 lg:block">
          <p>Asia/Almaty</p>
          <p>Ручная отправка сообщений</p>
        </div>
      </aside>
      <main className="min-w-0 lg:col-start-2">
        <div className="mx-auto w-full max-w-[1500px] px-3 py-4 sm:px-5 lg:px-7 lg:py-6">{children}</div>
      </main>
    </div>
  );
}
