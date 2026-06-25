/**
 * Copies the web app into www/ for Capacitor Android builds.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const www = path.join(root, "www");

const FILES = [
  "index.html",
  "employee.html",
  "admin.html",
  "setup.html",
  "shared.js",
  "styles.css",
  "config.production.js",
  "config.auth.js"
];

function rmDir(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

rmDir(www);
fs.mkdirSync(www, { recursive: true });

for (const file of FILES) {
  const src = path.join(root, file);
  if (!fs.existsSync(src)) {
    console.error("Missing file for Android build:", file);
    process.exit(1);
  }
  fs.copyFileSync(src, path.join(www, file));
}

console.log("www/ ready for Capacitor (" + fs.readdirSync(www).length + " files)");
