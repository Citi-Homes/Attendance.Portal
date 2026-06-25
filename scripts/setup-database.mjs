/**
 * Creates the attendance_records table in Supabase.
 * Requires SUPABASE_DB_PASSWORD in .env or environment.
 *
 * Get password: Supabase Dashboard → Project Settings → Database → Database password
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function loadEnv() {
  const envPath = path.join(root, ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m || m[1].startsWith("#")) continue;
    let val = m[2].replace(/^["']|["']$/g, "");
    if (!process.env[m[1]]) process.env[m[1]] = val;
  }
}

function projectRefFromUrl(url) {
  const m = String(url || "").match(/https:\/\/([^.]+)\.supabase\.co/);
  return m ? m[1] : null;
}

loadEnv();

const supabaseUrl = process.env.SUPABASE_URL;
const dbPassword = process.env.SUPABASE_DB_PASSWORD;
const projectRef =
  process.env.SUPABASE_PROJECT_REF || projectRefFromUrl(supabaseUrl);

if (!dbPassword || !projectRef) {
  console.error(`
Missing database credentials.

1. Copy .env.example to .env
2. Set SUPABASE_URL and SUPABASE_DB_PASSWORD
   (Supabase Dashboard → Project Settings → Database → Database password)

Then run:  npm run setup:db
`);
  process.exit(1);
}

const sqlPath = path.join(root, "supabase-setup.sql");
const sql = fs
  .readFileSync(sqlPath, "utf8")
  .replace(/^--.*$/gm, "")
  .trim();

const client = new pg.Client({
  host: `db.${projectRef}.supabase.co`,
  port: 5432,
  database: "postgres",
  user: "postgres",
  password: dbPassword,
  ssl: { rejectUnauthorized: false }
});

console.log("Connecting to Supabase database…");
await client.connect();
console.log("Running supabase-setup.sql…");
await client.query(sql);
await client.end();
console.log("Done — attendance_records table is ready.");
