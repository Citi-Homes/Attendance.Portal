// Copy this file to config.js and set your own session secret + password hashes.
// Never commit config.js — it is listed in .gitignore.
//
// Generate a session secret:  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
// Hash a password:            node -e "console.log(require('crypto').createHash('sha256').update('YOUR_PASSWORD').digest('hex'))"
// Admin mode: omit or use "full" for edit/delete access; use "readonly" for view-only admin.

window.ATT_CONFIG = {
  sessionSecret: "REPLACE_WITH_RANDOM_64_CHAR_HEX",

  // Live app URL (GitHub Pages) — use this URL; data is in Supabase only
  appUrl: "https://citi-homes.github.io/Attendance.Portal/",

  // Supabase — all attendance records stored here (not on local devices)
  supabaseUrl: "https://YOUR_PROJECT.supabase.co",
  supabaseAnonKey: "YOUR_SUPABASE_ANON_KEY",

  admins: [
    {
      user: "admin@citihomes.ae",
      passHash: "REPLACE_WITH_SHA256_OF_ADMIN_PASSWORD"
    },
    {
      user: "umer@citihomes.ae",
      passHash: "REPLACE_WITH_SHA256_OF_UMER_ADMIN_PASSWORD"
    },
    {
      user: "test@citihomes.ae",
      passHash: "REPLACE_WITH_SHA256_OF_TEST_READONLY_PASSWORD",
      mode: "readonly"
    }
  ],

  employeePassHashes: {
    CH6: "REPLACE_WITH_SHA256_HASH",
    CH3: "REPLACE_WITH_SHA256_HASH",
    CH5: "REPLACE_WITH_SHA256_HASH",
    CH2: "REPLACE_WITH_SHA256_HASH",
    CH4: "REPLACE_WITH_SHA256_HASH",
    CH7: "REPLACE_WITH_SHA256_HASH"
  }
};
