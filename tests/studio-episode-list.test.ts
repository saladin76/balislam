import { afterEach, describe, expect, it } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { listScriptEpisodeDirs } from "../src/script/episodes";

/**
 * قائمة حلقات الاستوديو (توجيه ما بعد الأمر 016): مجلد فيه plan.json بلا script.md — مشروع غير مكتمل مثل
 * 000-trailer أو مختبر — يبقى في مكانه ولا يُعرض حلقةً جاهزة، وإلا اختاره الاستوديو فظهرت «الحلقة 000 غير موجودة».
 */
const ownedEpisodeDirs: string[] = [];
afterEach(() => { for (const d of ownedEpisodeDirs.splice(0)) rmSync(d, { recursive:true, force:true }); });

describe("قائمة الحلقات الجاهزة للتشغيل", () => {
  it("دفاتر الزمن: 001 فقط؛ 000-trailer والمختبر 900 محفوظان ومستبعدان", async () => {
    const dir = "channels/dafatir-alzaman/episodes";
    const list = await listScriptEpisodeDirs(dir);
    expect(list).toContain("001-adam-beginning");
    expect(list).not.toContain("000-trailer");
    expect(list).not.toContain("900-library-lab");
    expect(existsSync(`${dir}/000-trailer/plan.json`)).toBe(true);
    expect(existsSync(`${dir}/000-trailer/script.md`)).toBe(false);
  });

  it("كل قناة: لا مجلد بلا سكريبت في القائمة", async () => {
    for (const ch of ["balislam", "dafatir-alzaman", "zubdat-alkutub"]) {
      const dir = `channels/${ch}/episodes`;
      for (const d of await listScriptEpisodeDirs(dir)) expect(existsSync(path.join(dir, d, "script.md")), `${ch}/${d}`).toBe(true);
    }
  });

  it("مجلد مؤقت: الخطة وحدها لا تجعل المجلد حلقة، والسكريبت يجعله", async () => {
    const tmp = mkdtempSync(path.join(os.tmpdir(), "eps-"));
    ownedEpisodeDirs.push(tmp);
    mkdirSync(path.join(tmp, "000-x"));
    writeFileSync(path.join(tmp, "000-x", "plan.json"), "{}");
    mkdirSync(path.join(tmp, "002-y"));
    writeFileSync(path.join(tmp, "002-y", "script.md"), "---\n---\n");
    mkdirSync(path.join(tmp, "notes"));
    expect(await listScriptEpisodeDirs(tmp)).toEqual(["002-y"]);
    expect(await listScriptEpisodeDirs(path.join(tmp, "missing"))).toEqual([]);
  });

  it("مسار /api/episodes في الاستوديو يستعمل القائمة نفسها", () => {
    const api = readFileSync("app/server/api.ts", "utf8");
    expect(api).toContain("listScriptEpisodeDirs(episodesDir)");
  });
});
