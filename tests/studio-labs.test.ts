import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { labProblems, listLabDirs, listLabs, type LabMeta } from "../src/channel/labs";
import { listScriptEpisodeDirs, resolveScriptPath } from "../src/script/episodes";
import { runWithChannel } from "../src/channel/index";
import { LIB_SCENES } from "../src/remotion/dafatir/lib/scenes";
import * as lib from "../src/remotion/dafatir/lib/index";

/**
 * «مختبرات الإنتاج» (الأمر 017): المختبر ليس حلقة. لا يدخل قائمة الحلقات ولا أوامر الإنتاج والنشر،
 * والحلقة لا تظهر مختبرًا، و000-trailer ليس مختبرًا، ولكل قناة مختبراتها وحدها.
 */
const CHANNELS = ["balislam", "dafatir-alzaman", "zubdat-alkutub"];
const eps = (ch: string) => `channels/${ch}/episodes`;

describe("مختبرات الإنتاج", () => {
  it("دفاتر الزمن: 900-library-lab مختبر، و000-trailer و001 ليسا مختبرين", async () => {
    expect(await listLabDirs(eps("dafatir-alzaman"))).toEqual(["900-library-lab"]);
  });

  it("لا مجلد مختبرًا وحلقة معًا، في أي قناة", async () => {
    for (const ch of CHANNELS) {
      const labs = await listLabDirs(eps(ch));
      const episodes = await listScriptEpisodeDirs(eps(ch));
      expect(labs.filter((d) => episodes.includes(d)), ch).toEqual([]);
      for (const d of labs) expect(existsSync(path.join(eps(ch), d, "script.md")), `${ch}/${d}`).toBe(false);
    }
  });

  it("المختبر لا يُفتح حلقةً لأوامر الإنتاج والنشر (تتطلب script.md)", async () => {
    await runWithChannel("dafatir-alzaman", async () => {
      await expect(resolveScriptPath("900")).rejects.toThrow();
      await expect(resolveScriptPath("000")).rejects.toThrow();
      expect(await resolveScriptPath("001")).toMatch(/001-adam-beginning\/script\.md$/);
    });
  });

  it("بالإسلام مختبرها مختبر المحرك 900 (الأمر 013)، وزبدة الكتب مختبرها الوحيد 980 (أدوات الحبر)", async () => {
    expect(await listLabDirs(eps("balislam"))).toEqual(["900-engine-lab"]);
    const bal = JSON.parse(readFileSync(`${eps("balislam")}/900-engine-lab/lab.json`, "utf8")) as LabMeta;
    expect(labProblems(bal)).toEqual([]);
    // لا اعتماد مسجل نيابةً عن صاحب القناة
    expect(bal.decisions).toEqual([]);
    expect(Object.values(bal.previews ?? {}).every((v) => v !== "approved")).toBe(true);
    expect(await listLabDirs(eps("zubdat-alkutub"))).toEqual(["980-kit-lab"]); // مختبر أدوات الحبر (الأمر 016)
  });

  it("سجل المختبر سليم، ومعاينته تُقرأ بحالتها، وما انتقل موجود فعلًا في المكتبة", async () => {
    const meta = JSON.parse(readFileSync(`${eps("dafatir-alzaman")}/900-library-lab/lab.json`, "utf8")) as LabMeta;
    expect(labProblems(meta)).toEqual([]);
    const [l] = await listLabs(eps("dafatir-alzaman"));
    expect(l!.previews.map((p) => p.name)).toContain("library.mp4");
    expect(l!.previews.every((p) => ["experimental", "review", "approved", "rejected"].includes(p.status))).toBe(true);
    for (const t of meta.tools.filter((x) => x.promotedTo)) {
      const name = t.promotedTo!;
      expect(Boolean(LIB_SCENES[name] || (lib as Record<string, unknown>)[name]), name).toBe(true);
    }
  });

  it("نجاح الفحوص لا يصنع اعتمادًا: «معتمد» يتطلب قرارًا مسجلًا", () => {
    const base: LabMeta = { title: "t", purpose: "p", status: "approved", tools: [{ name: "x", status: "review" }], checks: [{ name: "c", ok: true }], visualNotes: [], decisions: [], promoted: [], updatedAt: "2026-11-05" };
    expect(labProblems(base)).toContain("status معتمد بلا قرار اعتماد مسجل");
    expect(labProblems({ ...base, status: "review", previews: { "a.mp4": "approved" } })).toContain("معاينة معتمدة بلا قرار مسجل: a.mp4");
    expect(labProblems({ ...base, decisions: [{ at: "2026-11-05", by: "المشرف", decision: "اعتماد", status: "approved" }] })).toEqual([]);
  });

  it("مسار المعاينة في الاستوديو لا يخدم إلا مختبرات القناة المطلوبة", () => {
    const src = readFileSync("app/server/routes/labs.ts", "utf8");
    expect(src).toMatch(/parts\[0\] === "labs"[\s\S]*listLabDirs\(episodesDir\)[\s\S]*dirs\.includes\(parts\[1\]\)/);
  });
});
