import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";

export default async function NotFound() {
  const c = await getTranslations("Common");
  return (
    <div className="grid min-h-screen place-items-center">
      <div className="grid justify-items-center gap-3 text-center">
        <p className="text-muted-foreground text-sm">404</p>
        <h1 className="text-2xl font-semibold tracking-tight">
          {c("notFoundTitle")}
        </h1>
        <p className="text-muted-foreground">{c("notFoundBody")}</p>
        <Button render={<Link href="/dashboard" />}>{c("goHome")}</Button>
      </div>
    </div>
  );
}
