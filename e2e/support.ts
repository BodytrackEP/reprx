import { createHmac, randomUUID } from "node:crypto";
import { expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

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
