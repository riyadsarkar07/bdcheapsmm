const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const source = path.join(root, ".env.example");
const target = path.join(root, ".env.local");

try {
  if (!fs.existsSync(source)) {
    console.log("postinstall: .env.example not found, skipping env bootstrap.");
    process.exit(0);
  }
  if (fs.existsSync(target)) {
    console.log("postinstall: .env.local already exists, skipping.");
    process.exit(0);
  }
  fs.copyFileSync(source, target);
  console.log("postinstall: created .env.local from .env.example (placeholder values).");
} catch (err) {
  console.error("postinstall: failed to bootstrap .env.local", err);
}
