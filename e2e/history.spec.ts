import { expect, test } from "@playwright/test";
import { formatDate, todayIso } from "../lib/time";
import { admin, programForClass, signInFully } from "./support";

const unique = (name: string) => `Zz ${name} ${Date.now()}${Math.floor(Math.random() * 1000)}`;

test("a move shows as two periods in the client's history and on the program", async ({
  page,
}) => {
  const staff = await signInFully(page, "ep");
  const { data: exercise } = await admin
    .from("exercises")
    .insert({ name: unique("Lift") })
    .select("id")
    .single();
  const { data: classes } = await admin
    .from("classes")
    .insert(
      ["From", "To"].map((name) => ({
        name: unique(name),
        category_code: "GENERAL",
        day_of_week: 1,
        start_time: "09:00",
        end_time: "10:00",
      })),
    )
    .select("id, name");
  const [from, to] = classes!.sort((a, b) => a.id - b.id);
  const program = await programForClass(from.id, [
    { exercise_id: exercise!.id, sets: 3, reps: "10", rm_percentage: 0.7 },
  ]);
  await programForClass(to.id, [
    { exercise_id: exercise!.id, sets: 3, reps: "12", rm_percentage: 0.6 },
  ]);

  const { data: client } = await admin
    .from("clients")
    .insert({ first_name: "Zz", last_name: unique("Mover").replace(/\s/g, ""), is_test: true })
    .select("id, first_name, last_name")
    .single();
  const name = `${client!.first_name} ${client!.last_name}`;
  await admin
    .from("class_members")
    .insert({ class_id: from.id, client_id: client!.id, added_by: staff.id });

  await page.goto(`/admin/classes/${from.id}`);
  await page.getByLabel(`Move ${name} to class`).selectOption({ label: to.name });
  await page.getByRole("row").filter({ hasText: name })
    .getByRole("button", { name: "Move", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Members (0)" })).toBeVisible();

  await page.goto(`/admin/clients/${client!.id}`);
  const history = page.getByRole("heading", { name: "Program History" }).locator("..");
  const today = formatDate(todayIso());
  const fromRow = history.getByRole("row").filter({ hasText: from.name });
  const toRow = history.getByRole("row").filter({ hasText: to.name });
  await expect(fromRow).toContainText(today);
  await expect(fromRow).toContainText(program.name);
  await expect(toRow).toContainText("Ongoing");

  await page.goto(`/admin/programs/${program.id}`);
  const clientsSection = page
    .getByRole("heading", { name: "Clients who've done this program" })
    .locator("..");
  await expect(clientsSection.getByRole("link", { name })).toBeVisible();
});
