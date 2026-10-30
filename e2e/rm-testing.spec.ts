import { expect, test } from "@playwright/test";
import { admin, signInFully } from "./support";

const unique = (name: string) => `${name}${Date.now()}${Math.floor(Math.random() * 1000)}`;

async function makeClient() {
  const lastName = unique("Zzrm");
  const { data, error } = await admin
    .from("clients")
    .insert({ first_name: "Zz", last_name: lastName, is_test: true })
    .select("id")
    .single();
  if (error) throw error;
  return { id: data.id, name: `Zz ${lastName}` };
}

test("a test is recorded with an inline exercise, a preview and a warning", async ({ page }) => {
  await signInFully(page, "ep");
  const client = await makeClient();
  const exercise = unique("Zz Squat ");

  await page.goto("/admin/rm-testing");
  await page.getByLabel("Client").selectOption({ label: client.name });
  await expect(page).toHaveURL(new RegExp(`client=${client.id}`));

  // Inline creation returns with the exercise preselected.
  await page.getByRole("button", { name: "+ Create new exercise…" }).click();
  await page.getByLabel("Exercise name").fill(exercise);
  await page.getByRole("button", { name: "Create exercise" }).click();
  await expect(page.getByTestId("selected-exercise")).toHaveText(exercise);

  await page.getByLabel("Weight (kg)").fill("30");
  await page.getByLabel("Reps (1–10)").fill("3");
  await expect(page.getByText("Estimated 1RM: 33 kg")).toBeVisible();
  await expect(page.getByText("less reliable")).toHaveCount(0);

  await page.getByLabel("Reps (1–10)").fill("1");
  await expect(page.getByText("Estimated 1RM: 30 kg")).toBeVisible();

  await page.getByLabel("Reps (1–10)").fill("7");
  await expect(page.getByText("Estimate less reliable above 6 reps.")).toBeVisible();

  await page.getByLabel("Reps (1–10)").fill("3");
  await page.getByRole("button", { name: "Record Test" }).click();
  await expect(page.getByText("Recorded. Estimated 1RM: 33 kg.")).toBeVisible();

  const row = page.getByRole("row").filter({ hasText: exercise });
  await expect(row.getByText("3 × 30 kg")).toBeVisible();
  await expect(row.getByText("33 kg", { exact: true })).toBeVisible();
});

test("reps outside 1–10 are refused by the server", async ({ page }) => {
  await signInFully(page, "ep");
  const client = await makeClient();
  const exercise = unique("Zz Row ");

  await page.goto(`/admin/rm-testing?client=${client.id}`);
  await page.getByRole("button", { name: "+ Create new exercise…" }).click();
  await page.getByLabel("Exercise name").fill(exercise);
  await page.getByRole("button", { name: "Create exercise" }).click();
  await expect(page.getByTestId("selected-exercise")).toHaveText(exercise);

  await page.getByLabel("Weight (kg)").fill("30");
  await page.getByLabel("Reps (1–10)").fill("11");
  await page.getByLabel("Reps (1–10)").evaluate((input) => input.removeAttribute("max"));
  await page.getByRole("button", { name: "Record Test" }).click();
  await expect(page.getByText("Reps must be 1 to 10.")).toBeVisible();
});

test("a voided test stays in the history, marked, and can't be voided twice", async ({ page }) => {
  const staff = await signInFully(page, "ep");
  const client = await makeClient();
  const { data: exercise } = await admin
    .from("exercises")
    .insert({ name: unique("Zz Press ") })
    .select("id, name")
    .single();
  await admin.from("rm_tests").insert({
    client_id: client.id,
    exercise_id: exercise!.id,
    reps: 1,
    weight_kg: 50,
    recorded_by: staff.id,
  });

  await page.goto(`/admin/rm-testing?client=${client.id}&exercise=${exercise!.id}`);
  await expect(page.getByTestId("selected-exercise")).toHaveText(exercise!.name);

  await page.getByRole("button", { name: "Void" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Reason").fill("Wrong client");
  await dialog.getByRole("button", { name: "Void test" }).click();

  await expect(page.getByText("Voided: Wrong client")).toBeVisible();
  await expect(page.getByRole("button", { name: "Void", exact: true })).toHaveCount(0);
});
