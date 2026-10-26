import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";

const PASSWORD = "e2e-password-123";
const run = Date.now().toString(36);
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);
const emails = {
  admin: `e2e-removal-admin-${run}@example.com`,
  customer: `e2e-removal-${run}@example.com`,
};
let orgId: string;
let jobId: string;
const ids: Record<string, string> = {};

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("E-post").fill(email);
  await page.getByLabel("Lösenord").fill(PASSWORD);
  await page.getByRole("button", { name: "Logga in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test.beforeAll(async () => {
  const { data: org } = await admin
    .from("organizations")
    .insert({ name: `E2E Removal ${run}`, slug: `e2e-removal-${run}` })
    .select("id")
    .single();
  orgId = org!.id;
  for (const [email, role] of [
    [emails.admin, "admin"],
    [emails.customer, "customer"],
  ]) {
    const { error } = await admin.auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true,
      app_metadata:
        role === "admin" ? { role } : { role, organization_id: orgId },
      user_metadata: { full_name: `Removal ${role}` },
    });
    if (error) throw error;
  }
  const { data: job } = await admin
    .from("jobs")
    .insert({ organization_id: orgId, title: "Backendutvecklare" })
    .select("id")
    .single();
  jobId = job!.id;
  for (const name of ["Rut Ras", "Erik Ek"]) {
    const { data: cand } = await admin
      .from("candidates")
      .insert({ organization_id: orgId, full_name: name })
      .select("id")
      .single();
    ids[name] = cand!.id;
    await admin.from("applications").insert({
      organization_id: orgId,
      candidate_id: cand!.id,
      job_id: jobId,
    });
  }
  // Erik has a CV, which the erase has to delete.
  const path = `${orgId}/${ids["Erik Ek"]}/cv.pdf`;
  await admin.storage
    .from("cvs")
    .upload(path, readFileSync("e2e/fixtures/cv.pdf"), {
      contentType: "application/pdf",
    });
  await admin
    .from("candidates")
    .update({ cv_path: path })
    .eq("id", ids["Erik Ek"]);
});

test.afterAll(async () => {
  const { data } = await admin
    .from("profiles")
    .select("id")
    .in("email", Object.values(emails));
  for (const { id } of data ?? []) await admin.auth.admin.deleteUser(id);
  await admin.from("organizations").delete().eq("id", orgId);
});

async function confirm(page: Page, title: RegExp, button: string) {
  const dialog = page.getByRole("dialog", { name: title });
  await dialog.getByRole("button", { name: button, exact: true }).click();
  await expect(dialog).toBeHidden();
}

test("customers remove and erase, admins restore and purge", async ({
  page,
  context,
}) => {
  await signIn(page, emails.customer);

  // Remove Rut: gone for the customer, kept in the database
  await page.goto(`/candidates?candidate=${ids["Rut Ras"]}`);
  await page.getByRole("button", { name: "Ta bort", exact: true }).click();
  await confirm(page, /Ta bort Rut Ras/, "Ta bort");
  await expect(page.getByRole("link", { name: "Rut Ras" })).toHaveCount(0);
  const { data: rut } = await admin
    .from("candidates")
    .select("removed_at")
    .eq("id", ids["Rut Ras"])
    .single();
  expect(rut!.removed_at).not.toBeNull();

  // Erase Erik: the row, the application and the CV file all go
  await page.goto(`/candidates?candidate=${ids["Erik Ek"]}`);
  await page.getByRole("button", { name: "Radera permanent" }).click();
  const erase = page.getByRole("dialog", { name: /Radera Erik Ek/ });
  const button = erase.getByRole("button", { name: "Radera permanent" });
  await expect(button).toBeDisabled();
  await erase.getByRole("textbox").fill("Erik Ek");
  await button.click();
  await expect(erase).toBeHidden();
  await expect
    .poll(async () => {
      const { data } = await admin
        .from("candidates")
        .select("id")
        .eq("id", ids["Erik Ek"]);
      return data?.length;
    })
    .toBe(0);
  const { data: files } = await admin.storage
    .from("cvs")
    .list(`${orgId}/${ids["Erik Ek"]}`);
  expect(files).toEqual([]);

  // Remove the job from its edit dialog
  await page.goto("/jobs");
  await page.getByRole("button", { name: "Redigera" }).click();
  await page.getByRole("button", { name: "Ta bort", exact: true }).click();
  await confirm(page, /Ta bort Backendutvecklare/, "Ta bort");
  await expect(page.getByText("Backendutvecklare")).toHaveCount(0);
  await page.getByRole("button", { name: "Logga ut" }).click();

  // The admin acting as the organization sees both under Removed
  await signIn(page, emails.admin);
  await context.addCookies([
    { name: "acting_org", value: orgId, url: page.url() },
  ]);
  await page.goto("/candidates");
  const removed = page.getByRole("region", { name: "Borttaget" });
  await removed.getByRole("button", { name: /Borttaget/ }).click();
  await expect(removed.getByText("Rut Ras")).toBeVisible();
  await removed.getByRole("button", { name: "Återställ" }).click();
  await confirm(page, /Återställ Rut Ras/, "Återställ");
  await expect(removed).toHaveCount(0);

  await page.goto("/jobs");
  const removedJobs = page.getByRole("region", { name: "Borttaget" });
  await removedJobs.getByRole("button", { name: /Borttaget/ }).click();
  await removedJobs.getByRole("button", { name: "Radera permanent" }).click();
  const purge = page.getByRole("dialog", { name: /Radera Backendutvecklare/ });
  await purge.getByRole("textbox").fill("Backendutvecklare");
  await purge.getByRole("button", { name: "Radera permanent" }).click();
  await expect(purge).toBeHidden();
  await expect
    .poll(async () => {
      const { data } = await admin.from("jobs").select("id").eq("id", jobId);
      return data?.length;
    })
    .toBe(0);
});
