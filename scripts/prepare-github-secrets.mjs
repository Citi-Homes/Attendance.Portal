/**
 * Prints GitHub Actions secret values from local config.js (for one-time setup).
 * Run: node scripts/prepare-github-secrets.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = fs.readFileSync(path.join(root, "config.js"), "utf8");

function extract(key) {
  const m = src.match(new RegExp(key + ':\\s*"([^"]+)"'));
  return m ? m[1] : null;
}

const sessionSecret = extract("sessionSecret");
const supabaseUrl = extract("supabaseUrl");
const supabaseAnonKey = extract("supabaseAnonKey");

const adminsMatch = src.match(/admins:\s*(\[[\s\S]*?\])\s*,\s*employeePassHashes/s);
const empMatch = src.match(/employeePassHashes:\s*(\{[\s\S]*?\})\s*\}/);

if (!sessionSecret || !supabaseUrl || !supabaseAnonKey || !adminsMatch || !empMatch) {
  console.error("Could not parse config.js — ensure supabaseUrl and supabaseAnonKey are set");
  process.exit(1);
}

console.log("Add these in GitHub → Repo → Settings → Secrets and variables → Actions:\n");
console.log("APP_URL=" + (extract("appUrl") || "https://citi-homes.github.io/Attendance.Portal/"));
console.log("SESSION_SECRET=" + sessionSecret);
console.log("SUPABASE_URL=" + supabaseUrl);
console.log("SUPABASE_ANON_KEY=" + supabaseAnonKey);
console.log("ADMIN_HASHES_JSON=" + JSON.stringify(JSON.parse(adminsMatch[1])));
console.log("EMPLOYEE_HASHES_JSON=" + JSON.stringify(JSON.parse(empMatch[1] + "}")));
