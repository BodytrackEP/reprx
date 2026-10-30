import { expect, type Page, test } from "@playwright/test";
import { signInFully } from "./support";

const unique = (name: string) => `Zz ${name} ${Date.now()}-${Math.floor(Math.random() * 1000)}`;

async function createClass(page: Page) {
  const name = unique("Class");
  await page.goto("/admin/classes");
  await page.getByRole("button", { name: "+ New Class" }).click();
  await page.getByLabel("Class name").fill(name);
  await page.getByLabel("Max capacity").fill("10");
  await page.getByRole("button", { name: "Create class" }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
  return name;
}

test("a class gets a program, built with an inline exercise", async ({ page }) => {
  await signInFully(page, "ep");
  const className = await createClass(page);

  await page.getByRole("link", { name: "Build Program" }).first().click();
  await expect(page.getByRole("heading", { name: "Program Builder" })).toBeVisible();

  // Inline creation returns to the builder with the new exercise added.
  const first = unique("Press");
  await page.getByRole("button", { name: "+ Add Exercise" }).click();
  await page.getByRole("button", { name: "+ Create new exercise…" }).click();
  await page.getByLabel("Exercise name").fill(first);
  await page.getByRole("button", { name: "Create exercise" }).click();
  await expect(page.getByRole("heading", { name: first })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  const second = unique("Row");
  await page.getByRole("button", { name: "+ Add Exercise" }).click();
  await page.getByRole("button", { name: "+ Create new exercise…" }).click();
  await page.getByLabel("Exercise name").fill(second);
  await page.getByRole("button", { name: "Create exercise" }).click();
  await expect(page.getByRole("heading", { name: second })).toBeVisible();

  // Reorder
  const headings = page.getByRole("heading", { level: 2 });
  await expect(headings.first()).toHaveText(first);
  await page.getByRole("button", { name: `Move ${second} up` }).click();
  await expect(headings.first()).toHaveText(second);

  // Edit and persist
  const row = page.locator("form", { has: page.getByRole("heading", { name: first }) });
  await row.getByLabel("% 1RM").fill("65");
  await row.getByLabel("Start kg").fill("20");
  await row.getByRole("button", { name: "Save" }).click();
  await expect(row.getByText("Saved")).toBeVisible();

  await page.reload();
  const reloaded = page.locator("form", { has: page.getByRole("heading", { name: first }) });
  await expect(reloaded.getByLabel("% 1RM")).toHaveValue("65");
  await expect(reloaded.getByLabel("Start kg")).toHaveValue("20");

  // Class page summary
  await page.getByRole("link", { name: className }).click();
  await expect(page.getByText("3 x 10 @ 65% 1RM")).toBeVisible();

  // Remove
  await page.getByRole("link", { name: "Edit Program" }).first().click();
  await page.getByRole("button", { name: `Remove ${first}` }).click();
  await expect(page.getByRole("heading", { name: first })).toHaveCount(0);
});

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

  await createClass(page);
  await page.getByRole("link", { name: "Build Program" }).first().click();
  await page.getByRole("button", { name: "+ Add Exercise" }).click();
  await page.getByRole("dialog").getByLabel("Search exercises").fill(used);
  await page.getByRole("dialog").getByRole("button", { name: used }).click();
  await expect(page.getByRole("heading", { name: used })).toBeVisible();

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
