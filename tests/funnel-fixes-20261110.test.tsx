/**
 * End-to-end funnel QA fixes (10 Nov 2026): M1 tone before preparation, M2 a refused «اعتمد التجهيز» stays
 * visible, M3 failures expire, and shared scene names on the server.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { currentPrepareView } from "../src/studio/prepareAll";
import { scenesWithoutTone } from "../src/studio/preparation";
import { nameSceneIds, planOrder, sceneNames } from "../src/i18n/sceneNames";
import type { Plan } from "../src/plan/types";
import { panelSource } from "./helpers/panelSource";

const src = (f: string) => panelSource(f);
const order = ["c1-s1", "c1-s2", "c1-s3", "c2-s1"];

describe("scene names on the server (shared formatter)", () => {
  it("names known ids as the Studio numbers them, seams too, and leaves unknown ids", () => {
    expect(nameSceneIds("تعذّر c1-s3: خطأ", order)).toBe("تعذّر المشهد ٣: خطأ");
    expect(nameSceneIds("الوصلة c1-s2>c1-s3", order)).toBe("الوصلة المشهد ٢ ← ٣");
    expect(nameSceneIds("c9-s9 مجهول", order)).toBe("c9-s9 مجهول");
    expect(sceneNames(order, ["c2-s1", "c1-s1"])).toBe("المشهد ٤، المشهد ١");
  });
  it("the app re-exports the same implementation", () => {
    expect(src("app/src/workspace/sceneNames.ts")).toContain('from "../../../src/i18n/sceneNames"');
  });
});

describe("M1: no tone for the episode is said before preparing", () => {
  const plan = (tone?: string) => ({ tone, chapters: [{ number: 1, title: "x", scenes: [
    { id: "c1-s1", template: "big-question", narration: "نص", props: {}, sfx: [] },
    { id: "c1-s2", template: "verse-card", narration: "", props: {}, sfx: [] },
    { id: "c1-s3", template: "big-question", narration: "نص آخر", tone: "calm", props: {}, sfx: [] },
  ] }] }) as unknown as Plan;
  it("lists narrated scenes without any tone; the episode or channel tone covers them", () => {
    expect(scenesWithoutTone(plan())).toEqual(["c1-s1"]);
    expect(scenesWithoutTone(plan("calm"))).toEqual([]);
    expect(scenesWithoutTone(plan(), "calm")).toEqual([]);
    expect(planOrder(plan())).toEqual(["c1-s1", "c1-s2", "c1-s3"]);
  });
  it("step ١ offers «لا نبرة للحلقة — اخترها هنا»; a finished run with errors offers «استأنف التجهيز»", () => {
    const prep = src("app/src/workspace/PrepareAll.tsx");
    expect(prep).toContain("لا نبرة للحلقة");
    expect(prep).toContain("اخترها هنا");
    expect(prep).toMatch(/finishedWithErrors = Boolean\(job && job\.status === "done"/);
    expect(prep).toContain('job.status === "error" || finishedWithErrors');
    expect(src("app/src/shell/EpisodeSpine.tsx")).toContain("prep?.toneMissing?.length");
    expect(src("src/voice/generate.ts")).toContain("sceneNames(planOrder(plan), report.missingTones, 12)");
  });
});

describe("M2: a refused «اعتمد التجهيز» stays visible; saving the script refreshes step ١", () => {
  it("the ledger re-read after a refusal does not clear the error", () => {
    const spine = src("app/src/shell/EpisodeSpine.tsx");
    expect(spine).toContain("if (!keepErr.current) setErr(\"\")");
    expect(spine).toMatch(/setErr\(\(e as Error\)\.message\);\s*keepErr\.current = true;/);
    expect(src("app/src/App.tsx")).toMatch(/setPlanState\("saved"\);[\s\S]{0,300}setHomeKey\(\(k\) => k \+ 1\);\s*api\.episode\(epId\)/);
  });
});

describe("M3: failures expire when the scene succeeds or its inputs change", () => {
  const scenes = [
    { id: "c1-s1", status: "queued", sourceSha256: "a", draft: "ready" },
    { id: "c1-s2", status: "queued", sourceSha256: "b2" },
    { id: "c1-s3", status: "queued", sourceSha256: "c" },
    { id: "c1-s4", status: "approved", sourceSha256: "d" },
  ];
  it("drops stale «تعذّر» entries and names scenes in the messages", () => {
    const job = {
      failed: [
        { id: "c1-s1", error: "x", sourceSha256: "a" }, // drafted since
        { id: "c1-s2", error: "x", sourceSha256: "b1" }, // inputs changed
        { id: "c1-s3", error: "تعذّر c1-s3", sourceSha256: "c" }, // still failing
        { id: "c1-s4", error: "x", sourceSha256: "d" }, // approved since
      ],
      skipped: [{ id: "c1-s2", reason: "failed-before" as const, error: "x", sourceSha256: "b1" },
        { id: "c1-s3", reason: "voice" as const }],
      voice: { error: "حدّد نبرة c1-s2" },
    };
    const v = currentPrepareView(job, scenes);
    expect(v.failed).toEqual([{ id: "c1-s3", error: "تعذّر المشهد ٣", sourceSha256: "c" }]);
    expect(v.skipped).toEqual([{ id: "c1-s3", reason: "voice" }]);
    expect(v.voice.error).toBe("حدّد نبرة المشهد ٢");
  });
  it("the owner's «استأنف التجهيز» retries previous failures; an automatic start does not", () => {
    const api = src("app/server/api.ts");
    expect(api).toContain("opts.retryFailed ? [] : prepareJob(key)?.failed ?? []");
    expect(api).toContain("await startPrepare({ retryFailed: true })");
  });
});

describe("M7 / owner decision 10 Nov: citations never block; the Master job reads true", () => {
  it("no citation gate in Master, the legacy publish stage or the script signoff", () => {
    for (const f of ["src/render/episode.ts"]) {
      const code = src(f);
      expect(code, f).not.toMatch(/reviewSummary\(/);
      expect(code, f).not.toContain("توثيق الاستشهادات غير مكتمل");
    }
  });
  it("step ١ and step ٣ show the count as information only", async () => {
    const { citationLine, citationNotice } = await import("../app/src/shell/citationNotice");
    const items = [{ kind: "ayah", status: "pending" }, { kind: "hadith", status: "verified" }];
    expect(citationNotice(items)).toContain("لا تمنع شيئًا");
    expect(citationLine(items)).toBe("التوثيق: ١ من ٢ موثّق — للعلم فقط، لا يمنع النسخة النهائية ولا النشر.");
    expect(src("app/src/workspace/MakeMaster.tsx")).toContain("citationLine(r.items)");
  });
  it("the CLI's own refusal is «رفضه فحص قبل الاكتمال», not a browser crash", async () => {
    const { classifyFailure, FAILURE_LABEL } = await import("../src/render/pool");
    const f = classifyFailure({ code: 1, signal: null, browserLost: true, peakMB: 900,
      log: ["   الحلقة: 0%", "خطأ: لا يمكن رندر نسخة نهائية بلا تعليق صوتي مطابق في: المشهد ٣"] });
    expect(f.kind).toBe("refused");
    expect(FAILURE_LABEL[f.kind]).toBe("رفضه فحص قبل الاكتمال");
    expect(f.message).toContain("بلا تعليق صوتي");
    expect(classifyFailure({ code: 1, signal: null, browserLost: true, peakMB: 900, log: ["Error: boom"] }).kind).toBe("browser-crash");
  });
  it("frame progress moves the 4K make past 60%; machine lines and English memory warnings stay out of the log", async () => {
    const { progressFrom, ownerLogLine, MEMORY_NOTE } = await import("../app/server/jobQueue");
    const job = { kind: "make", pct: 60 } as Parameters<typeof progressFrom>[0];
    progressFrom(job, "   FRAMES الحلقة 50");
    expect(job.pct).toBe(79);
    const log: string[] = [];
    expect(ownerLogLine("   FRAMES الحلقة 51", log)).toBeNull();
    expect(ownerLogLine("Your machine has 4 GB of memory; lowering concurrency", log)).toBe(MEMORY_NOTE);
    expect(ownerLogLine("Your machine has 4 GB of memory; lowering concurrency", [MEMORY_NOTE])).toBeNull();
    expect(ownerLogLine("٥/٥ الرندر والتغليف…", log)).toBe("٥/٥ الرندر والتغليف…");
    expect(src("app/src/workspace/MakeMaster.tsx")).toContain("api.cancelJob(job.id)");
  });
});

describe("owner decision 10 Nov: «احفظ هذا النطق للقناة» is OFF by default", () => {
  it("a word chip opens the fix with save: false", () => {
    const panel = src("app/src/workspace/SentencesPanel.tsx");
    expect(panel).not.toMatch(/save: true, wide: false/);
    expect(panel).toContain("say: w.say, save: false, wide: false");
  });
});

describe("M6: heard seams persist on the server; «الوصلة سليمة» needs the seam played or «سمعتها»", () => {
  it("the page reads and writes the server state, and gates the button on the played window", () => {
    const panel = src("app/src/workspace/SceneProductionPanel.tsx");
    expect(panel).toContain("api.seamChecks(episodeId, channelId)");
    expect(panel).toContain("api.recordSeam(episodeId, channelId");
    expect(panel).toContain("const canMark = Boolean(heard[seam]) || playedHere >= SEAM_WINDOW - 0.5;");
    expect(panel).not.toContain("onHeard={(seam, v) => setSeams(");
    expect(src(".gitignore")).toContain("seam-checks.local.json");
  });
});

describe("M8: after a decision the screen takes the response's read model and the publish page refreshes", () => {
  it("no second read after a decision; the publish page is told to reload (Drive status at once)", () => {
    const panel = src("app/src/workspace/SceneProductionPanel.tsx");
    expect(panel).toMatch(/const fresh = await api\.decideScene\(/);
    expect(panel).toContain('new CustomEvent("studio-workflow-updated", { detail: { episodeId } })');
    expect(src("app/src/tabs/PublishTab.tsx")).toContain('window.addEventListener("studio-workflow-updated", refresh)');
  });
});

describe("minors: owner messages from the server read in the Studio's words", () => {
  it("scene ids named, stand-alone numbers in Arabic digits, identifiers untouched", async () => {
    const { ownerText } = await import("../src/i18n/sceneNames");
    expect(ownerText("خطأ في السطر 14 من c1-s2", order)).toBe("خطأ في السطر ١٤ من المشهد ٢");
    expect(ownerText("ذروتها 14.1 م.ب", order)).toBe("ذروتها ١٤٫١ م.ب");
    expect(ownerText("شاهد 1× ثم 0:00", order)).toBe("شاهد ١× ثم ٠:٠٠");
    expect(ownerText("رندر 4K بترميز H.264 للملف manual-1-1-abc.mp3", order)).toBe("رندر 4K بترميز H.264 للملف manual-1-1-abc.mp3");
    expect(ownerText("Script changed before review.", order)).toBe("Script changed before review.");
    expect(src("app/server/api.ts")).toContain("message = ownerText(message, planOrder(");
  });
  it("Arabic counting with Arabic digits", async () => {
    const { AYAT, SCENES, arabicCountAr, everyWeekday } = await import("../src/i18n/count");
    expect(arabicCountAr(114, SCENES)).toBe("١١٤ مشهدًا");
    expect(arabicCountAr(4, AYAT)).toBe("٤ آيات");
    expect(arabicCountAr(1, SCENES)).toBe("مشهد واحد");
    expect(everyWeekday("السبت")).toBe("كل سبت");
  });
});

describe("minors: attribution, Drive files bound to the Master, نشر.txt sources, channel library in the editor", () => {
  it("the owner's own recording is not «بإذن مكتوب»", async () => {
    const { isOwnRecordingEvidence } = await import("../src/plan/media");
    expect(isOwnRecordingEvidence("تسجيلي بصوتي في البيت، أملك حقوقه كاملة")).toBe(true);
    expect(isOwnRecordingEvidence("إذن مكتوب من القارئ بتاريخ ٣ نوفمبر")).toBe(false);
    const { ar } = await import("../src/i18n/packs");
    expect(ar.strings.descRecitationOwn).toBe("التلاوة: بصوت {name}");
    expect(src("src/package/youtube.ts")).toContain("rec.own ? L.strings.descRecitationOwn : L.strings.descRecitation");
  });
  it("Drive sends only the subtitles/thumbnails made with the approved Master; نشر.txt carries «المصادر»", () => {
    expect(src("src/package/package.ts")).toContain("await writeHandoffSet(dir, id, files)");
    const drive = src("src/package/driveHandoff.ts");
    expect(drive).toContain("set.masterSha256 === facts.masterSha256");
    expect(drive).toContain("sourcesBlock(plan, await readFile(facts.scriptPath");
  });
  it("the scene editor offers only the channel's own templates", () => {
    expect(src("app/src/tabs/EpisodeTab.tsx")).toContain("!templateExclusion(libraryRulesOf(channel), t.id)");
  });
});

describe("collectHandoffSources with a handoff set", () => {
  it("drops a thumbnail/subtitle not made with this Master (or changed since)", async () => {
    const { mkdtempSync, writeFileSync, rmSync } = await import("node:fs");
    const os = await import("node:os");
    const { createHash } = await import("node:crypto");
    const dir = mkdtempSync(path.join(os.tmpdir(), "handoff-set-"));
    try {
      const h = (s: string) => createHash("sha256").update(s).digest("hex");
      writeFileSync(path.join(dir, "001-episode.mp4"), "MASTER");
      writeFileSync(path.join(dir, "001-thumbnail-1.png"), "T1");
      writeFileSync(path.join(dir, "001-thumbnail-2.png"), "T2-new-from-failed-make");
      writeFileSync(path.join(dir, "001-episode.ar.srt"), "SRT");
      writeFileSync(path.join(dir, "001-handoff-set.json"), JSON.stringify({ version: 1, masterSha256: h("MASTER"),
        files: { "001-thumbnail-1.png": h("T1"), "001-thumbnail-2.png": h("T2-old"), "001-episode.ar.srt": h("SRT") } }));
      const { collectHandoffSources } = await import("../src/package/driveHandoff");
      const got = await collectHandoffSources({ masterFile: path.join(dir, "001-episode.mp4"), masterSha256: h("MASTER") });
      expect(got.map((x) => x.name).sort()).toEqual(["001-episode.ar.srt", "001-episode.mp4", "001-thumbnail-1.png"]);
      const other = await collectHandoffSources({ masterFile: path.join(dir, "001-episode.mp4"), masterSha256: h("ANOTHER") });
      expect(other.map((x) => x.name)).toEqual(["001-episode.mp4"]);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
