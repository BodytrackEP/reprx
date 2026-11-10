import { expect, type Page, test } from "@playwright/test";
import { admin, programForClass, signInFully } from "./support";

const unique = (name: string) => `${name}${Date.now()}${Math.floor(Math.random() * 1000)}`;

/** A client in two classes that both use the same exercise, with a 57.5 kg 1RM. */
async function arrange(staffId: string) {
  const lastName = unique("Zzov");
  const { data: client } = await admin
    .from("clients")
    .insert({ first_name: "Zz", last_name: lastName, is_test: true })
    .select("id")
    .single();
  const { data: exercise } = await admin
    .from("exercises")
    .insert({ name: unique("Zz Press ") })
    .select("id, name")
    .single();

  const classes = [];
  for (const percentage of [0.7, 0.5]) {
    const { data: classRow } = await admin
      .from("classes")
      .insert({
        name: unique("Zz Class "),
        category_code: "GENERAL",
        day_of_week: 1,
        start_time: "09:00",
        end_time: "10:00",
      })
      .select("id")
      .single();
    await programForClass(classRow!.id, [
      { exercise_id: exercise!.id, sets: 3, reps: "10", rm_percentage: percentage },
    ]);
    await admin
      .from("class_members")
      .insert({ class_id: classRow!.id, client_id: client!.id, added_by: staffId });
    classes.push(classRow!.id);
  }

  await admin.from("rm_tests").insert({
    client_id: client!.id,
    exercise_id: exercise!.id,
    reps: 1,
    weight_kg: 57.5,
    recorded_by: staffId,
  });

  return {
    clientId: client!.id,
    exercise: exercise!,
    classA: classes[0],
    classB: classes[1],
  };
}

const openOverride = (page: Page, verb: "Set" | "Change", exercise: string) =>
  page.getByRole("button", { name: `${verb} override for ${exercise}` }).click();

test("an override follows the client, keeps history and can be ended", async ({ page }) => {
  const staff = await signInFully(page, "ep");
  const { clientId, exercise, classA, classB } = await arrange(staff.id);

  await page.goto(`/admin/clients/${clientId}/program/${classA}`);
  await expect(page.getByText("40 kg", { exact: true })).toBeVisible();

  await openOverride(page, "Set", exercise.name);
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByText(
      "Brief training reason only (e.g. 'L shoulder rehab – reduce pressing'). Clinical notes belong in Cliniko.",
    ),
  ).toBeVisible();
  await dialog.getByLabel("Override weight (kg)").fill("25");
  await dialog.getByLabel("Reason").fill("L shoulder rehab");
  await dialog.getByLabel("Review date (optional)").fill("2026-01-01");
  await dialog.getByRole("button", { name: "Set override" }).click();

  await expect(page.getByText("25 kg", { exact: true })).toBeVisible();
  await expect(page.getByText("Override", { exact: true })).toBeVisible();
  await expect(page.getByText("Review due")).toBeVisible();

  // Applies in the other class too, at the same weight.
  await page.goto(`/admin/clients/${clientId}/program/${classB}`);
  await expect(page.getByText("25 kg", { exact: true })).toBeVisible();

  // Replacing keeps history.
  await openOverride(page, "Change", exercise.name);
  await page.getByRole("dialog").getByLabel("Override weight (kg)").fill("30");
  await page.getByRole("dialog").getByLabel("Reason").fill("Shoulder improving");
  await page.getByRole("dialog").getByRole("button", { name: "Replace override" }).click();
  await expect(page.getByText("30 kg", { exact: true })).toBeVisible();

  await page.goto(`/admin/clients/${clientId}?tab=overrides`);
  await expect(page.getByRole("cell", { name: "L shoulder rehab" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Shoulder improving" })).toBeVisible();

  // Ending reverts to the calculated weight.
  await page.goto(`/admin/clients/${clientId}/program/${classA}`);
  await openOverride(page, "Change", exercise.name);
  await page.getByRole("dialog").getByRole("button", { name: "End override" }).click();
  await expect(page.getByText("40 kg", { exact: true })).toBeVisible();
  await expect(page.getByText("Override", { exact: true })).toHaveCount(0);
});

test("the client page summarises tests, and a due review reaches the dashboard", async ({
  page,
}) => {
  const staff = await signInFully(page, "ep");
  const { clientId, exercise } = await arrange(staff.id);

  await admin.from("rm_tests").insert({
    client_id: clientId,
    exercise_id: exercise.id,
    test_date: "2020-01-01",
    reps: 1,
    weight_kg: 50,
    recorded_by: staff.id,
  });
  await admin.from("weight_overrides").insert({
    client_id: clientId,
    exercise_id: exercise.id,
    override_weight_kg: 20,
    reason: "Zz dashboard review",
    review_date: "2026-01-01",
    set_by: staff.id,
  });

  await page.goto(`/admin/clients/${clientId}`);
  await expect(page.getByRole("heading", { name: "Active Overrides (1)" })).toBeVisible();
  await expect(page.getByText("+7.5 kg")).toBeVisible();
  await expect(page.getByText("Review due: 01/01/2026")).toBeVisible();

  await page.goto("/admin");
  await expect(page.getByRole("cell", { name: "Zz dashboard review" }).first()).toBeVisible();
});
