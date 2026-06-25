/**
 * Applies supabase-fix-permissions.sql via direct Postgres connection.
 * Requires SUPABASE_DB_PASSWORD in .env
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
    if (!m) continue;
    let val = m[2].replace(/^["']|["']$/g, "");
    if (!process.env[m[1]]) process.env[m[1]] = val;
  }
}

function projectRefFromUrl(url) {
  const m = String(url || "").match(/https:\/\/([^.]+)\.supabase\.co/);
  return m ? m[1] : null;
}

loadEnv();

const dbPassword = process.env.SUPABASE_DB_PASSWORD;
const projectRef = process.env.SUPABASE_PROJECT_REF || projectRefFromUrl(process.env.SUPABASE_URL);

if (!dbPassword || !projectRef) {
  console.error("Set SUPABASE_DB_PASSWORD in .env (Supabase → Settings → Database → password)");
  console.error("Or run supabase-fix-permissions.sql manually in Supabase SQL Editor.");
  process.exit(1);
}

const sqlPath = path.join(root, "supabase-fix-permissions.sql");
const sql = fs.readFileSync(sqlPath, "utf8").replace(/^--.*$/gm, "").trim();

const client = new pg.Client({
  host: `db.${projectRef}.supabase.co`,
  port: 5432,
  database: "postgres",
  user: "postgres",
  password: dbPassword,
  ssl: { rejectUnauthorized: false }
});

console.log("Applying permission fix…");
await client.connect();
await client.query(sql);
await client.end();
console.log("Permissions applied. Run: npm run verify");
