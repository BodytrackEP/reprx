// Writes .env.local from the running local Supabase stack (local demo keys only).
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const status = JSON.parse(execSync("pnpm exec supabase status -o json", { encoding: "utf8" }));

writeFileSync(
  ".env.local",
  [
    `NEXT_PUBLIC_SUPABASE_URL=${status.API_URL}`,
    `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${status.PUBLISHABLE_KEY}`,
    `SUPABASE_SECRET_KEY=${status.SECRET_KEY}`,
    `SUPABASE_DB_URL=${status.DB_URL}`,
    `MAILPIT_URL=${status.MAILPIT_URL}`,
    "",
  ].join("\n"),
);

console.log("Wrote .env.local for the local stack.");
