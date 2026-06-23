// Copy this file to config.js and set your own session secret + password hashes.
// Never commit config.js — it is listed in .gitignore.
//
// Generate a session secret:  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
// Hash a password:            node -e "console.log(require('crypto').createHash('sha256').update('YOUR_PASSWORD').digest('hex'))"

window.ATT_CONFIG = {
  sessionSecret: "REPLACE_WITH_RANDOM_64_CHAR_HEX",

  admin: {
    user: "admin",
    passHash: "REPLACE_WITH_SHA256_OF_ADMIN_PASSWORD"
  },

  employeePassHashes: {
    CH6: "REPLACE_WITH_SHA256_HASH",
    CH3: "REPLACE_WITH_SHA256_HASH",
    CH5: "REPLACE_WITH_SHA256_HASH",
    CH2: "REPLACE_WITH_SHA256_HASH",
    CH4: "REPLACE_WITH_SHA256_HASH",
    CH7: "REPLACE_WITH_SHA256_HASH"
  }
};
