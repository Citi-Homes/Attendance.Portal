/**
 * Generates config.js from environment variables (CI / GitHub Actions).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const required = [
  "SESSION_SECRET",
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "ADMIN_HASHES_JSON",
  "EMPLOYEE_HASHES_JSON"
];

for (const key of required) {
  if (!process.env[key]) {
    console.error(`Missing env var: ${key}`);
    process.exit(1);
  }
}

let admins, employeePassHashes;
try {
  admins = JSON.parse(process.env.ADMIN_HASHES_JSON);
  employeePassHashes = JSON.parse(process.env.EMPLOYEE_HASHES_JSON);
} catch (e) {
  console.error("Invalid JSON in ADMIN_HASHES_JSON or EMPLOYEE_HASHES_JSON");
  process.exit(1);
}

const out = `window.ATT_CONFIG = {
  sessionSecret: ${JSON.stringify(process.env.SESSION_SECRET)},
  appUrl: ${JSON.stringify(process.env.APP_URL || "https://citi-homes.github.io/Attendance.Portal/")},
  supabaseUrl: ${JSON.stringify(process.env.SUPABASE_URL)},
  supabaseAnonKey: ${JSON.stringify(process.env.SUPABASE_ANON_KEY)},
  admins: ${JSON.stringify(admins, null, 2)},
  employeePassHashes: ${JSON.stringify(employeePassHashes, null, 2)}
};
`;

fs.writeFileSync(path.join(root, "config.js"), out);
console.log("config.js generated");
