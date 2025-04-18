#!/usr/bin/env node
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { createRequire } from "module";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

import("../build/index.js").catch(err => {
  console.error("Failed to start EntraAware:", err);
  process.exit(1);
});
