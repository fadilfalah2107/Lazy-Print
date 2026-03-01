#!/usr/bin/env node
// Lazy Print — License Key Generator (CLI)
// Usage: node generate.js <username>
//
// Output: XXXXX-XXXXX-XXXXX-XXXXX

const crypto = require("crypto");

const SECRET = "LP-v1.6-LAZYPRINT-2025-OFFLINE-KEY-XK9Z";

function generate(username) {
  if (!username) {
    console.error("Usage: node generate.js <username>");
    process.exit(1);
  }
  const normalized = username.toLowerCase().trim();
  const hmac = crypto.createHmac("sha256", SECRET);
  hmac.update(normalized);
  const hex = hmac.digest("hex");
  const first20 = hex.substring(0, 20);
  const code = [0, 5, 10, 15]
    .map((i) => first20.substring(i, i + 5).toUpperCase())
    .join("-");

  console.log("");
  console.log("  Username : " + normalized);
  console.log("  Code     : " + code);
  console.log("");
  return code;
}

const username = process.argv[2];
generate(username);
