import { expect, type Page, test } from "@playwright/test";
import { addDays, dayOfWeek, todayIso } from "../lib/time";
import { admin, programForClass, signInFully, sql, testingSession } from "./support";

const unique = (name: string) => `${name}${Date.now()}${Math.floor(Math.random() * 1000)}`;

/** A class that runs today, with one client tested at 100 kg on a 50% exercise. */
async function arrange(staffId: string) {
  const today = todayIso();
  const { data: classRow } = await admin
    .from("classes")
    .insert({
      name: unique("Zz Snapshot "),
      category_code: "GENERAL",
      day_of_week: dayOfWeek(today),
      start_time: "00:00",
      end_time: "00:30",
    })
    .select("id, name")
    .single();
  const { data: exercise } = await admin
    .from("exercises")
    .insert({ name: unique("Zz Squat ") })
    .select("id, name")
    .single();
  const { data: client } = await admin
    .from("clients")
    .insert({ first_name: "Zz", last_name: unique("Snap"), is_test: true })
    .select("id, first_name, last_name")
    .single();

  // The program and membership start before the past session we'll record.
  const program = await programForClass(classRow!.id, [
    { exercise_id: exercise!.id, sets: 3, reps: "10", rm_percentage: 0.5 },
  ]);
  await sql(
    "update public.class_program_assignments set start_date = $1 where class_id = $2",
    [addDays(today, -60), classRow!.id],
  );
  await admin.from("class_members").insert({
    class_id: classRow!.id,
    client_id: client!.id,
    added_by: staffId,
    added_at: new Date(Date.now() - 30 * 86_400_000).toISOString(),
  });
  await testingSession(client!.id, staffId, [{ exercise_id: exercise!.id, reps: 1, weight_kg: 100 }],
    addDays(today, -20));

  return {
    classId: classRow!.id,
    exercise: exercise!,
    client: client!,
    program,
    fullName: `${client!.first_name} ${client!.last_name}`,
  };
}

/** Records and locks a past session, as the end-of-day job would. */
async function recordPastSession(classId: number, date: string) {
  await sql("select private.snapshot_session($1, $2::date, 'test')", [classId, date]);
  await sql("select private.lock_sessions($1::date)", [date]);
}

/** A read-only cell of a past session, as an EP sees it. */
const recordCell = (page: Page, exercise: string, fullName: string) =>
  page.locator(`td div[aria-label="${exercise} for ${fullName}"]`);
/** The same cell as an admin sees it: a correction button. */
const correctCell = (page: Page, exercise: string, fullName: string) =>
  page.getByRole("button", { name: `Correct ${exercise} for ${fullName}` });

test("today's session is saved for the record when opened", async ({ page }) => {
  const staff = await signInFully(page, "ep");
  const { classId } = await arrange(staff.id);

  await page.goto(`/admin/sessions/${classId}`);
  await expect(page.getByTestId("session-status")).toContainText("Saved for the record at");
  await expect(page.locator("tbody td").first()).toContainText("50 kg");
});

test("a past session shows its locked record, never recalculated", async ({ page }) => {
  const staff = await signInFully(page, "ep");
  const { classId, exercise, client, fullName } = await arrange(staff.id);
  const lastWeek = addDays(todayIso(), -7);
  await recordPastSession(classId, lastWeek);

  // Later changes: a new test and an override.
  await testingSession(client.id, staff.id, [{ exercise_id: exercise.id, reps: 1, weight_kg: 200 }]);
  await admin.from("weight_overrides").insert({
    client_id: client.id,
    exercise_id: exercise.id,
    override_weight_kg: 10,
    note: "Trap bar instead",
    set_by: staff.id,
  });

  await page.goto(`/admin/sessions/${classId}?date=${lastWeek}`);
  await expect(page.getByTestId("session-status")).toContainText("Locked record of this session");
  const cell = recordCell(page, exercise.name, fullName);
  await expect(cell).toContainText("50 kg");
  await expect(cell).not.toContainText("Trap bar instead");

  // An EP can't correct it.
  await expect(
    page.getByRole("button", { name: `Correct ${exercise.name} for ${fullName}` }),
  ).toHaveCount(0);

  // Today shows the live weight with the override.
  await page.getByRole("link", { name: "Today" }).click();
  await expect(page.locator("tbody td").first()).toContainText("10 kg");
  await expect(page.locator("tbody td").first()).toContainText("Trap bar instead");
});

test("an admin corrects a locked session, and the change is audited", async ({ page }) => {
  const staff = await signInFully(page, "admin");
  const { classId, exercise, fullName } = await arrange(staff.id);
  const lastWeek = addDays(todayIso(), -7);
  await recordPastSession(classId, lastWeek);

  await page.goto(`/admin/sessions/${classId}?date=${lastWeek}`);
  await correctCell(page, exercise.name, fullName).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Weight (kg)").fill("47.5");
  await dialog.getByLabel("Note (optional)").fill("Box squat");
  await dialog.getByRole("button", { name: "Save correction" }).click();

  await expect(dialog).toBeHidden();
  const cell = correctCell(page, exercise.name, fullName);
  await expect(cell).toContainText("47.5 kg");
  await expect(cell).toContainText("Corrected");

  await page.goto("/admin/audit?table=session_snapshot_rows");
  const entry = page.getByRole("row").filter({ hasText: "UPDATE" }).first();
  await expect(entry).toContainText("effective_kg");
  await expect(entry).toContainText("Zz admin");
});

test("a future date is a live plan, and the history links to recorded weights", async ({
  page,
}) => {
  const staff = await signInFully(page, "ep");
  const { classId, client } = await arrange(staff.id);
  const lastWeek = addDays(todayIso(), -7);
  await recordPastSession(classId, lastWeek);

  await page.goto(`/admin/sessions/${classId}`);
  await page.getByRole("link", { name: /→$/ }).click();
  await expect(page.getByTestId("session-status")).toContainText("Planned");

  await page.goto(`/admin/clients/${client.id}`);
  await page
    .getByRole("heading", { name: "Program History" })
    .locator("..")
    .getByRole("link", { name: "Weights" })
    .first()
    .click();
  // Last week's locked record, and today's, saved when the session was opened above.
  await expect(page.getByTestId("session-record")).toHaveCount(2);
  for (const record of await page.getByTestId("session-record").all()) {
    await expect(record).toContainText("50 kg");
  }
});
