import { getTranslations } from "next-intl/server";
import { PasswordForm } from "@/components/auth/password-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function ResetPasswordPage() {
  const t = await getTranslations("Auth");
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("resetTitle")}</CardTitle>
        <CardDescription>{t("resetDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        <PasswordForm showContinue />
      </CardContent>
    </Card>
  );
}
