/**
 * Verifies Supabase REST API read/write works.
 * Reads SUPABASE_URL + SUPABASE_ANON_KEY from .env or config.js
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

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

function loadFromConfigJs() {
  const cfgPath = path.join(root, "config.js");
  if (!fs.existsSync(cfgPath)) return {};
  const src = fs.readFileSync(cfgPath, "utf8");
  const url = src.match(/supabaseUrl:\s*"([^"]+)"/)?.[1];
  const key = src.match(/supabaseAnonKey:\s*"([^"]+)"/)?.[1];
  return { url, key };
}

loadEnv();
const fromConfig = loadFromConfigJs();
const url = (process.env.SUPABASE_URL || fromConfig.url || "").replace(/\/$/, "");
const key = process.env.SUPABASE_ANON_KEY || fromConfig.key;

if (!url || !key) {
  console.error("Missing SUPABASE_URL / SUPABASE_ANON_KEY in .env or config.js");
  process.exit(1);
}

const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  "Content-Type": "application/json"
};

console.log("Checking table attendance_records…");
const listRes = await fetch(`${url}/rest/v1/attendance_records?select=id&limit=1`, { headers });
const listBody = await listRes.text();

if (!listRes.ok) {
  console.error("READ failed:", listRes.status, listBody);
  if (listBody.includes("42501") || listBody.includes("permission denied")) {
    console.error("\nPermissions missing. Run supabase-fix-permissions.sql in Supabase SQL Editor");
    console.error("Or: set SUPABASE_DB_PASSWORD in .env and run:  npm run fix:permissions");
  } else if (listBody.includes("attendance_records") || listRes.status === 404) {
    console.error("\nRun:  npm run setup:db   (after setting SUPABASE_DB_PASSWORD in .env)");
  }
  process.exit(1);
}
console.log("READ ok");

const probeRes = await fetch(`${url}/rest/v1/attendance_records?select=record_date&limit=1`, { headers });
const hasRecordDate = probeRes.ok;

const testId = Date.now();
const row = {
  id: testId,
  emp_code: "TEST",
  emp_name: "Setup Verify",
  category: "Office",
  punch_in: new Date().toISOString().slice(0, 10) + " · 09:00 AM",
  status: "Recorded",
  extra: {},
  source: "verify-script"
};
if (hasRecordDate) {
  row.record_date = new Date().toISOString().slice(0, 10);
}

const insertRes = await fetch(`${url}/rest/v1/attendance_records`, {
  method: "POST",
  headers: { ...headers, Prefer: "return=minimal" },
  body: JSON.stringify(row)
});
if (!insertRes.ok) {
  const errText = await insertRes.text();
  console.error("INSERT failed:", insertRes.status, errText);
  process.exit(1);
}
console.log("INSERT ok");
if (!hasRecordDate) {
  console.warn("\nNote: record_date column missing — run supabase-add-record-date.sql for full-month reporting in Supabase.");
}

const delRes = await fetch(`${url}/rest/v1/attendance_records?id=eq.${testId}`, {
  method: "DELETE",
  headers
});
if (!delRes.ok) {
  console.error("DELETE failed:", delRes.status, await delRes.text());
  process.exit(1);
}
console.log("DELETE ok");
console.log("\nSupabase API is fully working. Start the app with:  npm start");
