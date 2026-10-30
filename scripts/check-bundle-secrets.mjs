// CI check (§10): server-only secrets must never reach the browser bundle.
// Run after `next build`. Exits non-zero if a forbidden marker is found.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const clientDir = ".next/static";
const forbidden = ["SUPABASE_SECRET_KEY", "sb_secret_", "service_role", "CRON_SECRET", "CLINIKO_API_KEY"];

// The real value is matched too when the build environment provides it.
for (const name of ["SUPABASE_SECRET_KEY", "CRON_SECRET", "CLINIKO_API_KEY"]) {
  if (process.env[name]) forbidden.push(process.env[name]);
}

const walk = (dir) =>
  readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });

const files = walk(clientDir);
const hits = files.filter((file) => {
  const content = readFileSync(file, "utf8");
  return forbidden.some((marker) => content.includes(marker));
});

if (hits.length > 0) {
  console.error("Server secret marker found in the browser bundle:");
  for (const file of hits) console.error(`  ${file}`);
  process.exit(1);
}

console.log(`Checked ${files.length} client files: no server secrets found.`);
