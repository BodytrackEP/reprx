// Runs supabase/seed.sql over a direct connection, for projects where `db reset` would be
// destructive. seed.sql itself refuses to run unless the environment is local or test.
import { readFileSync } from "node:fs";
import pg from "pg";

const connectionString = process.env.SUPABASE_DB_URL;
if (!connectionString) {
  console.error("SUPABASE_DB_URL is not set.");
  process.exit(1);
}

const isLocal = /@(127\.0\.0\.1|localhost)[:/]/.test(connectionString);
const client = new pg.Client({
  connectionString,
  ssl: isLocal ? false : { rejectUnauthorized: false },
});

await client.connect();
try {
  await client.query(readFileSync("supabase/seed.sql", "utf8"));
  const { rows } = await client.query(
    "select count(*)::int as clients from public.clients where is_test",
  );
  console.log(`Seed complete: ${rows[0].clients} test clients.`);
} catch (error) {
  console.error(`Seed failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await client.end();
}
