import { expect, test } from "@playwright/test";
import { signInFully } from "./support";

const unique = (name: string) => `Zz ${name} ${Date.now()}-${Math.floor(Math.random() * 1000)}`;

test("an exercise can't be duplicated, and a used one is deactivated, not deleted", async ({
  page,
}) => {
  await signInFully(page, "ep");
  const unused = unique("Unused");
  const used = unique("Used");

  for (const name of [unused, used]) {
    await page.goto("/admin/exercises");
    await page.getByRole("button", { name: "+ New Exercise" }).click();
    await page.getByRole("dialog").getByLabel("Exercise name").fill(name);
    await page.getByRole("dialog").getByRole("button", { name: "Create exercise" }).click();
    await expect(page.getByRole("heading", { name })).toBeVisible();
  }

  await page.getByRole("button", { name: "+ New Exercise" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Exercise name").fill(used.toUpperCase());
  await dialog.getByRole("button", { name: "Create exercise" }).click();
  await expect(dialog.getByText("already exists")).toBeVisible();
  await dialog.getByRole("button", { name: "Close" }).click();

  // Using it in a saved program version references it for good.
  await page.goto("/admin/programs");
  await page.getByRole("button", { name: "+ New Program" }).click();
  await page.getByRole("dialog").getByLabel("Program name").fill(unique("Program"));
  await page.getByRole("dialog").getByRole("button", { name: "Create program" }).click();
  await page.getByRole("button", { name: "+ Add Exercise" }).click();
  await page.getByRole("dialog").getByLabel("Search exercises").fill(used);
  await page.getByRole("dialog").getByRole("button", { name: used }).click();
  await page.getByRole("button", { name: "Save new version" }).click();
  await expect(page.getByText("Saved as version 2.")).toBeVisible();

  await page.goto(`/admin/exercises?q=${encodeURIComponent("Zz")}`);
  const card = (name: string) =>
    page.locator("div.rounded-xl", { has: page.getByRole("heading", { name }) });

  await card(unused).getByRole("button", { name: "Remove" }).click();
  await expect(page.getByRole("heading", { name: unused })).toHaveCount(0);

  await card(used).getByRole("button", { name: "Remove" }).click();
  await expect(page.getByRole("heading", { name: used })).toHaveCount(0);

  await page.goto(`/admin/exercises?inactive=on&q=${encodeURIComponent(used)}`);
  await expect(page.getByRole("heading", { name: used })).toBeVisible();
  await expect(page.getByText("Inactive", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: unused })).toHaveCount(0);
});

test("a class needs an end time after its start time", async ({ page }) => {
  await signInFully(page, "ep");
  await page.goto("/admin/classes");
  await page.getByRole("button", { name: "+ New Class" }).click();
  await page.getByLabel("Class name").fill(unique("Backwards"));
  await page.getByLabel("Start time").fill("11:00");
  await page.getByLabel("End time").fill("10:00");
  await page.getByRole("button", { name: "Create class" }).click();
  await expect(page.getByText("The end time must be after the start time.")).toBeVisible();
});
