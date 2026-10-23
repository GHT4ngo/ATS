import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

const PASSWORD = "e2e-password-123";
const run = Date.now().toString(36);
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);
const email = `e2e-core-${run}@example.com`;
let orgId: string;
let userId: string;

test.beforeAll(async () => {
  const { data: org, error } = await admin
    .from("organizations")
    .insert({ name: `E2E Core ${run}`, slug: `e2e-core-${run}` })
    .select("id")
    .single();
  if (error) throw error;
  orgId = org.id;
  const { data, error: userError } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    app_metadata: { role: "customer", organization_id: orgId },
    user_metadata: { full_name: "Core Customer" },
  });
  if (userError) throw userError;
  userId = data.user.id;
});

test.afterAll(async () => {
  await admin.auth.admin.deleteUser(userId);
  await admin.from("organizations").delete().eq("id", orgId);
});

test("customer creates a job and candidates, moves a card and filters", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("E-post").fill(email);
  await page.getByLabel("Lösenord").fill(PASSWORD);
  await page.getByRole("button", { name: "Logga in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  // Job
  await page.goto("/jobs");
  await page.getByRole("button", { name: "Ny tjänst" }).click();
  await page.getByLabel("Titel").fill("Frontendutvecklare");
  await page.getByRole("button", { name: "Spara tjänst" }).click();
  await expect(page.getByText("Frontendutvecklare")).toBeVisible();

  await page.getByRole("button", { name: "Ny tjänst" }).click();
  await page.getByLabel("Titel").fill("Produktdesigner");
  await page.getByRole("button", { name: "Spara tjänst" }).click();
  await expect(page.getByText("Produktdesigner")).toBeVisible();

  // Candidates attached to the jobs
  await page.goto("/candidates");
  for (const [name, job] of [
    ["Anna Andersson", "Frontendutvecklare"],
    ["Bo Berg", "Produktdesigner"],
  ]) {
    await page.getByRole("button", { name: "Ny kandidat" }).click();
    await page.getByLabel("Namn").fill(name);
    await page.getByLabel(job).check();
    await page.getByRole("button", { name: "Spara kandidat" }).click();
    await expect(page.getByRole("link", { name })).toBeVisible();
  }

  // Drag Anna from Applied to Screening with the keyboard
  await page.goto("/pipeline");
  const applied = page.getByRole("region", { name: "Ansökt" });
  const screening = page.getByRole("region", { name: "Screening" });
  await expect(applied.getByText("Anna Andersson")).toBeVisible();
  await applied.getByRole("button", { name: /Anna/ }).focus();
  await page.keyboard.press("Space");
  await page.waitForTimeout(300);
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(300);
  await page.keyboard.press("Space");
  await expect(screening.getByText("Anna Andersson")).toBeVisible();

  // The move is saved
  await expect
    .poll(async () => {
      const { data } = await admin
        .from("applications")
        .select("stage")
        .eq("organization_id", orgId)
        .eq("stage", "screening");
      return data?.length;
    })
    .toBe(1);
  await page.reload();
  await expect(
    page.getByRole("region", { name: "Screening" }).getByText("Anna Andersson"),
  ).toBeVisible();

  // Filter by job and by name, kept in the URL
  await page
    .getByRole("button", { name: "Produktdesigner", exact: true })
    .click();
  await expect(page).toHaveURL(/jobs=/);
  await expect(page.getByText("Anna Andersson")).toHaveCount(0);
  await expect(page.getByText("Bo Berg")).toBeVisible();
  await page.getByRole("button", { name: "Rensa" }).click();
  await page.getByPlaceholder("Sök kandidater").fill("Anna");
  await expect(page).toHaveURL(/q=Anna/);
  await expect(page.getByText("Bo Berg")).toHaveCount(0);

  // Drawer shows the activity
  await page.getByRole("link", { name: "Anna Andersson" }).click();
  await expect(page.getByRole("dialog")).toContainText("Frontendutvecklare");
  await expect(page.getByRole("dialog")).toContainText("Ansökt till Screening");

  // Command palette works with the sidebar collapsed, and opens the candidate
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Fäll ihop sidofältet" }).click();
  await page.keyboard.press("Control+k");
  await page.getByRole("combobox").fill("Bo B");
  await expect(page.getByRole("option", { name: "Bo Berg" })).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/candidate=/);
  await expect(page.getByRole("dialog")).toContainText("Bo Berg");
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Fäll ut sidofältet" }),
  ).toBeVisible();
});
