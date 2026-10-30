import { expect, test } from "@playwright/test";
import { admin, signInFully } from "./support";

// Named zz- to run last: it deletes every test client in the database.
test("an admin purges test data, and real clients survive", async ({ page }) => {
  const { data: real } = await admin
    .from("clients")
    .insert({ first_name: "Zz", last_name: `Real${Date.now()}`, is_test: false })
    .select("id")
    .single();
  const { data: fake } = await admin
    .from("clients")
    .insert({ first_name: "Zz", last_name: `Fake${Date.now()}`, is_test: true })
    .select("id")
    .single();

  await signInFully(page, "admin");
  page.on("dialog", (dialog) => dialog.accept());

  await page.goto("/admin/settings");
  await page.getByRole("button", { name: "Purge test data" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Purged" })).toBeVisible();

  const { count } = await admin
    .from("clients")
    .select("id", { count: "exact", head: true })
    .eq("is_test", true);
  expect(count).toBe(0);

  const { data: survivors } = await admin
    .from("clients")
    .select("id")
    .in("id", [real!.id, fake!.id]);
  expect(survivors).toEqual([{ id: real!.id }]);

  await page.goto(`/admin/audit?table=clients&row=${encodeURIComponent("*")}`);
  await expect(page.getByRole("cell", { name: "purge:test-data" }).first()).toBeVisible();

  await admin.from("clients").delete().eq("id", real!.id);
});
