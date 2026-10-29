import { mkdtempSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { keyStatus, writeKeys } from "../src/settings/env";

const saved = { ...process.env };
afterEach(() => {
  process.env = { ...saved };
});

describe("إعدادات المفاتيح", () => {
  it("تُكتب في .env بصلاحية 600 وتُخفى القيم السرية", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "bal-env-"));
    process.env.BAL_ENV_FILE = path.join(dir, ".env");
    await writeKeys({ ELEVENLABS_API_KEY: "sk_test_$&abcd1234", ELEVENLABS_VOICE_ID: "voice42" });
    const text = readFileSync(process.env.BAL_ENV_FILE, "utf8");
    expect(text).toContain("ELEVENLABS_API_KEY=sk_test_$&abcd1234");
    expect(statSync(process.env.BAL_ENV_FILE).mode & 0o777).toBe(0o600);
    const st = keyStatus();
    expect(st.ELEVENLABS_API_KEY!.preview).toBe("••••1234");
    expect(JSON.stringify(st)).not.toContain("sk_test");
    expect(st.ELEVENLABS_VOICE_ID!.preview).toBe("voice42");

    // استبدال القيمة وحذفها
    await writeKeys({ ELEVENLABS_API_KEY: "new-key-9999" });
    expect(readFileSync(process.env.BAL_ENV_FILE, "utf8").match(/ELEVENLABS_API_KEY=/g)).toHaveLength(1);
    await writeKeys({ ELEVENLABS_API_KEY: "" });
    expect(keyStatus().ELEVENLABS_API_KEY!.set).toBe(false);
  });
});
