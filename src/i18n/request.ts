import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { TIME_ZONE } from "@/lib/data/dashboard";

export const locales = ["sv", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "sv";

export default getRequestConfig(async () => {
  const stored = (await cookies()).get("locale")?.value;
  const locale: Locale = locales.includes(stored as Locale)
    ? (stored as Locale)
    : defaultLocale;

  return {
    locale,
    // Dates show Swedish time on the server and in the browser alike.
    timeZone: TIME_ZONE,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
