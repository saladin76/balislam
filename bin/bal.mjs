#!/usr/bin/env node
// نقطة دخول أمر bal: يشغّل الكود مباشرة بـ TypeScript عبر tsx.
import { register } from "tsx/esm/api";

register();
await import("../src/cli/index.ts");
