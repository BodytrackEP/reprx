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
      "Describe the exercise change only (e.g. 'Trap bar instead'). No clinical details: those belong in Cliniko.",
    ),
  ).toBeVisible();
  await dialog.getByLabel("Override weight (kg)").fill("25");
  await dialog.getByLabel("Note (optional)").fill("Trap bar instead");
  await dialog.getByLabel("Review date (optional)").fill("2026-01-01");
  await dialog.getByRole("button", { name: "Set override" }).click();

  await expect(page.getByText("25 kg", { exact: true })).toBeVisible();
  // The note replaces the "Override" label.
  await expect(page.getByText("Trap bar instead", { exact: true })).toBeVisible();
  await expect(page.getByText("Override", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Review due")).toBeVisible();

  // Applies in the other class too, at the same weight.
  await page.goto(`/admin/clients/${clientId}/program/${classB}`);
  await expect(page.getByText("25 kg", { exact: true })).toBeVisible();

  // Replacing keeps history.
  await openOverride(page, "Change", exercise.name);
  await page.getByRole("dialog").getByLabel("Override weight (kg)").fill("30");
  // A replacement with no note shows the weight alone.
  await page.getByRole("dialog").getByLabel("Note (optional)").fill("");
  await page.getByRole("dialog").getByRole("button", { name: "Replace override" }).click();
  await expect(page.getByText("30 kg", { exact: true })).toBeVisible();
  await expect(page.getByText("Trap bar instead", { exact: true })).toHaveCount(0);

  await page.goto(`/admin/clients/${clientId}?tab=overrides`);
  await expect(page.getByRole("cell", { name: "Trap bar instead" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "—" })).toBeVisible();

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
    note: "Zz dashboard review",
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

test("an override goes dormant when its exercise leaves the program, and returns", async ({
  page,
}) => {
  const staff = await signInFully(page, "ep");
  const { clientId, exercise, classA, classB } = await arrange(staff.id);
  await admin.from("weight_overrides").insert({
    client_id: clientId,
    exercise_id: exercise.id,
    override_weight_kg: 20,
    note: "Trap bar instead",
    set_by: staff.id,
  });

  // Remove the exercise from both of the client's classes.
  for (const classId of [classA, classB]) {
    await page.goto(`/admin/classes/${classId}/program`);
    await page.getByRole("button", { name: `Remove ${exercise.name}` }).click();
    await expect(page.getByText("Removed for this class")).toBeVisible();
  }

  await page.goto(`/admin/clients/${clientId}`);
  await expect(page.getByTestId("dormant-override")).toContainText(exercise.name);
  await expect(page.getByRole("heading", { name: "Active Overrides (0)" })).toBeVisible();

  // Bringing it back into one class makes it active again.
  await page.goto(`/admin/classes/${classA}/program`);
  await page.getByRole("button", { name: "Restore from library" }).click();
  await page.goto(`/admin/clients/${clientId}`);
  await expect(page.getByRole("heading", { name: "Active Overrides (1)" })).toBeVisible();
  await expect(page.getByTestId("dormant-override")).toHaveCount(0);
});
