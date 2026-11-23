/**
 * D191 (قرار المالك ٢٢ نوفمبر): الطابور الليلي يرندر المعتمد وحده بلا صوت مدفوع ولا نشر، بذاكرة محروسة ومهمة واحدة؛
 * والمراجعة الأسبوعية من البيانات المحلية وحدها، و«لا بيانات بعد» بلا ملف.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  NIGHTLY_ALLOWED, assertNightlyArgs, cleanSettings, createNightlyScheduler, nightlySummaryMarkdown, planNightly, runNightly,
  type NightDeps, type NightFacts,
} from "../src/studio/nightly";
import { NO_DATA, isoWeek, parseTableData, reviewChannel, weeklyMarkdown } from "../src/studio/weekly";
import { parseFreePct } from "../src/studio/nightlyFacts";

const base: NightFacts = {
  channel: "dafatir-alzaman", channelName: "دفاتر الزمن", episode: "001", title: "خلق آدم",
  scenesTotal: 47, unapproved: 0, recitationPending: 0, assemblyApproved: false, masterApproved: false, publishAllowed: false,
  masterFileFresh: false, shortsSelected: 0, shortsMade: 0,
};
const f = (o: Partial<NightFacts>): NightFacts => ({ ...base, ...o });

describe("الطابور الليلي: المعتمد وحده", () => {
  it("مشاهد لم تُعتمد، أو تلاوة ناقصة، أو تجميع لم يُعتمد: لا رندر، والملخص يقول إنها تنتظر المالك", () => {
    const p = planNightly([f({ unapproved: 44 }), f({ episode: "002", recitationPending: 1 }), f({ episode: "003" })]);
    expect(p.tasks).toEqual([]);
    expect(p.owner.map((x) => x.episode)).toEqual(["001", "002", "003"]);
    expect(p.owner[2]!.text).toContain("التجميع");
  });
  it("التجميع معتمد ولا Master حاليًا: Master وحزمة النشر بأمر الاستوديو نفسه، ومرة واحدة لا كل ليلة", () => {
    expect(planNightly([f({ assemblyApproved: true })]).tasks).toEqual([expect.objectContaining({ kind: "master", args: ["package", "001"] })]);
    const fresh = planNightly([f({ assemblyApproved: true, masterFileFresh: true })]);
    expect(fresh.tasks).toEqual([]);
    expect(fresh.owner[0]!.text).toContain("Master");
  });
  it("الشورتس بعد اعتماد Master وحده، وإذن النشر ينتظر المالك، والمأذون جاهز للنشر اليدوي", () => {
    const p = planNightly([f({ assemblyApproved: true, masterApproved: true, shortsSelected: 8, shortsMade: 0 })]);
    expect(p.tasks).toEqual([expect.objectContaining({ kind: "shorts", args: ["package", "001", "--shorts"] })]);
    expect(p.owner[0]!.text).toContain("إذن النشر");
    expect(planNightly([f({ assemblyApproved: true, masterApproved: true, publishAllowed: true })]).ready).toHaveLength(1);
    expect(planNightly([f({ scenesTotal: 0 })])).toEqual({ tasks: [], owner: [], ready: [] });
  });
  it("لا أمر خارج القائمة: لا صناعة ولا مؤثرات ولا صوت ولا Drive ولا نشر", () => {
    for (const bad of [["make", "001"], ["make", "001", "--generate-voice"], ["sfx", "--missing"], ["package", "001", "--generate-voice"], ["publish-drive", "001"], ["voice", "001"], ["package", "../x"]])
      expect(() => assertNightlyArgs(bad), bad.join(" ")).toThrow();
    expect(NIGHTLY_ALLOWED.map(String)).toEqual(["/^package \\d{3}$/", "/^package \\d{3} --shorts$/"]);
  });
  it("لا مسار صوت مدفوع ولا نشر يصل إليه الطابور (الكود نفسه)", () => {
    const files = ["src/studio/nightly.ts", "src/studio/nightlyFacts.ts", "app/server/nightly.ts", "app/server/routes/nightly.ts"];
    for (const file of files) {
      const code = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
      expect(code, file).not.toMatch(/elevenlabs|ElevenLabs|sentenceGenerate|generateVoice|voice\/generate|driveHandoff|publish-drive|uploadToDrive|requirePublishAllowed|approveFinalMaster|approveAssembly|decideSceneProduction/);
    }
    // التشغيل يمر بالقائمة قبل كل مهمة، والمهمة الوحيدة startJob بوسائطها
    expect(readFileSync("src/studio/nightly.ts", "utf8")).toMatch(/for \(const task of plan\.tasks\) \{\n\s+assertNightlyArgs\(task\.args\);/);
    expect(readFileSync("app/server/nightly.ts", "utf8")).toContain("startJob({ root }, { kind: t.kind === \"master\" ? \"package\" : \"shorts\"");
  });
});

const deps = (o: Partial<NightDeps> = {}): NightDeps & { ran: string[]; slept: number[] } => {
  const ran: string[] = [], slept: number[] = [];
  let t = Date.parse("2026-11-23T02:00:00Z");
  return {
    ran, slept,
    facts: async () => [f({ assemblyApproved: true })],
    freeMemoryPct: async () => 50,
    renderBusy: () => false,
    runTask: async (task) => { ran.push(task.args.join(" ")); return { ok: true, message: "تم" }; },
    sleep: async (ms) => { slept.push(ms); t += ms; },
    now: () => new Date(t),
    ...o,
  };
};

describe("الطابور الليلي: الذاكرة ومهمة واحدة", () => {
  it("الذاكرة حرجة (أقل من ١٥٪) أو لا تُقرأ: ينتظر دقيقتين ثلاث مرات ثم يؤجل، ولا يرندر", async () => {
    for (const pct of [10, null]) {
      const d = deps({ freeMemoryPct: async () => pct });
      const r = await runNightly(d);
      expect(d.ran).toEqual([]);
      expect(d.slept).toEqual([120_000, 120_000, 120_000]);
      expect(r.outcomes[0]).toEqual(expect.objectContaining({ status: "skipped" }));
      expect(r.outcomes[0]!.message).toContain("الذاكرة حرجة");
    }
  });
  it("الاستوديو يرندر شيئًا آخر: لا يبدأ فوقه، وينتظر ثم يؤجل", async () => {
    const d = deps({ renderBusy: () => true });
    const r = await runNightly(d);
    expect(d.ran).toEqual([]);
    expect(r.outcomes[0]!.status).toBe("skipped");
    expect(d.slept.every((x) => x === 60_000)).toBe(true);
  });
  it("تشغيل واحد في كل مرة: الاستدعاء الثاني أثناء الأول يعيد التشغيل نفسه", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    const d = deps({ runTask: async (task) => { await gate; d.ran.push(task.args.join(" ")); return { ok: true, message: "تم" }; } });
    const a = runNightly(d), b = runNightly(d);
    expect(b).toBe(a);
    release();
    await a;
    expect(d.ran).toEqual(["package 001"]);
  });
  it("الملخص الصباحي بالترتيب: ما تم، وما تعثر، وما ينتظرك، وما هو جاهز", async () => {
    const r = await runNightly(deps({ facts: async () => [f({ assemblyApproved: true }), f({ episode: "002", unapproved: 3 })] }));
    const md = nightlySummaryMarkdown(r);
    const order = ["## ما تم", "## ما تعثر", "## ينتظرك", "## جاهز للنشر اليدوي"].map((h) => md.indexOf(h));
    expect(order.every((x, i) => x > 0 && (i === 0 || x > order[i - 1]!))).toBe(true);
    expect(md).toContain("لا صوت مدفوع ولا نشر");
    expect(md).toContain("٣ مشهد ينتظر اعتمادك");
  });
});

describe("الجدولة: مرة في اليوم عند الساعة المضبوطة", () => {
  it("تبدأ عند الساعة، ولا تعيد في اليوم نفسه، ولا تعمل مطفأة أو في ساعة أخرى", async () => {
    let day: string | null = null;
    const run = vi.fn(async () => undefined);
    let now = new Date(2026, 10, 23, 2, 5);
    let settings = cleanSettings({ enabled: true, hour: 2 });
    const s = createNightlyScheduler({ settings: async () => settings, lastDay: async () => day, markDay: async (d) => { day = d; }, run, now: () => now });
    expect(await s.tick()).toBe(true);
    expect(await s.tick()).toBe(false);
    now = new Date(2026, 10, 24, 3, 0);
    expect(await s.tick()).toBe(false);
    settings = cleanSettings({ enabled: false, hour: 3 });
    expect(await s.tick()).toBe(false);
    expect(run).toHaveBeenCalledTimes(1);
    expect(cleanSettings({ hour: 99 }).hour).toBe(2);
  });
  it("قراءة الذاكرة من memory_pressure", () => {
    expect(parseFreePct("System-wide memory free percentage: 43%")).toBe(43);
    expect(parseFreePct("garbage")).toBeNull();
  });
});

describe("المراجعة الأسبوعية", () => {
  it("«جدول البيانات» من YouTube Studio بالإنجليزية والعربية", () => {
    const en = parseTableData("Content,Video title,Impressions,Impressions click-through rate (%),Views,Average view duration,Average percentage viewed (%)\nTotal,,12000,5.4,900,0:04:10,38.2\n");
    expect(en).toEqual({ impressions: 12000, ctr: 5.4, views: 900, avgViewSec: 250, avgViewPct: 38.2 });
    const ar = parseTableData("المحتوى,مرات الظهور,نسبة النقر إلى الظهور (%),المشاهدات,متوسط مدة المشاهدة\nالإجمالي,٢٠٠٠,٣٫٥,١٠٠,٢:٠٠\n");
    expect(ar).toEqual({ impressions: 2000, ctr: 3.5, views: 100, avgViewSec: 120 });
    expect(() => parseTableData("a,b\n1,2\n")).toThrow();
  });
  it("بلا بيانات: «لا بيانات بعد» وتحسين واحد هو رفع التصدير، ولا رقم مخترع", () => {
    const r = reviewChannel({ id: "balislam", name: "بالإسلام", episodes: [] });
    expect(r).toEqual(expect.objectContaining({ ctr: null, avgViewSec: null, biggest: null, hasData: false }));
    const md = weeklyMarkdown("2026-W48", [r]);
    expect(md.match(new RegExp(NO_DATA, "g"))!.length).toBe(3);
    expect(md.match(/\*\*تحسين هذا الأسبوع:\*\*/g)!.length).toBe(1);
  });
  it("نسبة النقر موزونة بمرات الظهور، وتحسين واحد بالأولوية: البداية ثم الغلاف ثم أكبر تسرب ثم الإيقاع", () => {
    const a = (ctr: number, impressions: number) => ({ version: 1 as const, channel: "x", episode: "001", importedAt: "", ctr, impressions });
    const lowCtr = reviewChannel({ id: "x", name: "x", episodes: [{ episode: "001", title: "t", analytics: a(2, 1000) }, { episode: "002", title: "t", analytics: a(5, 3000) }] });
    expect(lowCtr.ctr).toBeCloseTo(4.25, 6);
    const ret = (early: boolean) => ({ duration: 600, at30: early ? 60 : 90, start: 100, average: 40, earlyFix: early,
      early: { from: 3, to: 8, drop: early ? 30 : 5, estimated: false }, biggest: { from: 200, to: 212, drop: 9, sceneId: "c1-s20", estimated: false } });
    const hook = reviewChannel({ id: "x", name: "x", episodes: [{ episode: "001", title: "t", analytics: a(2, 10), retention: ret(true) }] });
    expect(hook.improvement).toMatch(/^البداية/);
    expect(reviewChannel({ id: "x", name: "x", episodes: [{ episode: "001", title: "t", analytics: a(2, 10), retention: ret(false) }] }).improvement).toMatch(/^الغلاف/);
    const drop = reviewChannel({ id: "x", name: "x", episodes: [{ episode: "001", title: "t", analytics: a(6, 10), retention: ret(false) }] });
    expect(drop.improvement).toMatch(/^أكبر تسرب/);
    expect(drop.biggest).toEqual(expect.objectContaining({ sceneId: "c1-s20", early: false }));
    expect(isoWeek(new Date(2026, 10, 23))).toBe("2026-W48");
  });
});
