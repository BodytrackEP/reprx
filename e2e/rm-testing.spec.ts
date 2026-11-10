import { expect, type Page, test } from "@playwright/test";
import { todayIso } from "../lib/time";
import { admin, signInFully, testingSession } from "./support";

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

async function makeExercise() {
  const { data } = await admin
    .from("exercises")
    .insert({ name: unique("Zz Press ") })
    .select("id, name")
    .single();
  return data!;
}

async function startSession(page: Page, client: { id: number; name: string }) {
  await page.goto("/admin/rm-testing");
  await page.getByLabel("Client").selectOption({ label: client.name });
  await expect(page).toHaveURL(new RegExp(`client=${client.id}`));
  await page.getByRole("button", { name: "Start testing session" }).click();
  await expect(page.getByRole("heading", { name: "Session 1", exact: true })).toBeVisible();
}

test("a testing session records results, with a preview, a warning and inline exercises", async ({
  page,
}) => {
  await signInFully(page, "ep");
  const client = await makeClient();
  await startSession(page, client);

  const exercise = unique("Zz Squat ");
  await page.getByRole("button", { name: "+ Create new exercise…" }).click();
  await page.getByLabel("Exercise name").fill(exercise);
  await page.getByRole("button", { name: "Create exercise" }).click();
  await expect(page.getByTestId("selected-exercise")).toHaveText(exercise);

  await page.getByLabel("Weight (kg)").fill("30");
  await page.getByLabel("Reps (1–10)").fill("3");
  await expect(page.getByText("Estimated 1RM: 33 kg")).toBeVisible();
  await page.getByLabel("Reps (1–10)").fill("7");
  await expect(page.getByText("Estimate less reliable above 6 reps.")).toBeVisible();
  await page.getByLabel("Reps (1–10)").fill("3");
  await page.getByRole("button", { name: "Record result" }).click();
  await expect(page.getByText("Recorded. Estimated 1RM: 33 kg.")).toBeVisible();

  const session = page.getByTestId("rm-session").first();
  await expect(session.getByRole("row").filter({ hasText: exercise })).toContainText("3 × 30 kg");

  // The same exercise can't be recorded twice in one session.
  await page.getByLabel("Search exercises").fill(exercise);
  await page.getByRole("button", { name: new RegExp(`^${exercise}`) }).click();
  await page.getByLabel("Weight (kg)").fill("35");
  await page.getByRole("button", { name: "Record result" }).click();
  await expect(page.getByText("already recorded in this session")).toBeVisible();

  // Voiding frees it to be recorded again.
  await session.getByRole("button", { name: `Void ${exercise}, session 1` }).click();
  await page.getByRole("dialog").getByLabel("Reason").fill("Typed the wrong weight");
  await page.getByRole("dialog").getByRole("button", { name: "Void result" }).click();
  await expect(session.getByText("Voided: Typed the wrong weight")).toBeVisible();

  await page.getByRole("button", { name: "Record result" }).click();
  // Reps reset to 1 after the first result, so this is a true 1RM of 35 kg.
  await expect(page.getByText("Recorded. Estimated 1RM: 35 kg.")).toBeVisible();
});

test("sessions are numbered per client, and reps outside 1–10 are refused", async ({ page }) => {
  const staff = await signInFully(page, "ep");
  const client = await makeClient();
  const exercise = await makeExercise();
  await testingSession(client.id, staff.id, [{ exercise_id: exercise.id, reps: 1, weight_kg: 50 }],
    "2026-01-01");

  await page.goto(`/admin/rm-testing?client=${client.id}`);
  await page.getByRole("button", { name: "Start testing session" }).click();
  await expect(page.getByRole("heading", { name: "Session 2", exact: true })).toBeVisible();

  await page.getByLabel("Search exercises").fill(exercise.name);
  await page.getByRole("button", { name: new RegExp(`^${exercise.name}`) }).click();
  await page.getByLabel("Weight (kg)").fill("30");
  await page.getByLabel("Reps (1–10)").fill("11");
  await page.getByLabel("Reps (1–10)").evaluate((input) => input.removeAttribute("max"));
  await page.getByRole("button", { name: "Record result" }).click();
  await expect(page.getByText("Reps must be 1 to 10.")).toBeVisible();
});

test("a trend line appears from 3 sessions, on the RM page and client page", async ({ page }) => {
  const staff = await signInFully(page, "ep");
  const client = await makeClient();
  const [trended, sparse] = [await makeExercise(), await makeExercise()];

  const dates = ["2026-07-01", "2026-08-01", "2026-09-01"];
  for (const [index, date] of dates.entries()) {
    await testingSession(
      client.id,
      staff.id,
      [
        { exercise_id: trended.id, reps: 1, weight_kg: 50 + index * 5 },
        ...(index < 2 ? [{ exercise_id: sparse.id, reps: 1, weight_kg: 40 }] : []),
      ],
      date,
    );
  }

  for (const path of [`/admin/rm-testing?client=${client.id}`, `/admin/clients/${client.id}`]) {
    await page.goto(path);
    const chart = page.getByTestId("trend-chart").filter({ hasText: trended.name });
    await expect(chart.getByTestId("trend-line")).toBeVisible();
    // 5 kg every month: about 1.15 kg per week.
    await expect(chart).toContainText("Trend +1.1");
    await expect(chart).toContainText("kg/week");

    const short = page.getByTestId("trend-chart").filter({ hasText: sparse.name });
    await expect(short).toContainText("Needs 3 sessions for a trend (2 so far).");
    await expect(short.getByTestId("trend-line")).toHaveCount(0);
  }
  expect(todayIso() > dates[2]).toBe(true);
});
