import { createHmac, randomUUID } from "node:crypto";
import { expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import { todayIso } from "../lib/time";

export const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

export const PASSWORD = "correct-horse-battery";

export async function createStaff(role: "admin" | "ep") {
  const email = `${role}-${randomUUID()}@test.invalid`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (error) throw error;

  const { error: staffError } = await admin
    .from("staff")
    .insert({ id: data.user.id, display_name: `Zz ${role}`, role });
  if (staffError) throw staffError;

  return { id: data.user.id, email };
}

type ProgramItem = {
  exercise_id: number;
  sets: number;
  reps: string;
  rm_percentage?: number | null;
  fallback_weight_kg?: number | null;
  superset_group?: number | null;
  colour?: string | null;
  notes?: string | null;
};

/** Creates a library program and assigns it to a class from today. */
export async function programForClass(classId: number, items: ProgramItem[]) {
  const name = `Zz Program ${randomUUID().slice(0, 8)}`;
  const { data: programId, error } = await admin.rpc("create_program", { p_name: name });
  if (error) throw error;
  const { error: saveError } = await admin.rpc("save_program_version", {
    p_program_id: programId,
    p_name: name,
    p_items: items,
  });
  if (saveError) throw saveError;
  const { error: assignError } = await admin.rpc("assign_program", {
    p_class_id: classId,
    p_program_id: programId,
    p_start_date: todayIso(),
  });
  if (assignError) throw assignError;
  return { id: programId as number, name };
}

/**
 * Runs SQL on the local database directly. Only for what the API deliberately can't reach,
 * such as the scheduled snapshot and lock jobs in the private schema.
 */
export async function sql(text: string, values: unknown[] = []) {
  const client = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL });
  await client.connect();
  try {
    return (await client.query(text, values)).rows;
  } finally {
    await client.end();
  }
}

/** Records a testing session for a client holding the given results. */
export async function testingSession(
  clientId: number,
  staffId: string,
  results: { exercise_id: number; reps: number; weight_kg: number }[],
  testDate = todayIso(),
) {
  const { data: session, error } = await admin
    .from("rm_testing_sessions")
    .insert({ client_id: clientId, test_date: testDate, conducted_by: staffId })
    .select("id, session_no")
    .single();
  if (error) throw error;
  const { error: resultError } = await admin
    .from("rm_results")
    .insert(results.map((result) => ({ ...result, session_id: session.id, recorded_by: staffId })));
  if (resultError) throw resultError;
  return session;
}

/** The link in the newest local email to this address with this subject. */
export async function emailLink(to: string, subject: string) {
  const query = encodeURIComponent(`to:${to} subject:"${subject}"`);

  for (let attempt = 0; attempt < 20; attempt++) {
    const search = await fetch(
      `${process.env.MAILPIT_URL}/api/v1/search?query=${query}`,
    ).then((response) => response.json());

    if (search.messages?.length > 0) {
      const message = await fetch(
        `${process.env.MAILPIT_URL}/api/v1/message/${search.messages[0].ID}`,
      ).then((response) => response.json());
      return /href="([^"]+)"/.exec(message.HTML)![1].replaceAll("&amp;", "&");
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`No email to ${to}`);
}

/** RFC 6238 TOTP (SHA-1, 30 s, 6 digits), for answering the MFA prompt. */
export function totp(secret: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const bits = [...secret.replace(/=+$/, "")]
    .map((char) => alphabet.indexOf(char).toString(2).padStart(5, "0"))
    .join("");
  const key = Buffer.from(
    (bits.match(/.{8}/g) ?? []).map((byte) => parseInt(byte, 2)),
  );

  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));

  const hash = createHmac("sha1", key).update(counter).digest();
  const offset = hash[hash.length - 1] & 0xf;
  const value = hash.readUInt32BE(offset) & 0x7fffffff;
  return String(value % 1_000_000).padStart(6, "0");
}

export async function signInWithPassword(page: Page, email: string, password = PASSWORD) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/mfa$/);
}

/** Completes first-time TOTP enrolment and returns the secret. */
export async function enrolTotp(page: Page) {
  const secret = await page.getByTestId("totp-secret").innerText();
  await page.getByLabel("6-digit code").fill(totp(secret));
  await page.getByRole("button", { name: "Verify" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  return secret;
}

export async function signInFully(page: Page, role: "admin" | "ep") {
  const staff = await createStaff(role);
  await signInWithPassword(page, staff.email);
  const secret = await enrolTotp(page);
  return { ...staff, secret };
}
