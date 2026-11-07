import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { keyStatus, writeKeys } from "../src/settings/env";

const original = { ...process.env };
const dirs: string[] = [];
const setup = () => {
  const dir = mkdtempSync(path.join(tmpdir(), "studio-core-keys-"));
  dirs.push(dir);
  const file = path.join(dir, ".env");
  process.env.BAL_ENV_FILE = file;
  writeFileSync(file, "# Keep this comment\nQF_ENV=prelive\n", { mode: 0o600 });
  return { dir, file };
};
afterEach(() => {
  process.env = { ...original };
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe("atomic environment settings", () => {
  it("serializes concurrent updates and retains unrelated settings and comments", async () => {
    const { dir, file } = setup();
    await Promise.all([
      writeKeys({ ELEVENLABS_API_KEY: "test-key-7777" }),
      writeKeys({ ELEVENLABS_VOICE_ID: "voice-1234" }),
      writeKeys({ ELEVENLABS_MODEL_ID: "model-2" }),
    ]);
    const saved = readFileSync(file, "utf8");
    expect(saved).toContain("# Keep this comment");
    expect(saved).toContain("QF_ENV=prelive");
    expect(saved).toContain("ELEVENLABS_API_KEY=test-key-7777");
    expect(saved).toContain("ELEVENLABS_VOICE_ID=voice-1234");
    expect(saved).toContain("ELEVENLABS_MODEL_ID=model-2");
    expect(statSync(file).mode & 0o777).toBe(0o600);
    expect(readdirSync(dir)).toEqual([".env"]);
    expect(keyStatus().ELEVENLABS_API_KEY?.preview).toBe("••••7777");
  });

  it("rejects malformed input without saving secrets or changing process env", async () => {
    const { file } = setup();
    await writeKeys({ ELEVENLABS_VOICE_ID: "original" });
    const before = readFileSync(file, "utf8");
    await expect(writeKeys({ ELEVENLABS_API_KEY: "malformed\nINJECTED=1" })).rejects.toThrow("غير صالحة");
    await expect(writeKeys({ UNKNOWN_KEY: "x" } as never)).rejects.toThrow("غير معروف");
    await expect(writeKeys(null as never)).rejects.toThrow("غير صالح");
    expect(readFileSync(file, "utf8")).toBe(before);
    expect(process.env.ELEVENLABS_API_KEY).toBe(original.ELEVENLABS_API_KEY);
    expect(process.env.ELEVENLABS_VOICE_ID).toBe("original");
    // Failed updates must not poison the serializer for later valid writes.
    await writeKeys({ ELEVENLABS_VOICE_ID: "recovered" });
    expect(readFileSync(file, "utf8")).toContain("ELEVENLABS_VOICE_ID=recovered");
  });
});
