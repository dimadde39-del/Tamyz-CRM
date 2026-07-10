"use client";

import {
  Activity,
  Building2,
  Database,
  FlaskConical,
  ListTodo,
  LayoutDashboard,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "Сегодня", icon: LayoutDashboard },
  { href: "/pipeline", label: "Конвейер", icon: ListTodo },
  { href: "/suppliers", label: "Поставщики", icon: Building2 },
  { href: "/clients", label: "Клиенты", icon: UsersRound },
  { href: "/test-baskets", label: "Тестовые корзины", icon: FlaskConical },
  { href: "/activities", label: "Журнал", icon: Activity },
  { href: "/data", label: "Данные", icon: Database },
] as const;

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === href : pathname.startsWith(href);
}

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Основная навигация" className="scrollbar-thin flex gap-1 overflow-x-auto px-3 pb-3 lg:block lg:overflow-visible lg:px-2 lg:pb-0">
      {items.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex shrink-0 items-center gap-2.5 rounded px-3 py-2.5 text-[13px] font-semibold no-underline transition-colors lg:mb-0.5 ${
              active ? "bg-white/12 text-white" : "text-white/67 hover:bg-white/7 hover:text-white"
            }`}
          >
            <Icon aria-hidden="true" size={16} strokeWidth={1.8} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
