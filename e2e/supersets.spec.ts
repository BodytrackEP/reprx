import { expect, type Page, test } from "@playwright/test";
import { admin, programForClass, signInFully } from "./support";

const unique = (name: string) => `Zz ${name} ${Date.now()}${Math.floor(Math.random() * 1000)}`;

async function arrange() {
  const { data: exercises } = await admin
    .from("exercises")
    .insert(["A", "B", "C"].map((letter) => ({ name: unique(`Lift ${letter}`) })))
    .select("id, name");
  exercises!.sort((a, b) => a.id - b.id);
  const { data: classRow } = await admin
    .from("classes")
    .insert({
      name: unique("Class"),
      category_code: "GENERAL",
      day_of_week: 1,
      start_time: "09:00",
      end_time: "10:00",
    })
    .select("id")
    .single();
  const program = await programForClass(
    classRow!.id,
    exercises!.map((exercise) => ({
      exercise_id: exercise.id,
      sets: 3,
      reps: "10",
      rm_percentage: 0.7,
    })),
  );
  // A member, so the session grid has a column to show.
  const { data: client } = await admin
    .from("clients")
    .insert({ first_name: "Zz", last_name: unique("Superset").replace(/s/g, ""), is_test: true })
    .select("id")
    .single();
  const { data: anyStaff } = await admin.from("staff").select("id").limit(1).single();
  await admin
    .from("class_members")
    .insert({ class_id: classRow!.id, client_id: client!.id, added_by: anyStaff!.id });

  return { classId: classRow!.id, program, names: exercises!.map((exercise) => exercise.name) };
}

const row = (page: Page, testId: string, name: string) =>
  page.getByTestId(testId).filter({ has: page.getByRole("heading", { name }) });

test("adjacent exercises are grouped, and the group reaches the class and session", async ({
  page,
}) => {
  await signInFully(page, "ep");
  const violations: string[] = [];
  page.on("console", (message) => {
    if (message.text().includes("Content Security Policy")) violations.push(message.text());
  });
  const { classId, program, names } = await arrange();
  const [a, b, c] = names;

  await page.goto(`/admin/programs/${program.id}`);
  const groupButton = page.getByRole("button", { name: "Group as superset" });

  // Not adjacent: A and C.
  await page.getByLabel(`Select ${a}`).check();
  await page.getByLabel(`Select ${c}`).check();
  await expect(groupButton).toBeDisabled();

  await page.getByLabel(`Select ${c}`).uncheck();
  await page.getByLabel(`Select ${b}`).check();
  await groupButton.click();
  await expect(row(page, "program-row", a)).toHaveAttribute("data-superset", "1");
  await expect(row(page, "program-row", b)).toHaveAttribute("data-superset", "1");
  await expect(row(page, "program-row", c)).toHaveAttribute("data-superset", "");

  await page.getByRole("button", { name: "Save new version" }).click();
  await expect(page.getByText("Saved as version 3. Updated 1 class.")).toBeVisible();

  await page.goto(`/admin/classes/${classId}/program`);
  await expect(row(page, "class-row", a)).not.toHaveAttribute("data-superset", "");
  await expect(row(page, "class-row", c)).toHaveAttribute("data-superset", "");

  await page.goto(`/admin/sessions/${classId}`);
  // On the session grid a superset is a group of coloured rows.
  await expect(page.locator('tbody tr[data-superset]:not([data-superset=""])')).toHaveCount(2);

  expect(violations).toEqual([]);
});

test("rows reorder with the keyboard, and a moved row leaves its group", async ({ page }) => {
  await signInFully(page, "ep");
  const { program, names } = await arrange();
  const [a, b, c] = names;

  await page.goto(`/admin/programs/${program.id}`);
  await page.getByLabel(`Select ${a}`).check();
  await page.getByLabel(`Select ${b}`).check();
  await page.getByRole("button", { name: "Group as superset" }).click();

  // Lift B with Space, move it down past C, and drop it.
  await page.getByRole("button", { name: `Drag ${b} to reorder` }).focus();
  // dnd-kit acts on the next animation frame, so pause as a person would between keys.
  for (const key of ["Space", "ArrowDown", "Space"]) {
    await page.keyboard.press(key);
    await page.waitForTimeout(200);
  }

  const headings = page.getByTestId("program-row").getByRole("heading");
  await expect(headings).toHaveText([a, c, b]);
  // A and B are no longer adjacent, so the superset is dissolved.
  await expect(page.locator('[data-testid="program-row"]:not([data-superset=""])')).toHaveCount(0);
});

test("a class groups its own copy, marking those rows as differing", async ({ page }) => {
  await signInFully(page, "ep");
  const { classId, names } = await arrange();
  const [, b, c] = names;

  await page.goto(`/admin/classes/${classId}/program`);
  await page.getByLabel(`Select ${b}`).check();
  await page.getByLabel(`Select ${c}`).check();
  await page.getByRole("button", { name: "Group as superset" }).click();

  await expect(row(page, "class-row", b)).not.toHaveAttribute("data-superset", "");
  await expect(row(page, "class-row", c).getByText("Differs from library")).toBeVisible();
});
