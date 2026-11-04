#!/usr/bin/env node
/**
 * Read-only SFX inventory audit. Does not play, generate, delete or modify audio.
 * Usage: node scripts/audit-sfx.mjs
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const catalog = readFileSync(join(root, "brand/sfx.ts"), "utf8");
const ids = [...catalog.matchAll(/\bid:\s*"([^"]+)"/g)].map((m) => m[1]);
const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i);
const sounds = join(root, "assets/sfx");
const inventory = existsSync(sounds) ? readdirSync(sounds).filter((name) => name.endsWith(".mp3")) : [];
const missing = ids.filter((id) => !existsSync(join(sounds, `${id}.mp3`)));
const unknown = inventory.filter((file) => !ids.includes(file.slice(0, -4)));
const empty = inventory.filter((file) => statSync(join(sounds, file)).size === 0);
const decodeErrors = [];
let probed = 0;
try {
  execFileSync("ffprobe", ["-version"], { stdio: "ignore" });
  for (const name of inventory) {
    try {
      const result = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", join(sounds, name)], { encoding: "utf8" }).trim();
      if (!(Number(result) > 0)) decodeErrors.push(name);
      else probed++;
    } catch {
      decodeErrors.push(name);
    }
  }
} catch {
  console.log("ffprobe unavailable — audio decoding not verified");
}
const lines = [
  `Catalog IDs: ${ids.length}`,
  `Audio files: ${inventory.length}`,
  `Durations verified: ${probed}`,
  `Missing IDs: ${missing.length ? missing.join(", ") : "none"}`,
  `Uncatalogued audio: ${unknown.length ? unknown.join(", ") : "none"}`,
  `Duplicate IDs: ${duplicates.length ? duplicates.join(", ") : "none"}`,
  `Empty files: ${empty.length ? empty.join(", ") : "none"}`,
  `Unreadable audio: ${decodeErrors.length ? decodeErrors.join(", ") : "none"}`,
  "Rights/licenses: NOT VERIFIED (must be reviewed manually before publication)",
];
console.log(lines.join("\n"));
if (missing.length || unknown.length || duplicates.length || empty.length || decodeErrors.length) process.exitCode = 1;
