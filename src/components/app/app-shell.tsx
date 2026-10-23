"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Menu, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { NavLinks, type NavLink } from "./nav-links";

const STORAGE_KEY = "sidebar-collapsed";

export function AppShell({
  links,
  appName,
  search,
  footer,
  banner,
  children,
}: {
  links: NavLink[];
  appName: string;
  search: React.ReactNode;
  footer: React.ReactNode;
  banner?: React.ReactNode;
  children: React.ReactNode;
}) {
  const t = useTranslations("Nav");
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {}
  }, []);

  function toggle() {
    setCollapsed((c) => {
      try {
        localStorage.setItem(STORAGE_KEY, c ? "0" : "1");
      } catch {}
      return !c;
    });
  }

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) =>
      e.key === "Escape" && setMobileOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  const sidebar = (compact: boolean) => (
    <div className="flex h-full flex-col gap-4 p-3">
      <div className="flex items-center justify-between gap-2 px-1">
        {!compact && <span className="font-semibold">{appName}</span>}
        <Button
          variant="ghost"
          size="icon-sm"
          className="hidden md:inline-flex"
          onClick={toggle}
          aria-label={compact ? t("expand") : t("collapse")}
        >
          {compact ? (
            <PanelLeftOpen className="size-4" />
          ) : (
            <PanelLeftClose className="size-4" />
          )}
        </Button>
      </div>
      {!compact && search}
      <div className="flex-1 overflow-y-auto">
        <NavLinks
          links={links}
          collapsed={compact}
          onNavigate={() => setMobileOpen(false)}
        />
      </div>
      {!compact && footer}
    </div>
  );

  return (
    <div className="flex min-h-screen">
      <a
        href="#main"
        className="bg-background sr-only z-50 rounded-md p-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        {t("skipToContent")}
      </a>
      <aside
        className={cn(
          "bg-sidebar sticky top-0 hidden h-screen shrink-0 border-r md:block",
          collapsed ? "w-14" : "w-64",
        )}
      >
        {sidebar(collapsed)}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="bg-sidebar relative h-full w-64 border-r">
            <Button
              variant="ghost"
              size="icon-sm"
              className="absolute top-3 right-3"
              onClick={() => setMobileOpen(false)}
              aria-label={t("openMenu")}
            >
              <X className="size-4" />
            </Button>
            {sidebar(false)}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 border-b px-4 py-2 md:hidden">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setMobileOpen(true)}
            aria-label={t("openMenu")}
          >
            <Menu className="size-4" />
          </Button>
          <span className="font-semibold">{appName}</span>
        </div>
        {banner}
        <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
