"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { Monitor, Moon, Sun } from "lucide-react";
import { setLanguage } from "@/app/actions/profile";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const THEMES = [
  { value: "light", Icon: Sun },
  { value: "dark", Icon: Moon },
  { value: "system", Icon: Monitor },
] as const;

const LOCALES = ["sv", "en"] as const;
type Locale = (typeof LOCALES)[number];

function SwedishFlag() {
  return (
    <svg viewBox="0 0 16 10" className="h-3 w-[1.2rem]" aria-hidden>
      <rect width="16" height="10" fill="#006aa7" />
      <rect x="5" width="2" height="10" fill="#fecc00" />
      <rect y="4" width="16" height="2" fill="#fecc00" />
    </svg>
  );
}

function BritishFlag() {
  const id = useId();
  return (
    <svg viewBox="0 0 60 30" className="h-3 w-[1.2rem]" aria-hidden>
      <clipPath id={`${id}s`}>
        <path d="M0,0 v30 h60 v-30 z" />
      </clipPath>
      <clipPath id={`${id}t`}>
        <path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z" />
      </clipPath>
      <g clipPath={`url(#${id}s)`}>
        <path d="M0,0 v30 h60 v-30 z" fill="#012169" />
        <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6" />
        <path
          d="M0,0 L60,30 M60,0 L0,30"
          clipPath={`url(#${id}t)`}
          stroke="#c8102e"
          strokeWidth="4"
        />
        <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10" />
        <path d="M30,0 v30 M0,15 h60" stroke="#c8102e" strokeWidth="6" />
      </g>
    </svg>
  );
}

export function LocaleFlag({ locale }: { locale: Locale }) {
  return (
    <span className="ring-foreground/15 inline-flex overflow-hidden rounded-[3px] ring-1">
      {locale === "sv" ? <SwedishFlag /> : <BritishFlag />}
    </span>
  );
}

function useLanguage() {
  const e = useTranslations("Errors");
  const [pending, startTransition] = useTransition();
  const change = (value: string) =>
    startTransition(async () => {
      const result = await setLanguage(value);
      if (result.error) toast.error(e(result.error));
    });
  return { pending, change };
}

/** The theme as the user picked it, once mounted (next themes reads storage). */
function usePickedTheme() {
  const { theme = "system", setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return { theme: mounted ? theme : null, setTheme };
}

/** A row of small segmented controls: one button per choice, with a tooltip. */
function Segment({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="bg-muted/60 ring-foreground/5 inline-flex rounded-lg p-0.5 ring-1"
    >
      {children}
    </div>
  );
}

function SegmentButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-label={label}
            aria-pressed={active}
            disabled={disabled}
            onClick={onClick}
            className={cn(
              "text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex size-7 items-center justify-center rounded-md transition-colors outline-none focus-visible:ring-2 disabled:opacity-50",
              active && "bg-background text-foreground elevated",
            )}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/** The sidebar footer: theme and language side by side. */
export function Preferences() {
  const t = useTranslations("Theme");
  const n = useTranslations("Nav");
  const c = useTranslations("Common");
  const locale = useLocale();
  const { theme, setTheme } = usePickedTheme();
  const { pending, change } = useLanguage();
  const names: Record<Locale, string> = {
    sv: c("swedish"),
    en: c("english"),
  };

  return (
    <div className="flex items-center justify-between gap-2">
      <Segment label={n("theme")}>
        {THEMES.map(({ value, Icon }) => (
          <SegmentButton
            key={value}
            label={t(value)}
            active={theme === value}
            onClick={() => setTheme(value)}
          >
            <Icon className="size-3.5" />
          </SegmentButton>
        ))}
      </Segment>
      <Segment label={n("language")}>
        {LOCALES.map((value) => (
          <SegmentButton
            key={value}
            label={names[value]}
            active={locale === value}
            disabled={pending}
            onClick={() => locale !== value && change(value)}
          >
            <LocaleFlag locale={value} />
          </SegmentButton>
        ))}
      </Segment>
    </div>
  );
}

/** Collapsed sidebar: one icon button that opens the theme choices. */
export function ThemeToggle() {
  const t = useTranslations("Theme");
  const n = useTranslations("Nav");
  const { theme, setTheme } = usePickedTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon-sm" aria-label={n("theme")} />
        }
      >
        <Sun className="size-4 dark:hidden" />
        <Moon className="hidden size-4 dark:block" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup
          value={theme ?? "system"}
          onValueChange={setTheme}
        >
          {THEMES.map(({ value, Icon }) => (
            <DropdownMenuRadioItem key={value} value={value}>
              <Icon className="size-4" />
              {t(value)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Collapsed sidebar: the current flag, which opens the language choices. */
export function LanguageToggle() {
  const c = useTranslations("Common");
  const n = useTranslations("Nav");
  const locale = useLocale() as Locale;
  const { pending, change } = useLanguage();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={n("language")}
            disabled={pending}
          />
        }
      >
        <LocaleFlag locale={locale} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup
          value={locale}
          onValueChange={(value) => change(String(value))}
        >
          {LOCALES.map((value) => (
            <DropdownMenuRadioItem key={value} value={value}>
              <LocaleFlag locale={value} />
              {value === "sv" ? c("swedish") : c("english")}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
