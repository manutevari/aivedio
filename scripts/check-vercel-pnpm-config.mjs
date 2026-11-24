import assert from "node:assert/strict";
import fs from "node:fs";

const rootPackage = JSON.parse(fs.readFileSync("package.json", "utf8"));
const apiVercel = JSON.parse(fs.readFileSync("apps/api/vercel.json", "utf8"));
const declared = rootPackage.packageManager;

assert.match(declared ?? "", /^pnpm@\d+\.\d+\.\d+$/, "Root packageManager must pin pnpm");

const installCommand = apiVercel.installCommand ?? "";
const explicitPin = installCommand.match(/(?:corepack\s+prepare\s+)?pnpm@(\d+\.\d+\.\d+)/);
if (explicitPin) {
  assert.equal(explicitPin[1], declared.replace(/^pnpm@/, ""), "Vercel API install pnpm pin must match root packageManager");
}
assert.match(installCommand, /pnpm\s+install/, "Vercel API install command must install the workspace");
assert.doesNotMatch(apiVercel.buildCommand ?? "", /pnpm\s+install/, "Vercel buildCommand must not duplicate dependency installation");

console.log("Vercel API pnpm configuration is consistent with root packageManager.");
