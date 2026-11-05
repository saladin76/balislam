import { afterEach, describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { runWithChannel } from "../src/channel";
import { resolveScriptPath } from "../src/script/episodes";

const tempDirs: string[] = [];
const prevDir = process.env.BAL_CHANNELS_DIR;

const setup = () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "bal-episode-discovery-"));
  tempDirs.push(root);
  process.env.BAL_CHANNELS_DIR = root;
  const episodes = path.join(root, "balislam", "episodes");
  mkdirSync(episodes, { recursive: true });
  return episodes;
};
const scripted = (episodes: string, dir: string) => {
  const full = path.join(episodes, dir);
  mkdirSync(full, { recursive: true });
  writeFileSync(path.join(full, "script.md"), "test");
  return path.join(full, "script.md");
};

afterEach(() => {
  if (prevDir === undefined) delete process.env.BAL_CHANNELS_DIR;
  else process.env.BAL_CHANNELS_DIR = prevDir;
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("اكتشاف الحلقات عند وجود مختبر المحرك", () => {
  it("لا يجعل مختبر plan-only رقم 000 ملتبسًا مع 000-demo", async () => {
    const episodes = setup();
    const lab = path.join(episodes, "000-engine-lab");
    mkdirSync(lab);
    writeFileSync(path.join(lab, "plan.json"), "{}");
    const script = scripted(episodes, "000-demo");
    const found = await runWithChannel("balislam", () => resolveScriptPath("000"));
    expect(found).toBe(script);
    expect(existsSync(path.join(lab, "plan.json"))).toBe(true);
  });

  it("المختبر وحده لا يتحول إلى حلقة نصية", async () => {
    const episodes = setup();
    const lab = path.join(episodes, "000-engine-lab");
    mkdirSync(lab);
    writeFileSync(path.join(lab, "plan.json"), "{}");
    await expect(runWithChannel("balislam", () => resolveScriptPath("000"))).rejects.toThrow("غير موجودة");
  });

  it("حلقتان حقيقيتان بالرقم نفسه تظلان خطأ واضحًا", async () => {
    const episodes = setup();
    scripted(episodes, "000-demo");
    scripted(episodes, "000-another");
    await expect(runWithChannel("balislam", () => resolveScriptPath("000"))).rejects.toThrow("أكثر من مجلد");
  });

});
