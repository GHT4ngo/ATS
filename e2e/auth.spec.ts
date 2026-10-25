import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";

const PASSWORD = "e2e-password-123";
const run = Date.now().toString(36);
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const emails = {
  admin: `e2e-admin-${run}@example.com`,
  customer: `e2e-customer-${run}@example.com`,
  mate: `e2e-mate-${run}@example.com`,
  created: `e2e-created-${run}@example.com`,
};
let orgId: string;
const userIds: string[] = [];

async function createUser(
  email: string,
  name: string,
  role: string,
  org?: string,
) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    app_metadata: { role, ...(org ? { organization_id: org } : {}) },
    user_metadata: { full_name: name },
  });
  if (error) throw error;
  userIds.push(data.user.id);
}

async function signIn(
  page: Page,
  email: string,
  password = PASSWORD,
  expectDashboard = true,
) {
  await page.goto("/login");
  await page.getByLabel("E-post").fill(email);
  await page.getByLabel("Lösenord").fill(password);
  await page.getByRole("button", { name: "Logga in" }).click();
  if (expectDashboard) await expect(page).toHaveURL(/\/dashboard$/);
}

test.beforeAll(async () => {
  const { data, error } = await admin
    .from("organizations")
    .insert({ name: `E2E Org ${run}`, slug: `e2e-org-${run}` })
    .select("id")
    .single();
  if (error) throw error;
  orgId = data.id;
  await createUser(emails.admin, "E2E Admin", "admin");
  await createUser(emails.customer, "E2E Customer", "customer", orgId);
  await createUser(emails.mate, "E2E Teammate", "customer", orgId);
});

test.afterAll(async () => {
  const { data } = await admin
    .from("profiles")
    .select("id")
    .eq("email", emails.created);
  for (const id of [...userIds, ...(data ?? []).map((p) => p.id)]) {
    await admin.auth.admin.deleteUser(id);
  }
  await admin.from("organizations").delete().eq("id", orgId);
  await admin.from("organizations").delete().eq("slug", `e2e-new-org-${run}`);
});

test("signed out visitors are sent to the login page", async ({ page }) => {
  await page.goto("/candidates");
  await expect(page).toHaveURL(/\/login$/);
});

test("wrong password shows an error", async ({ page }) => {
  await signIn(page, emails.customer, "wrong-password-1", false);
  await expect(page.locator("p[role=alert]")).toHaveText(
    "Fel e-postadress eller lösenord.",
  );
});

test("customer signs in, sees the team and cannot reach the admin pages", async ({
  page,
}) => {
  await signIn(page, emails.customer);
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(
    page.getByRole("listitem").filter({ hasText: "E2E Teammate" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Användare" })).toHaveCount(0);

  await page.goto("/admin/users");
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByRole("button", { name: "Logga ut" }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test("customer changes language and name in the settings", async ({ page }) => {
  await signIn(page, emails.mate);
  await page.getByRole("button", { name: "Inställningar" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Fullständigt namn").fill("E2E Renamed");
  await dialog.getByLabel("Språk").click();
  await page.getByRole("option", { name: "English" }).click();
  await dialog.getByRole("button", { name: "Spara", exact: true }).click();
  await expect(page.getByText("Saved")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible();
});

test("admin creates an organization and a user, acts as the customer and deactivates the user", async ({
  page,
}) => {
  await signIn(page, emails.admin);
  await page.goto("/admin/users");
  await page.getByRole("button", { name: "Ny organisation" }).click();
  await page.getByLabel("Organisationens namn").fill(`E2E New Org ${run}`);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Ny organisation" })
    .click();
  await expect(
    page.getByRole("region", { name: `E2E New Org ${run}` }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Ny användare" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Namn").fill("E2E Created");
  await dialog.getByLabel("E-post").fill(emails.created);
  await dialog.getByLabel("Organisation").click();
  await page.getByRole("option", { name: `E2E Org ${run}` }).click();
  await dialog.getByRole("button", { name: "Generera" }).click();
  await dialog.getByRole("button", { name: "Skapa" }).click();
  const row = page.getByRole("listitem").filter({ hasText: emails.created });
  await expect(row).toBeVisible();

  // Act as the customer organization.
  await page.getByLabel("Agera som kund").click();
  await page.getByRole("option", { name: `E2E Org ${run}` }).click();
  await expect(page.getByText(`Visar som E2E Org ${run}`)).toBeVisible();
  await page.goto("/dashboard");
  await expect(
    page.getByRole("listitem").filter({ hasText: "E2E Created" }),
  ).toBeVisible();

  // Deactivate the new user.
  await page.goto("/admin/users");
  await row.getByRole("button", { name: /^Åtgärder för/ }).click();
  await page.getByRole("menuitem", { name: "Inaktivera" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Inaktivera" })
    .click();
  await expect(row.getByText("Inaktiverad")).toBeVisible();
});

test("admin turns on developer mode and previews the app as a customer", async ({
  page,
}) => {
  await signIn(page, emails.admin);
  await page.getByRole("button", { name: "Inställningar" }).click();
  await page.getByRole("dialog").getByRole("switch").click();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Utvecklarverktyg" }).click();
  await page.getByRole("menuitem", { name: `E2E Org ${run}` }).click();
  await expect(page.getByText(`Kundvy: E2E Org ${run}`)).toBeVisible();
  await expect(page.getByRole("link", { name: "Användare" })).toHaveCount(0);
  await expect(page.getByLabel("Agera som kund")).toHaveCount(0);

  await page.getByRole("button", { name: "Avsluta kundvy" }).click();
  await expect(page.getByRole("link", { name: "Användare" })).toBeVisible();
  await expect(page.getByText(`Visar som E2E Org ${run}`)).toBeVisible();
});

test("a deactivated user cannot sign in", async ({ page }) => {
  await signIn(page, emails.created, PASSWORD, false);
  await expect(page.locator("p[role=alert]")).toHaveText(
    "Kontot har inaktiverats. Kontakta din administratör.",
  );
});

test("a user resets a forgotten password through the email link", async ({
  page,
}) => {
  await page.goto("/forgot-password");
  await page.getByLabel("E-post").fill(emails.customer);
  await page.getByRole("button", { name: "Skicka länk" }).click();
  await expect(page.getByRole("status")).toBeVisible();

  // Read the reset link from the local Mailpit inbox.
  let link: string | undefined;
  await expect
    .poll(async () => {
      const res = await fetch(
        `http://127.0.0.1:54324/api/v1/search?query=${encodeURIComponent(`to:${emails.customer}`)}`,
      );
      const { messages } = await res.json();
      if (!messages?.length) return undefined;
      const msg = await (
        await fetch(`http://127.0.0.1:54324/api/v1/message/${messages[0].ID}`)
      ).json();
      link = msg.Text.match(/https?:\/\/\S+verify\S+/)?.[0];
      return link;
    })
    .toBeTruthy();

  await page.goto(link!);
  await expect(page).toHaveURL(/\/reset-password$/);
  const newPassword = "e2e-new-password-456";
  await page.getByLabel("Nytt lösenord").fill(newPassword);
  await page.getByLabel("Bekräfta lösenord").fill(newPassword);
  await page.getByRole("button", { name: "Spara lösenord" }).click();
  await expect(page.getByRole("status")).toHaveText(
    "Ditt lösenord har ändrats.",
  );

  await page.context().clearCookies();
  await signIn(page, emails.customer, newPassword);
});
