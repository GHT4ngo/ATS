"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import {
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { AgentPanel } from "@/components/agent/agent-panel";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SIDEBAR_COOKIE } from "@/lib/sidebar";
import { cn } from "@/lib/utils";
import { CommandPalette } from "./command-palette";
import { NavLinks, type NavLink } from "./nav-links";

export function AppShell({
  links,
  appName,
  defaultCollapsed,
  footer,
  compactFooter,
  banner,
  assistant,
  children,
}: {
  links: NavLink[];
  appName: string;
  defaultCollapsed: boolean;
  footer: React.ReactNode;
  compactFooter: React.ReactNode;
  banner?: React.ReactNode;
  /** The assistant needs an active organization. */
  assistant: boolean;
  children: React.ReactNode;
}) {
  const t = useTranslations("Nav");
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const closeAssistant = useCallback(() => setAssistantOpen(false), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `${SIDEBAR_COOKIE}=${next ? 1 : 0}; path=/; max-age=31536000; samesite=lax`;
  }

  const sidebar = (compact: boolean, mobile: boolean) => (
    <div className="flex h-full flex-col gap-4 p-3">
      <div
        className={cn(
          "flex items-center justify-between gap-2 px-1",
          compact && "justify-center px-0",
        )}
      >
        {!compact && <span className="font-semibold">{appName}</span>}
        {mobile ? (
          <DialogPrimitive.Close
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t("closeMenu")}
              />
            }
          >
            <X className="size-4" />
          </DialogPrimitive.Close>
        ) : (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={toggle}
            aria-label={compact ? t("expand") : t("collapse")}
          >
            {compact ? (
              <PanelLeftOpen className="size-4" />
            ) : (
              <PanelLeftClose className="size-4" />
            )}
          </Button>
        )}
      </div>
      {compact ? (
        <Button
          variant="outline"
          size="icon-sm"
          className="self-center"
          aria-label={t("search")}
          title={`${t("search")} (${t("shortcut")})`}
          onClick={() => setPaletteOpen(true)}
        >
          <Search className="size-4" />
        </Button>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="text-muted-foreground w-full justify-start gap-2"
          onClick={() => setPaletteOpen(true)}
        >
          <Search className="size-4" />
          <span className="flex-1 text-left">{t("search")}</span>
          <kbd className="bg-muted rounded px-1.5 text-xs">{t("shortcut")}</kbd>
        </Button>
      )}
      {assistant && (
        <Button
          variant={assistantOpen ? "secondary" : "ghost"}
          size={compact ? "icon-sm" : "sm"}
          className={compact ? "self-center" : "w-full justify-start gap-2"}
          aria-label={compact ? t("assistant") : undefined}
          title={compact ? t("assistant") : undefined}
          aria-pressed={assistantOpen}
          onClick={() => {
            setAssistantOpen((o) => !o);
            setMobileOpen(false);
          }}
        >
          <Sparkles className="size-4" />
          {!compact && t("assistant")}
        </Button>
      )}
      <div className="flex-1 overflow-y-auto">
        <NavLinks
          links={links}
          collapsed={compact}
          onNavigate={() => setMobileOpen(false)}
        />
      </div>
      {compact ? compactFooter : footer}
    </div>
  );

  return (
    <TooltipProvider delay={250}>
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
          {sidebar(collapsed, false)}
        </aside>

        <DialogPrimitive.Root open={mobileOpen} onOpenChange={setMobileOpen}>
          <DialogPrimitive.Portal>
            <DialogPrimitive.Backdrop className="fixed inset-0 z-40 bg-black/40 md:hidden" />
            <DialogPrimitive.Popup
              aria-label={t("menu")}
              className="bg-sidebar fixed inset-y-0 left-0 z-50 w-64 border-r outline-none md:hidden"
            >
              {sidebar(false, true)}
            </DialogPrimitive.Popup>
          </DialogPrimitive.Portal>
        </DialogPrimitive.Root>

        <CommandPalette
          open={paletteOpen}
          onOpenChange={setPaletteOpen}
          pages={links}
          onNavigate={() => setMobileOpen(false)}
        />

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
          <main id="main" className="w-full min-w-0 flex-1 px-4 py-6 md:px-6">
            {children}
          </main>
        </div>
        {/* Stays mounted while closed, so the conversation survives. */}
        {assistant && (
          <AgentPanel open={assistantOpen} onClose={closeAssistant} />
        )}
      </div>
    </TooltipProvider>
  );
}
