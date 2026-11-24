import assert from "node:assert/strict";
import fs from "node:fs";

const rootPackage = JSON.parse(fs.readFileSync("package.json", "utf8"));
const apiVercel = JSON.parse(fs.readFileSync("apps/api/vercel.json", "utf8"));
const ci = fs.readFileSync(".github/workflows/ci.yml", "utf8");
const declared = rootPackage.packageManager;

assert.equal(declared, "pnpm@10.34.9", "Root packageManager must use the tested pnpm 10.34.9 pin");

const installCommand = apiVercel.installCommand ?? "";
assert.match(installCommand, /pnpm\s+install/, "Vercel API install command must install the workspace");
assert.doesNotMatch(installCommand, /pnpm@\d+\.\d+\.\d+/, "Vercel API must not override the root pnpm version");
assert.doesNotMatch(apiVercel.buildCommand ?? "", /pnpm\s+install/, "Vercel buildCommand must not duplicate dependency installation");
assert.match(ci, /uses:\s*pnpm\/action-setup@v4\s*(?:\n\s*with:\s*\n\s*version:\s*10\.34\.9)?/, "CI pnpm setup must rely on packageManager or pin the same version");
assert.doesNotMatch(ci, /version:\s*10\.26\.1/, "CI must not retain the known failing pnpm 10.26.1 pin");

console.log("Vercel API and CI pnpm configuration regression checks passed.");
