import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

const PASSWORD = "e2e-password-123";
const run = Date.now().toString(36);
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);
const email = `e2e-stages-${run}@example.com`;
let orgId: string;
let userId: string;
let jobId: string;

test.beforeAll(async () => {
  const { data: org } = await admin
    .from("organizations")
    .insert({ name: `E2E Stages ${run}`, slug: `e2e-stages-${run}` })
    .select("id")
    .single();
  orgId = org!.id;
  const { data: user, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    app_metadata: { role: "customer", organization_id: orgId },
  });
  if (error) throw error;
  userId = user.user.id;
  const { data: job } = await admin
    .from("jobs")
    .insert({ organization_id: orgId, title: "Säljare" })
    .select("id")
    .single();
  jobId = job!.id;
  const { data: cand } = await admin
    .from("candidates")
    .insert({ organization_id: orgId, full_name: "Maja Ek" })
    .select("id")
    .single();
  await admin.from("applications").insert({
    organization_id: orgId,
    candidate_id: cand!.id,
    job_id: jobId,
  });
});

test.afterAll(async () => {
  await admin.auth.admin.deleteUser(userId);
  await admin.from("organizations").delete().eq("id", orgId);
});

test("a recruiter adds job stages and moves a card into one", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("E-post").fill(email);
  await page.getByLabel("Lösenord").fill(PASSWORD);
  await page.getByRole("button", { name: "Logga in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  // Rename the screening stage and add a second interview stage
  await page.goto("/jobs");
  await page.getByRole("button", { name: "Steg", exact: true }).click();
  const dialog = page.getByRole("dialog");
  const screening = dialog.getByLabel("Stegets namn (Screening)");
  await screening.fill("Telefonintervju");
  await screening.press("Enter");
  await expect
    .poll(async () => {
      const { data } = await admin
        .from("job_stages")
        .select("name")
        .eq("job_id", jobId)
        .eq("phase", "screening");
      return data?.map((s) => s.name);
    })
    .toEqual(["Telefonintervju"]);
  await dialog
    .getByRole("button", { name: "Lägg till ett steg i Intervju" })
    .click();
  await dialog.getByLabel("Namn på det nya steget i Intervju").fill("Case");
  await dialog.getByRole("button", { name: "Lägg till", exact: true }).click();
  await expect(dialog.getByLabel("Stegets namn (Intervju)")).toHaveCount(2);
  // The last stage of a phase cannot be deleted
  const offer = dialog.locator("li", {
    has: page.getByLabel("Stegets namn (Erbjudande)"),
  });
  await expect(
    offer.getByRole("button", { name: "Ta bort steget" }),
  ).toBeDisabled();
  await page.keyboard.press("Escape");

  // The job's board shows its own stages; move the card with the keyboard
  await page.goto(`/pipeline?jobs=${jobId}`);
  for (const name of ["Ansökt", "Telefonintervju", "Intervju", "Case"])
    await expect(page.getByRole("region", { name, exact: true })).toBeVisible();
  const applied = page.getByRole("region", { name: "Ansökt" });
  await applied.getByRole("button", { name: /Maja/ }).focus();
  await page.keyboard.press("Space");
  await page.waitForTimeout(300);
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(300);
  await page.keyboard.press("Space");
  await expect(
    page.getByRole("region", { name: "Telefonintervju" }).getByText("Maja Ek"),
  ).toBeVisible();
  await expect
    .poll(async () => {
      const { data } = await admin
        .from("applications")
        .select("stage, job_stages!applications_stage_in_job(name)")
        .eq("job_id", jobId)
        .single();
      return data;
    })
    .toEqual({ stage: "screening", job_stages: { name: "Telefonintervju" } });

  // The all jobs board keeps the phases and shows the stage name on the card
  await page.goto("/pipeline");
  const card = page
    .getByRole("region", { name: "Screening" })
    .getByRole("button", { name: /Maja/ });
  await expect(card).toContainText("Telefonintervju");
});
