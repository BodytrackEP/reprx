import { expect, test } from "@playwright/test";
import { admin, programForClass, signInFully, testingSession } from "./support";

const unique = (name: string) => `Zz ${name} ${Date.now()}${Math.floor(Math.random() * 1000)}`;

/** A class with two exercises (the first coloured) and two tested clients. */
async function arrange(staffId: string) {
  const { data: exercises } = await admin
    .from("exercises")
    .insert(["Press", "Row"].map((name) => ({ name: unique(name) })))
    .select("id, name");
  exercises!.sort((a, b) => a.id - b.id);
  const { data: classRow } = await admin
    .from("classes")
    .insert({
      name: unique("Colour Class"),
      category_code: "GENERAL",
      day_of_week: 1,
      start_time: "09:00",
      end_time: "10:00",
    })
    .select("id, name")
    .single();
  const program = await programForClass(classRow!.id, [
    { exercise_id: exercises![0].id, sets: 3, reps: "10", rm_percentage: 0.5, colour: "orange",
      notes: "Neutral grip" },
    { exercise_id: exercises![1].id, sets: 3, reps: "8", rm_percentage: 0.5 },
  ]);

  const clients = [];
  for (const [index, weight] of [100, 60].entries()) {
    const { data: client } = await admin
      .from("clients")
      .insert({ first_name: `Zz${index}`, last_name: unique("Home").replace(/\s/g, ""), is_test: true })
      .select("id, first_name, last_name")
      .single();
    await admin.from("class_members").insert({ class_id: classRow!.id, client_id: client!.id, added_by: staffId });
    await testingSession(client!.id, staffId, [{ exercise_id: exercises![0].id, reps: 1, weight_kg: weight }]);
    clients.push({ ...client!, fullName: `${client!.first_name} ${client!.last_name}` });
  }
  return { classRow: classRow!, exercises: exercises!, program, clients };
}

test("a colour chosen in the library shows on the session's exercise column", async ({ page }) => {
  const staff = await signInFully(page, "ep");
  const { classRow, exercises, program } = await arrange(staff.id);

  await page.goto(`/admin/sessions/${classRow.id}`);
  const row = (name: string) => page.getByRole("rowheader").filter({ hasText: name });
  await expect(row(exercises[0].name)).toHaveAttribute("data-colour", "orange");
  await expect(row(exercises[1].name)).toHaveAttribute("data-colour", "");

  // Colour the second row blue in the library; the push carries it to the class.
  await page.goto(`/admin/programs/${program.id}`);
  await page.getByLabel(`Colour for ${exercises[1].name}`).selectOption("blue");
  await page.getByRole("button", { name: "Save new version" }).click();
  await expect(page.getByText(/^Saved as version/)).toBeVisible();

  await page.goto(`/admin/sessions/${classRow.id}`);
  await expect(row(exercises[1].name)).toHaveAttribute("data-colour", "blue");
});

test("take-home sheets give each client a page with their own weights", async ({ page }) => {
  const staff = await signInFully(page, "ep");
  const { classRow, exercises, clients } = await arrange(staff.id);

  await page.goto(`/admin/sessions/${classRow.id}`);
  await page.getByRole("link", { name: "Take-home sheets" }).click();

  const sheets = page.getByTestId("take-home-sheet");
  await expect(sheets).toHaveCount(2);
  const sheetFor = (name: string) => sheets.filter({ hasText: name });
  await expect(sheetFor(clients[0].fullName)).toContainText("50 kg");
  await expect(sheetFor(clients[1].fullName)).toContainText("30 kg");
  await expect(sheetFor(clients[1].fullName)).not.toContainText("50 kg");
  const first = sheetFor(clients[0].fullName);
  await expect(first.getByRole("rowheader").filter({ hasText: exercises[0].name }))
    .toHaveAttribute("data-colour", "orange");
  await expect(first).toContainText("Neutral grip");
  // Clients see sets and reps, not % 1RM.
  await expect(first).toContainText("3 × 10");
  await expect(first).not.toContainText("@50%");
  await expect(first).toContainText("Ask your EP");

  await page.emulateMedia({ media: "print" });
  await expect(page.getByRole("button", { name: "Print" })).toBeHidden();
  const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
  const pages = pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g)?.length;
  expect(pages).toBe(2);
});
