import { getTranslations } from "next-intl/server";

export default async function Home() {
  const t = await getTranslations("Home");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 p-8 text-center">
      <h1 className="text-4xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="text-muted-foreground">{t("tagline")}</p>
      <p className="text-muted-foreground text-sm">{t("status")}</p>
    </main>
  );
}
