import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

// The dev server runs with AI_FAKE=1: a scripted model drives the real loop,
// tools, approval flow and RLS, without calling Claude.
const PASSWORD = "e2e-password-123";
const run = Date.now().toString(36);
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);
const email = `e2e-agent-${run}@example.com`;
let orgId: string;
let userId: string;

test.beforeAll(async () => {
  const { data: org } = await admin
    .from("organizations")
    .insert({ name: `E2E Agent ${run}`, slug: `e2e-agent-${run}` })
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
    .insert({ organization_id: orgId, title: "Backendutvecklare" })
    .select("id")
    .single();
  const { data: cands } = await admin
    .from("candidates")
    .insert([
      { organization_id: orgId, full_name: "Karin Åberg" },
      { organization_id: orgId, full_name: "Sofia Ekström" },
    ])
    .select("id, full_name");
  await admin.from("applications").insert(
    cands!.map((c, i) => ({
      organization_id: orgId,
      candidate_id: c.id,
      job_id: job!.id,
      position: i + 1,
    })),
  );
});

test.afterAll(async () => {
  await admin.auth.admin.deleteUser(userId);
  await admin.from("organizations").delete().eq("id", orgId);
});

test("the assistant answers, and moves a candidate only after approval", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("E-post").fill(email);
  await page.getByLabel("Lösenord").fill(PASSWORD);
  await page.getByRole("button", { name: "Logga in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/pipeline");

  await page.getByRole("button", { name: "Assistent" }).click();
  const panel = page.getByRole("complementary", { name: "Assistent" });
  await panel.getByRole("button", { name: "Sammanfatta pipelinen" }).click();
  await expect(panel).toContainText("Ansökt: 2.");

  // Declined: nothing changes
  await panel.getByLabel("Meddelande till assistenten").fill("Flytta någon");
  await panel.getByRole("button", { name: "Skicka" }).click();
  await expect(panel).toContainText(
    "Flytta Karin Åberg (Backendutvecklare) från Ansökt till Screening?",
  );
  await panel.getByRole("button", { name: "Avböj" }).click();
  await expect(panel).toContainText("Okej, jag flyttar inte.");
  const stages = async () =>
    (
      await admin
        .from("applications")
        .select("stage")
        .eq("organization_id", orgId)
        .order("position")
    ).data?.map((a) => a.stage);
  expect(await stages()).toEqual(["applied", "applied"]);

  // Approved: the card moves and the board refreshes
  await panel.getByLabel("Meddelande till assistenten").fill("Flytta någon");
  await panel.getByRole("button", { name: "Skicka" }).click();
  await panel.getByRole("button", { name: "Godkänn" }).click();
  await expect(panel).toContainText("Klart, kandidaten är flyttad.");
  await expect(
    page.getByRole("region", { name: "Screening" }).getByText("Karin Åberg"),
  ).toBeVisible();
  expect((await stages())?.sort()).toEqual(["applied", "screening"]);
  const { data: log } = await admin
    .from("activity_log")
    .select("action, payload, actor_id")
    .eq("organization_id", orgId)
    .eq("action", "moved");
  expect(log).toEqual([
    {
      action: "moved",
      actor_id: userId,
      payload: {
        from: "applied",
        to: "screening",
        job: "Backendutvecklare",
        via: "assistant",
      },
    },
  ]);
});
