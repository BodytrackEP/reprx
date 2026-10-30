import { describe, expect, it } from "vitest";
import { isSessionExpired, lastAuthenticatedAt } from "./session";

const HOUR = 3600;
const signedInAt = 1_000_000;
const amr = [
  { method: "password", timestamp: signedInAt },
  { method: "totp", timestamp: signedInAt + 30 },
];
const at = (seconds: number) => (signedInAt + 30 + seconds) * 1000;

describe("lastAuthenticatedAt", () => {
  it("uses the most recent proof of identity", () => {
    expect(lastAuthenticatedAt(amr)).toBe(signedInAt + 30);
  });

  it("returns null when the claim is missing or has no timestamps", () => {
    expect(lastAuthenticatedAt(undefined)).toBeNull();
    expect(lastAuthenticatedAt(["password"])).toBeNull();
  });
});

describe("isSessionExpired", () => {
  it("keeps a session inside the limit", () => {
    expect(isSessionExpired(amr, 12, at(12 * HOUR))).toBe(false);
  });

  it("ends a session past the limit", () => {
    expect(isSessionExpired(amr, 12, at(12 * HOUR + 1))).toBe(true);
  });

  it("leaves a session alone if its age is unknown", () => {
    expect(isSessionExpired(undefined, 12, at(999 * HOUR))).toBe(false);
  });
});
