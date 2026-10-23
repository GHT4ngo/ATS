import { cookies } from "next/headers";
import { locales, type Locale } from "@/i18n/request";

export async function setLocaleCookie(locale: string) {
  if (!locales.includes(locale as Locale)) return;
  (await cookies()).set("locale", locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}
