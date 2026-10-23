import { expect, test } from "@playwright/test";

test("home page renders in Swedish by default", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Mini ATS" })).toBeVisible();
  await expect(page.getByText("Under uppbyggnad")).toBeVisible();
});
