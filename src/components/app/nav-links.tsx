"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Briefcase,
  Building2,
  KanbanSquare,
  LayoutDashboard,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const icons: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  pipeline: KanbanSquare,
  jobs: Briefcase,
  candidates: Users,
  users: Building2,
};

export type NavLink = { href: string; label: string; icon: string };

export function NavLinks({
  links,
  collapsed,
  onNavigate,
}: {
  links: NavLink[];
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1">
      {links.map(({ href, label, icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        const Icon = icons[icon] ?? LayoutDashboard;
        return (
          <Link
            key={href}
            href={href}
            title={collapsed ? label : undefined}
            aria-label={collapsed ? label : undefined}
            aria-current={active ? "page" : undefined}
            onClick={onNavigate}
            className={cn(
              "focus-visible:ring-ring flex items-center gap-3 rounded-md px-3 py-2 text-sm whitespace-nowrap transition-colors outline-none focus-visible:ring-2",
              collapsed && "justify-center px-2",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
            )}
          >
            <Icon
              className={cn(
                "size-4 shrink-0",
                active && "text-violet-600 dark:text-violet-400",
              )}
            />
            {!collapsed && label}
          </Link>
        );
      })}
    </nav>
  );
}
