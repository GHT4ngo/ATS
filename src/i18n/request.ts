import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";

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
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
