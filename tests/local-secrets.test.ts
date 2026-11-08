import { mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ensureLocalSecrets, LOCAL_SECRETS } from "../src/settings/env";

describe("أسرار الاعتماد المحلية", () => {
  it("تُولَّد مرة واحدة في .env ولا تتغير بعدها، ولا تمس المفاتيح الأخرى", async () => {
    const file = path.join(mkdtempSync(path.join(os.tmpdir(), "env-")), ".env");
    writeFileSync(file, "ELEVENLABS_VOICE_ID=abc\n");
    const saved = Object.fromEntries(LOCAL_SECRETS.map((k) => [k, process.env[k]]));
    process.env.BAL_ENV_FILE = file;
    for (const k of LOCAL_SECRETS) delete process.env[k];
    try {
      expect(await ensureLocalSecrets()).toEqual([...LOCAL_SECRETS]);
      const first = readFileSync(file, "utf8");
      expect(first).toContain("ELEVENLABS_VOICE_ID=abc");
      for (const k of LOCAL_SECRETS) expect(first).toMatch(new RegExp(`^${k}=[a-f0-9]{64}$`, "m"));
      expect(statSync(file).mode & 0o077).toBe(0);
      for (const k of LOCAL_SECRETS) delete process.env[k];
      expect(await ensureLocalSecrets()).toEqual([]);
      expect(readFileSync(file, "utf8")).toBe(first);
    } finally {
      delete process.env.BAL_ENV_FILE;
      for (const [k, v] of Object.entries(saved)) if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
  });
});
