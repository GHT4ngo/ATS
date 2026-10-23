import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

// The dev server runs with AI_FAKE=1, so this checks the whole flow except
// the Claude call itself: PDF text extraction, storage, RLS and the UI.
const PASSWORD = "e2e-password-123";
const run = Date.now().toString(36);
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);
const email = `e2e-ai-${run}@example.com`;
let orgId: string;
let userId: string;
let candidateId: string;

test.beforeAll(async () => {
  const { data: org } = await admin
    .from("organizations")
    .insert({ name: `E2E AI ${run}`, slug: `e2e-ai-${run}` })
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
    .insert({
      organization_id: orgId,
      title: "Frontendutvecklare",
      description: "React och TypeScript",
    })
    .select("id")
    .single();
  const { data: cand } = await admin
    .from("candidates")
    .insert({ organization_id: orgId, full_name: "Elin Sandberg" })
    .select("id")
    .single();
  candidateId = cand!.id;
  const path = `${orgId}/${candidateId}/cv.pdf`;
  await admin.storage
    .from("cvs")
    .upload(path, readFileSync("e2e/fixtures/cv.pdf"), {
      contentType: "application/pdf",
    });
  await admin
    .from("candidates")
    .update({ cv_path: path })
    .eq("id", candidateId);
  await admin.from("applications").insert({
    organization_id: orgId,
    candidate_id: candidateId,
    job_id: job!.id,
  });
});

test.afterAll(async () => {
  await admin.storage.from("cvs").remove([`${orgId}/${candidateId}/cv.pdf`]);
  await admin.auth.admin.deleteUser(userId);
  await admin.from("organizations").delete().eq("id", orgId);
});

test("a recruiter assesses a CV and sees the score on the card", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("E-post").fill(email);
  await page.getByLabel("Lösenord").fill(PASSWORD);
  await page.getByRole("button", { name: "Logga in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto(`/pipeline?candidate=${candidateId}`);
  const drawer = page.getByRole("dialog");
  await expect(drawer).toContainText("beslutsstöd, inte ett beslut");
  await drawer.getByRole("button", { name: "Bedöm CV" }).click();
  await expect(drawer).toContainText("Test assessment.");
  await expect(drawer.getByLabel("AI-poäng 72 av 100")).toBeVisible();
  await expect(drawer).toContainText("AI-bedömning, poäng 72");
  await expect(
    drawer.getByRole("button", { name: "Bedöm igen" }),
  ).toBeVisible();

  // A deliberate rerun right away runs again (no silent cooldown)
  await drawer.getByRole("button", { name: "Bedöm igen" }).click();
  await expect
    .poll(async () => {
      const { count } = await admin
        .from("cv_assessments")
        .select("id", { count: "exact", head: true })
        .eq("candidate_id", candidateId);
      return count;
    })
    .toBe(2);

  await page.keyboard.press("Escape");
  await expect(
    page
      .getByRole("region", { name: "Ansökt" })
      .getByLabel("AI-poäng 72 av 100"),
  ).toBeVisible();

  const { data } = await admin
    .from("cv_assessments")
    .select("score, created_by")
    .eq("candidate_id", candidateId);
  expect(data).toEqual([
    { score: 72, created_by: userId },
    { score: 72, created_by: userId },
  ]);
  const { count: locks } = await admin
    .from("cv_assessment_locks")
    .select("candidate_id", { count: "exact", head: true })
    .eq("candidate_id", candidateId);
  expect(locks).toBe(0);
});
