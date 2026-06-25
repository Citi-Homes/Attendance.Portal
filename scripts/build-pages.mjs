/**
 * Builds a dist/ folder for GitHub Pages (static files only + config.js).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const dist = path.join(root, "dist");

const STATIC_FILES = [
  "index.html",
  "employee.html",
  "admin.html",
  "setup.html",
  "shared.js",
  "styles.css",
  "web.config",
  "supabase-setup.sql",
  "supabase-fix-permissions.sql",
  "supabase-add-record-date.sql",
  "supabase-reset.sql"
];

function rmDir(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

rmDir(dist);
fs.mkdirSync(dist, { recursive: true });

for (const file of STATIC_FILES) {
  const src = path.join(root, file);
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(dist, file));
}

fs.writeFileSync(path.join(dist, ".nojekyll"), "");

const cnamePath = path.join(root, "CNAME");
if (fs.existsSync(cnamePath)) {
  fs.copyFileSync(cnamePath, path.join(dist, "CNAME"));
}

const configPath = path.join(root, "config.js");
const hasSecrets = ["SESSION_SECRET", "SUPABASE_URL", "SUPABASE_ANON_KEY"].every(k => process.env[k]);

if (hasSecrets) {
  execSync("node scripts/build-config.mjs", { cwd: root, stdio: "inherit" });
  fs.copyFileSync(configPath, path.join(dist, "config.js"));
} else if (fs.existsSync(configPath)) {
  fs.copyFileSync(configPath, path.join(dist, "config.js"));
  console.log("Using local config.js for Pages build");
} else {
  console.error("No config.js and no CI secrets — cannot build for deploy");
  process.exit(1);
}

console.log("dist/ ready for GitHub Pages (" + fs.readdirSync(dist).length + " items)");
