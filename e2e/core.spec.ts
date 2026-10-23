import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";

const PASSWORD = "e2e-password-123";
const run = Date.now().toString(36);
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);
const emails = {
  admin: `e2e-core-admin-${run}@example.com`,
  customer: `e2e-core-${run}@example.com`,
};
const orgName = `E2E Core ${run}`;
let orgId: string;

async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("E-post").fill(email);
  await page.getByLabel("Lösenord").fill(PASSWORD);
  await page.getByRole("button", { name: "Logga in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test.beforeAll(async () => {
  const { error } = await admin.auth.admin.createUser({
    email: emails.admin,
    password: PASSWORD,
    email_confirm: true,
    app_metadata: { role: "admin" },
    user_metadata: { full_name: "Core Admin" },
  });
  if (error) throw error;
});

test.afterAll(async () => {
  const { data } = await admin
    .from("profiles")
    .select("id")
    .in("email", Object.values(emails));
  for (const { id } of data ?? []) await admin.auth.admin.deleteUser(id);
  await admin.from("organizations").delete().eq("slug", `e2e-core-${run}`);
});

test("admin creates a customer, who creates a job and candidates, moves a card and filters", async ({
  page,
}) => {
  // Admin creates the customer organization and its first user
  await signIn(page, emails.admin);
  await page.goto("/admin/organizations");
  await page.getByRole("button", { name: "Ny organisation" }).click();
  await page.getByLabel("Organisationens namn").fill(orgName);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Ny organisation" })
    .click();
  await expect(
    page.getByRole("cell", { name: `e2e-core-${run}` }),
  ).toBeVisible();
  const { data: org } = await admin
    .from("organizations")
    .select("id")
    .eq("slug", `e2e-core-${run}`)
    .single();
  orgId = org!.id;

  await page.goto("/admin/users");
  await page.getByRole("button", { name: "Ny användare" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Namn").fill("Core Customer");
  await dialog.getByLabel("E-post").fill(emails.customer);
  await dialog.getByLabel("Organisation").click();
  await page.getByRole("option", { name: orgName }).click();
  await dialog.getByLabel("Tillfälligt lösenord").fill(PASSWORD);
  await dialog.getByRole("button", { name: "Skapa" }).click();
  await expect(
    page.getByRole("row", { name: new RegExp(emails.customer) }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Logga ut" }).click();
  await expect(page).toHaveURL(/\/login$/);

  // The customer signs in with the temporary password
  await signIn(page, emails.customer);

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
