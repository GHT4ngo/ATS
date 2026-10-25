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
  const { data: bo } = await admin
    .from("candidates")
    .insert({ organization_id: orgId, full_name: "Bo Lind" })
    .select("id")
    .single();
  const { error: appError } = await admin.from("applications").insert([
    {
      organization_id: orgId,
      candidate_id: cand!.id,
      job_id: jobId,
      stage: "applied",
      position: 1,
    },
    {
      organization_id: orgId,
      candidate_id: bo!.id,
      job_id: jobId,
      stage: "interview",
      position: 1,
    },
  ]);
  if (appError) throw appError;
});

test.afterAll(async () => {
  await admin.auth.admin.deleteUser(userId);
  await admin.from("organizations").delete().eq("id", orgId);
});

test("a recruiter adds job stages and moves a card into one", async ({
  page,
}) => {
  const { data: maja } = await admin
    .from("candidates")
    .select("id")
    .eq("organization_id", orgId)
    .eq("full_name", "Maja Ek")
    .single();
  test.setTimeout(90_000);
  const cand = maja!.id;
  const { data: boRow } = await admin
    .from("candidates")
    .select("id")
    .eq("organization_id", orgId)
    .eq("full_name", "Bo Lind")
    .single();
  const bo = boRow!.id;
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
        .eq("candidate_id", cand)
        .single();
      return data;
    })
    .toEqual({ stage: "screening", job_stages: { name: "Telefonintervju" } });

  // Reordering inside a stage keeps the card there and logs no move
  const { data: interviewStage } = await admin
    .from("job_stages")
    .select("id")
    .eq("job_id", jobId)
    .eq("phase", "interview")
    .is("name", null)
    .single();
  await admin
    .from("applications")
    .update({ stage_id: interviewStage!.id, position: 5 })
    .eq("candidate_id", cand);
  const movesBefore = (
    await admin
      .from("activity_log")
      .select("id")
      .eq("organization_id", orgId)
      .eq("action", "moved")
  ).data?.length;
  await page.reload();
  const interview = page.getByRole("region", { name: "Intervju", exact: true });
  await expect(interview.getByRole("button", { name: /Maja/ })).toBeVisible();
  await interview.getByRole("button", { name: /Maja/ }).focus();
  await page.keyboard.press("Space");
  await page.waitForTimeout(300);
  await page.keyboard.press("ArrowUp");
  await page.waitForTimeout(300);
  await page.keyboard.press("Space");
  await expect
    .poll(async () => {
      const { data } = await admin
        .from("applications")
        .select("position, stage_id")
        .eq("candidate_id", cand)
        .single();
      return data!.position < 1 && data!.stage_id === interviewStage!.id;
    })
    .toBe(true);
  const movesAfter = (
    await admin
      .from("activity_log")
      .select("id")
      .eq("organization_id", orgId)
      .eq("action", "moved")
  ).data?.length;
  expect(movesAfter).toBe(movesBefore);

  // Hired lanes start folded; a hired card can be cleared off the board
  await admin
    .from("applications")
    .update({ stage: "hired" })
    .eq("candidate_id", bo);
  await page.reload();
  // One opening, now filled: the job's board starts folded too
  await page.getByRole("button", { name: /^Säljare/ }).click();
  await page.getByRole("button", { name: "Fäll ut Anställd" }).click();
  await page
    .getByRole("button", { name: "Ta bort Bo Lind från tavlan", exact: true })
    .click();
  await expect(page.getByText("Bo Lind togs bort från tavlan")).toBeVisible();
  await expect(page.getByRole("link", { name: "Bo Lind" })).toHaveCount(0);
  await expect
    .poll(async () => {
      const { data } = await admin
        .from("applications")
        .select("archived_at")
        .eq("candidate_id", bo)
        .single();
      return data!.archived_at !== null;
    })
    .toBe(true);
});
