import { expect, test } from "@playwright/test";
import { admin, programForClass, signInFully } from "./support";

const unique = (name: string) => `${name}${Date.now()}${Math.floor(Math.random() * 1000)}`;

/** The §10 worst case: 15 members × 12 exercises, with every weight source present. */
async function arrangeClass(staffId: string) {
  const run = unique("");
  const { data: classRow } = await admin
    .from("classes")
    .insert({
      name: `Zz Session ${run}`,
      category_code: "STRENGTH",
      day_of_week: 1,
      start_time: "09:00",
      end_time: "10:00",
    })
    .select("id, name")
    .single();
  const { data: exercises } = await admin
    .from("exercises")
    .insert(Array.from({ length: 12 }, (_, i) => ({ name: `Zz Lift ${i + 1} ${run}` })))
    .select("id, name");
  exercises!.sort((a, b) => a.id - b.id);

  await programForClass(
    classRow!.id,
    exercises!.map((exercise, i) => ({
      exercise_id: exercise.id,
      sets: 3,
      reps: "10",
      // The last is bodyweight; the one before has a starting weight.
      rm_percentage: i === 11 ? null : 0.7,
      fallback_weight_kg: i === 10 ? 20 : null,
      // The second and third make a superset, so print covers colour blocks too.
      superset_group: i === 1 || i === 2 ? 1 : null,
    })),
  );

  const { data: clients } = await admin
    .from("clients")
    .insert(
      Array.from({ length: 15 }, (_, i) => ({
        first_name: "Zz",
        last_name: `Client${String(i + 1).padStart(2, "0")}${run}`,
        is_test: true,
      })),
    )
    .select("id, first_name, last_name");
  clients!.sort((a, b) => a.id - b.id);

  await admin
    .from("class_members")
    .insert(
      clients!.map((client) => ({
        class_id: classRow!.id,
        client_id: client.id,
        added_by: staffId,
      })),
    );

  // Everyone is tested on the first nine exercises.
  await admin.from("rm_tests").insert(
    clients!.flatMap((client) =>
      exercises!.slice(0, 9).map((exercise) => ({
        client_id: client.id,
        exercise_id: exercise.id,
        reps: 1,
        weight_kg: 57.5,
        recorded_by: staffId,
      })),
    ),
  );

  await admin.from("weight_overrides").insert({
    client_id: clients![0].id,
    exercise_id: exercises![0].id,
    override_weight_kg: 25,
    reason: "L shoulder rehab",
    review_date: "2026-01-01",
    set_by: staffId,
  });

  return { classRow: classRow!, clients: clients!, exercises: exercises! };
}

test("the session view shows every member by every exercise, and takes overrides", async ({
  page,
}) => {
  const staff = await signInFully(page, "ep");
  const { classRow, clients, exercises } = await arrangeClass(staff.id);

  await page.goto(`/admin/sessions/${classRow.id}`);
  await expect(page.getByRole("heading", { name: classRow.name })).toBeVisible();

  await expect(page.locator("tbody tr")).toHaveCount(15);
  await expect(page.locator("tbody tr").first().locator("td")).toHaveCount(12);

  const overridden = `${clients[0].first_name} ${clients[0].last_name}`;
  const other = `${clients[1].first_name} ${clients[1].last_name}`;
  const cell = (exercise: number, name: string) =>
    page.getByRole("button", { name: `Override ${exercises[exercise].name} for ${name}` });

  await expect(cell(0, overridden)).toContainText("25 kg");
  await expect(cell(0, overridden)).toContainText("Override");
  await expect(cell(0, overridden)).toContainText("Review due");
  await expect(cell(0, overridden).locator("span[title]").first()).toHaveAttribute(
    "title",
    "L shoulder rehab",
  );

  await expect(cell(0, other)).toContainText("40 kg");
  await expect(cell(9, other)).toContainText("Not tested");
  await expect(cell(10, other)).toContainText("20 kg");
  await expect(cell(10, other)).toContainText("Starting weight");
  await expect(cell(11, other)).toContainText("Bodyweight");

  // Text is at least 20px, for a projector.
  const fontSize = (locator: ReturnType<typeof page.locator>) =>
    locator.evaluate((element) => parseFloat(getComputedStyle(element).fontSize));
  expect(await fontSize(page.getByRole("link", { name: other }))).toBeGreaterThanOrEqual(20);
  expect(await fontSize(page.locator("thead th").nth(1))).toBeGreaterThanOrEqual(20);
  expect(await fontSize(cell(10, other).getByText("Starting weight"))).toBeGreaterThanOrEqual(20);

  // Tapping a cell opens the override form.
  await cell(0, other).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Override weight (kg)").fill("30");
  await dialog.getByLabel("Reason").fill("R knee rehab");
  await dialog.getByRole("button", { name: "Set override" }).click();
  await expect(cell(0, other)).toContainText("30 kg");
});

test("the session view prints on one A4 landscape page", async ({ page }) => {
  const staff = await signInFully(page, "ep");
  const { classRow } = await arrangeClass(staff.id);

  await page.goto(`/admin/sessions/${classRow.id}`);
  await expect(page.locator("tbody tr")).toHaveCount(15);

  await page.emulateMedia({ media: "print" });
  // A4 landscape, less 10 mm margins, at 96 dpi.
  await page.setViewportSize({ width: 1047, height: 718 });

  await expect(page.getByRole("button", { name: "Print" })).toBeHidden();
  await expect(page.getByRole("link", { name: "Dashboard" })).toBeHidden();

  const table = await page.locator("table").boundingBox();
  expect(table!.width).toBeLessThanOrEqual(1047);

  const size = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(size.scroll).toBeLessThanOrEqual(size.client);

  const output = process.env.SESSION_PDF;
  const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true, path: output });
  const pages = pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g)?.length;
  expect(pages).toBe(1);
});
