import { expect, type Page, test } from "@playwright/test";
import { todayIso } from "../lib/time";
import { admin, programForClass, signInFully } from "./support";

const unique = (name: string) => `Zz ${name} ${Date.now()}${Math.floor(Math.random() * 1000)}`;

async function makeClass() {
  const { data, error } = await admin
    .from("classes")
    .insert({
      name: unique("Class"),
      category_code: "GENERAL",
      day_of_week: 1,
      start_time: "09:00",
      end_time: "10:00",
    })
    .select("id, name")
    .single();
  if (error) throw error;
  return data;
}

async function makeExercise() {
  const { data } = await admin
    .from("exercises")
    .insert({ name: unique("Lift") })
    .select("id, name")
    .single();
  return data!;
}

const libraryRow = (page: Page, name: string) =>
  page.getByTestId("program-row").filter({ has: page.getByRole("heading", { name }) });
const classRow = (page: Page, name: string) =>
  page.getByTestId("class-row").filter({ has: page.getByRole("heading", { name }) });

test("a library program is built with text reps and saved as a version", async ({ page }) => {
  await signInFully(page, "ep");
  const name = unique("Program");

  await page.goto("/admin/programs");
  await page.getByRole("button", { name: "+ New Program" }).click();
  await page.getByRole("dialog").getByLabel("Program name").fill(name);
  await page.getByRole("dialog").getByRole("button", { name: "Create program" }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
  await expect(page.getByText(/^PRG-\d{4}$/)).toBeVisible();

  // Inline exercise creation adds the new exercise to the program.
  const exercise = unique("Press");
  await page.getByRole("button", { name: "+ Add Exercise" }).click();
  await page.getByRole("button", { name: "+ Create new exercise…" }).click();
  await page.getByLabel("Exercise name").fill(exercise);
  await page.getByRole("button", { name: "Create exercise" }).click();

  const row = libraryRow(page, exercise);
  await row.getByLabel("Reps").fill("10 SL");
  await expect(row.getByText("3 × 10 SL @70%")).toBeVisible();

  // The server refuses reps over 20 characters even if the field's limit is bypassed.
  await row.getByLabel("Reps").evaluate((input) => input.removeAttribute("maxlength"));
  await row.getByLabel("Reps").fill("x".repeat(21));
  await page.getByRole("button", { name: "Save new version" }).click();
  await expect(page.getByText("Reps can be at most 20 characters. (row 1)")).toBeVisible();

  await row.getByLabel("Reps").fill("10 SL");
  await page.getByRole("button", { name: "Save new version" }).click();
  await expect(page.getByText("Saved as version 2. Updated 0 classes.")).toBeVisible();
  await expect(page.getByText(/^Version 2, saved/)).toBeVisible();

  // There is no way to delete a program.
  await expect(page.getByRole("button", { name: /delete/i })).toHaveCount(0);
});

test("a library edit reaches both classes except a customised row", async ({ page }) => {
  await signInFully(page, "ep");
  const [first, second] = [await makeExercise(), await makeExercise()];
  const [classA, classB] = [await makeClass(), await makeClass()];

  const items = [
    { exercise_id: first.id, sets: 3, reps: "10", rm_percentage: 0.7 },
    { exercise_id: second.id, sets: 3, reps: "8 each side", rm_percentage: 0.6 },
  ];
  const program = await programForClass(classA.id, items);
  await admin.rpc("assign_program", {
    p_class_id: classB.id,
    p_program_id: program.id,
    p_start_date: todayIso(),
  });

  // Class B makes the second row its own.
  await page.goto(`/admin/classes/${classB.id}/program`);
  const custom = classRow(page, second.name);
  await custom.getByLabel("Sets").fill("5");
  await custom.getByRole("button", { name: "Save" }).click();
  await expect(custom.getByText("Differs from library")).toBeVisible();

  // The library changes sets on both rows.
  await page.goto(`/admin/programs/${program.id}`);
  await libraryRow(page, first.name).getByLabel("Sets").fill("4");
  await libraryRow(page, second.name).getByLabel("Sets").fill("4");
  await page.getByRole("button", { name: "Save new version" }).click();
  await expect(page.getByText("Saved as version 3. Updated 2 classes.")).toBeVisible();

  await page.goto(`/admin/classes/${classA.id}/program`);
  await expect(classRow(page, first.name).getByText("4 × 10 @70%")).toBeVisible();
  await expect(classRow(page, second.name).getByText("4 × 8 each side @60%")).toBeVisible();

  await page.goto(`/admin/classes/${classB.id}/program`);
  await expect(classRow(page, first.name).getByText("4 × 10 @70%")).toBeVisible();
  await expect(classRow(page, second.name).getByText("5 × 8 each side @60%")).toBeVisible();

  // Reset brings the library's row back.
  await classRow(page, second.name).getByRole("button", { name: "Reset to library" }).click();
  await expect(classRow(page, second.name).getByText("4 × 8 each side @60%")).toBeVisible();
  await expect(classRow(page, second.name).getByText("Differs from library")).toHaveCount(0);
});

test("an archived program can't be assigned, and overlaps are refused", async ({ page }) => {
  await signInFully(page, "ep");
  const exercise = await makeExercise();
  const classRowData = await makeClass();
  const running = await programForClass(classRowData.id, [
    { exercise_id: exercise.id, sets: 3, reps: "10", rm_percentage: 0.7 },
  ]);

  const { data: spareId } = await admin.rpc("create_program", { p_name: unique("Spare") });
  const { data: spare } = await admin
    .from("library_programs")
    .select("code, name")
    .eq("id", spareId)
    .single();

  await page.goto(`/admin/programs/${spareId}`);
  await page.getByRole("button", { name: "Archive" }).click();
  await expect(page.getByText("Archived programs can't be edited or assigned.")).toBeVisible();

  await page.goto(`/admin/classes/${classRowData.id}`);
  await page.getByRole("button", { name: "Assign program" }).click();
  const dialog = page.getByRole("dialog");
  const options = await dialog.getByLabel("Program").locator("option").allTextContents();
  expect(options).not.toContain(`${spare!.code} ${spare!.name}`);

  // The class already runs a program from today, with no end date.
  const runningCode = (
    await admin.from("library_programs").select("code").eq("id", running.id).single()
  ).data!.code;
  await dialog.getByLabel("Program").selectOption({ label: `${runningCode} ${running.name}` });
  await dialog.getByRole("button", { name: "Assign program" }).click();
  await expect(dialog.getByText("Those dates overlap another program for this class.")).toBeVisible();
});
