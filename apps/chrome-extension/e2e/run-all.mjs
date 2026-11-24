import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testsDir = path.join(__dirname, "tests");
const files = fs.readdirSync(testsDir).filter((f) => f.endsWith(".mjs"));

let failed = false;
for (const file of files) {
  console.log(`\n=== ${file} ===`);
  try {
    await import(path.join(testsDir, file));
    if (process.exitCode === 1) {
      failed = true;
      process.exitCode = undefined;
    }
  } catch (error) {
    console.log(`FAIL - ${file} threw: ${error.message}`);
    failed = true;
  }
}
process.exitCode = failed ? 1 : 0;
