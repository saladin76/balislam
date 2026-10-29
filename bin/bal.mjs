#!/usr/bin/env node
// نقطة دخول أمر bal: يشغّل الكود مباشرة بـ TypeScript عبر tsx.
import { register } from "tsx/esm/api";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

// المفاتيح السرية تُقرأ من ملف .env في جذر المشروع (لا يُرفع إلى Git).
const envFile = fileURLToPath(new URL("../.env", import.meta.url));
if (existsSync(envFile)) process.loadEnvFile(envFile);

register();
await import("../src/cli/index.ts");
