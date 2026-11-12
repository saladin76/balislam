/**
 * QA 12 Nov 2026 (three channel reports): owner-facing text and UI behaviour.
 * - one Arabic counting formatter (Arabic-Indic digits, dual, plural) used by the Studio;
 * - no Western digits or raw scene ids in rendered owner text (`ownerTextProblems`, the same rule as ui-audit «owner-text»);
 * - step ٣ «الوصلات» before an assembly is an explanation, never the old single-scene card;
 * - «قسّم…» chooses the split point and confirms; the shorts picker is reachable from step ٢;
 * - a silent recitation is refused in Arabic; English refusals lead in Arabic; the notes inbox says the real reason;
 * - the scene on screen stays in the address bar; a new episode gets Arabic validation and a 409, never a 500.
 */
import React from "react";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AYAT, CORRECTIONS, ERRORS, SCENES, SENTENCES, WARNINGS, WORDS, countAr } from "../src/i18n/count";
import { markupProblems, ownerTextProblems } from "../src/i18n/ownerTextAudit";
import { SceneProductionPanel } from "../app/src/workspace/SceneProductionPanel";
import { SplitChooser, caretWordIndex } from "../app/src/workspace/SplitChooser";
import { ScriptFixList } from "../app/src/shell/ScriptFixList";
import { ownerCheck, type CheckResult, type SceneProductionRead } from "../app/src/api";
import { ownerMessage, UNTRANSLATED } from "../app/src/serverMessages";
import { noteInboxLine } from "../app/src/workspace/SceneProductionPanel";
import { ownerPreviewText, isTechnicalNote } from "../app/src/ui/format";
import { parseStudioHash, studioHash, bootPlace } from "../app/src/shell/route";
import { NETWORK_FAILURE } from "../src/studio/notesSync";
import { RECITATION_SILENT, polishRecitation } from "../src/quran/recitationPolish";
import type { Plan } from "../src/plan/types";
import { channelInfo, type ChannelConfig } from "../src/channel/types";

const root = path.join(__dirname, "..");
const src = (rel: string) => readFileSync(path.join(root, rel), "utf8");
const EPISODES = { balislam: "001-know-the-truth", "zubdat-alkutub": "001-awwal-marra-osalli", "dafatir-alzaman": "001-adam-beginning" } as const;
type Ch = keyof typeof EPISODES;
const CHANNELS = Object.keys(EPISODES) as Ch[];
const planOf = (ch: Ch) => JSON.parse(src(`channels/${ch}/episodes/${EPISODES[ch]}/plan.json`)) as Plan;
const channelOf = (ch: Ch) => channelInfo(JSON.parse(src(`channels/${ch}/channel.json`)) as ChannelConfig);

describe("one Arabic counting formatter", () => {
  it("Arabic-Indic digits with one, dual, few, many and hundred forms", () => {
    expect(countAr(1, ERRORS)).toBe("خطأ واحد");
    expect(countAr(2, ERRORS)).toBe("خطآن");
    expect(countAr(3, WARNINGS)).toBe("٣ تنبيهات");
    expect(countAr(2, AYAT)).toBe("آيتان");
    expect(countAr(1, SCENES)).toBe("مشهد واحد");
    expect(countAr(27, WORDS)).toBe("٢٧ كلمة");
    expect(countAr(11, CORRECTIONS)).toBe("١١ تصحيحًا");
    expect(countAr(163, SCENES)).toBe("١٦٣ مشهدًا");
    expect(countAr(100, SENTENCES)).toBe("١٠٠ جملة");
    expect(countAr(0, AYAT, "بلا آيات")).toBe("بلا آيات");
  });
  it("the Studio no longer hand-writes «٢ أخطاء»، «٣ تنبيه»، «تصحيحات تنتظرك»، «مشهد آية معتمد»", () => {
    expect(src("app/src/tabs/ScriptTab.tsx")).not.toMatch(/errors === 1 \? "خطأ" : "أخطاء"|\{ar\(warnings\)\} تنبيه/);
    expect(src("app/src/shell/EpisodeSpine.tsx")).not.toContain("تصحيحات تنتظرك");
    expect(src("app/src/workspace/SceneProductionPanel.tsx")).not.toMatch(/\)\} مشهد آية معتمد/);
    expect(src("app/src/ui/format.ts")).toContain('export { countAr,');
  });
});

describe("owner text: no Western digits, no raw scene ids", () => {
  it("the rule", () => {
    expect(ownerTextProblems("جملة من 27 كلمة؛ قسّمها (الحد 20)")).toHaveLength(1);
    expect(ownerTextProblems("مشاهد نصها يختلف: c1-s2")).toHaveLength(1);
    expect(ownerTextProblems("النسخة الأساسية 4K بترميز H.264 وصوت 320k، شاهدها 1×")).toEqual([]);
    expect(ownerTextProblems("جملة من ٢٧ كلمة — المشهد ٥")).toEqual([]);
    expect(markupProblems("<p>الوصلات <span>162</span></p>")).toHaveLength(1);
    expect(markupProblems('<p>اكتب <code dir="rtl">[آية: البقرة 30 | …]</code> في سطرها</p>')).toEqual([]);
  });

  it("script check messages reach the owner in Arabic digits and by scene number", () => {
    const check: CheckResult = { ok: false, stats: { chapters: [], totalWords: 0, totalSeconds: 0 }, issues: [
      { level: "warning", code: "sentence-long", message: "جملة من 27 كلمة؛ قسّمها (الحد 20): «…»", line: 15 },
      { level: "error", code: "x", message: "نص المشهد c1-s2 يختلف عن السكريبت (السطر 18)", line: 18 },
    ] };
    const plan = { chapters: [{ number: 1, title: "", scenes: [{ id: "c1-s1" }, { id: "c1-s2" }] }] } as unknown as Plan;
    const owner = ownerCheck(check, plan);
    expect(owner.issues.map((i) => i.message)).toEqual(["جملة من ٢٧ كلمة؛ قسّمها (الحد ٢٠): «…»", "نص المشهد ٢ يختلف عن السكريبت (السطر ١٨)"]);
    expect(markupProblems(renderToStaticMarkup(<ScriptFixList errors={owner.issues} onLine={() => {}} />))).toEqual([]);
  });

  it("preview titles and notes: scene ranges by number, «·» gone, commands under «تفاصيل»", () => {
    const order = ["c1-s1", "c1-s2", "c1-s3", "c1-s4", "c1-s5"];
    expect(ownerPreviewText("032 · الميزان c1-s2…s5 أفقي صامت", order)).toBe("٠٣٢ — الميزان المشاهد ٢–٥ أفقي صامت");
    expect(ownerPreviewText("المشهد c1-s2 — صوت وصورة للمراجعة", order)).toBe("المشهد ٢ — صوت وصورة للمراجعة");
    expect(isTechnicalNote("git checkout 9ae73ab -- channels/zubdat-alkutub/episodes/x/episode.mp4")).toBe(true);
    expect(isTechnicalNote("مسودة مُجهَّزة مسبقًا؛ غير معتمدة")).toBe(false);
  });

  for (const ch of CHANNELS) it(`${ch}: step ٢ and step ٣ «الوصلات» before an assembly render no Western digit or raw id`, () => {
    const plan = planOf(ch);
    const ids = plan.chapters.flatMap((c) => c.scenes.map((s) => s.id));
    const read: SceneProductionRead = {
      schemaVersion: 1, channel: ch, episode: "001", revision: 2,
      progress: { currentScene: ids[0]!, approvedScenes: 0, totalScenes: ids.length, recitationPending: [], canAssemble: false, assemblyApproved: false, masterApproved: false, publishAllowed: false },
      script: { sha256: "a".repeat(64), approved: true }, storyboard: { sha256: "b".repeat(64), approved: true },
      scenes: ids.map((id) => ({ id, sourceSha256: "c".repeat(64), readyForAv: true, approved: false, status: "queued" as const })),
      prepared: { ready: 0, total: ids.length }, assembly: null, seams: ids.slice(1).map((id, i) => `${ids[i]}>${id}`), master: null,
      candidates: { scenes: {}, assemblySha256: null, masterSha256: null },
    } as unknown as SceneProductionRead;
    const noop = () => {};
    const props = { episodeId: "001", channelId: ch, plan, channel: channelOf(ch), initialRead: read, media: { voice: {} } as never, hasVoiceKeys: false,
      onOpenScene: noop, onOpenStoryboard: noop, onOpenScript: noop, onOpenPublish: noop, onOpenFinal: noop, onOpenSettings: noop };
    const seams = renderToStaticMarkup(<SceneProductionPanel {...props} finalView="seams" />);
    // QA (all three reports): no leftover single-scene card, no «إرسال للمراجعة», no seam count before an assembly
    expect(seams).toContain("الوصلات تُسمع بعد التجميع");
    expect(seams).not.toMatch(/إرسال للمراجعة|إنتاج المشهد|sp-media/);
    expect(markupProblems(seams)).toEqual([]);
    const step2 = renderToStaticMarkup(<SceneProductionPanel {...props} editor={() => <div>editor</div>} livePreview={() => <div>live</div>} />);
    expect(markupProblems(step2)).toEqual([]);
    // D83: the shorts segments are picked from step ٢ «أدوات وتفاصيل», before Master
    expect(step2).toContain("حدّد مقاطع الشورتس");
  });

  it("the pill shows a seam count only for a real assembly", () => {
    expect(src("app/src/App.tsx")).toMatch(/label: "الوصلات", sub: w\?\.assembly && w\.seams\.length \? arNum\(w\.seams\.length\)/);
  });
});

describe("«قسّم…» chooses the point, then confirms", () => {
  it("nothing is preselected without a caret; both halves are shown once chosen", () => {
    const html = renderToStaticMarkup(<SplitChooser text="هذا ظلم." n={2} busy={false} hasAudio onConfirm={() => {}} onCancel={() => {}} />);
    expect(html).toContain("قسّم بعد «هذا»");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>قسّم هنا<\/button>/);
    expect(html).toContain("لا يُحذف تسجيل");
    const chosen = renderToStaticMarkup(<SplitChooser text="نظر الأول إلى الميزان" n={1} busy={false} hasAudio={false} initial={2} onConfirm={() => {}} onCancel={() => {}} />);
    expect(chosen).toContain("الأولى: «نظر الأول» — الثانية: «إلى الميزان»");
    expect(chosen).not.toMatch(/<button[^>]*disabled=""[^>]*>قسّم هنا/);
    expect(caretWordIndex("هذا ظلم.", undefined)).toBeNull();
    expect(caretWordIndex("هذا ظلم.", 4)).toBe(1);
    expect(caretWordIndex("هذا ظلم.", 8)).toBeNull();
  });
  it("the menu item opens the chooser and never posts a split at once", () => {
    const s = src("app/src/workspace/SentencesPanel.tsx");
    expect(s).not.toContain("قسّم عند المؤشر");
    expect(s).not.toMatch(/Math\.floor\(r\.text\.length \/ 2\)/);
    expect(s).toContain("setSplitting(r.id)");
  });
});

describe("refusals in Arabic", () => {
  it("ffmpeg/ffprobe command lines and untranslated English never reach the owner raw", () => {
    expect(ownerMessage("Command failed: ffmpeg -nostdin -i x.wav -af loudnorm=I=-16:measured_I=-inf … Value -inf for parameter 'measured_I' out of range")).toBe(RECITATION_SILENT);
    expect(ownerMessage("Command failed: ffprobe -v error previews/episode.mp4: No such file or directory")).toMatch(/^لا نسخة مجمعة/);
    expect(ownerMessage("Totally new refusal.")).toMatch(new RegExp(`^${UNTRANSLATED.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
  });
  it("a silent recitation upload is refused with «الملف صامت أو فارغ», not ffmpeg's -inf", async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "bal-silent-"));
    try {
      const wav = path.join(dir, "silent.wav");
      execFileSync("ffmpeg", ["-nostdin", "-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "anullsrc=r=48000:cl=mono", "-t", "3", wav]);
      await expect(polishRecitation(wav, path.join(dir, "out.mp3"))).rejects.toThrow(RECITATION_SILENT);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  }, 30_000);
});

describe("notes inbox: the real reason", () => {
  it("«بلا اتصال» only for a network failure", () => {
    expect(NETWORK_FAILURE.test("fatal: unable to access 'https://github.com/x': Could not resolve host: github.com")).toBe(true);
    expect(NETWORK_FAILURE.test("fatal: '/nonexistent/blocked-push.git' does not appear to be a git repository\nfatal: Could not read from remote repository.")).toBe(false);
    expect(noteInboxLine({ sync: "pending", status: "open", answer: null, reason: "error" })).toMatch(/ليس انقطاع اتصال/);
  });
});

describe("navigation", () => {
  it("the scene on screen in step ٢ is in the address bar and survives a reload; a fresh open still goes home (D85)", () => {
    expect(studioHash({ channel: "balislam", episode: "001", tab: "episode", scene: "c1-s5" })).toBe("#/balislam/001/episode/c1-s5");
    expect(studioHash({ channel: "balislam", episode: "001", tab: "script", scene: "c1-s5" })).toBe("#/balislam/001/script");
    expect(parseStudioHash("#/balislam/001/episode/c1-s5")).toEqual({ channel: "balislam", episode: "001", tab: "episode", scene: "c1-s5" });
    expect(bootPlace({ hash: "#/balislam/001/episode/c1-s5", navigation: "reload", stored: {} })).toMatchObject({ episode: "001", tab: "episode", scene: "c1-s5" });
    expect(bootPlace({ hash: "#/balislam/001/episode/c1-s5", navigation: "open", stored: { channel: "balislam" } })).toEqual({ channel: "balislam", episode: undefined, tab: "home" });
  });
  it("a fresh browser takes the first channel; switching channels returns to that channel's last episode", () => {
    const app = src("app/src/App.tsx");
    expect(app).toContain('setChannelId((c) => c || list[0]?.id || "")');
    expect(app).toContain("store.set(`bal-episode:${channelId}`, epId)");
    expect(app).toContain("store.get(`bal-episode:${ch}`)");
  });
});

describe("new episode", () => {
  it("validates in Arabic next to the field, names the folder itself, and the server answers 409 without a path", () => {
    const app = src("app/src/App.tsx");
    expect(app).toMatch(/<Dialog as="form"[^>]*\n\s*noValidate/);
    expect(app).toContain("اكتب عنوان الحلقة أولًا.");
    expect(app).toMatch(/موجودة بالفعل؛ اختر رقمًا آخر/);
    const eps = src("src/script/episodes.ts");
    expect(eps).not.toMatch(/موجودة بالفعل: episodes\//);
    expect(src("app/server/api.ts")).toMatch(/EpisodeInputError\) return send\(res, 409/);
    // the race of a new episode: the plan is made before the ledger is read (no 500 «Prepare and save…»)
    expect(src("app/server/api.ts")).toMatch(/if \(!\(await io\.readPlanFile\(scriptPath\)\)\) await io\.regeneratePlan\(ep\)/);
  });
});

describe("stylesheets parse", () => {
  // A merge once lost a «}» in shell.css and the whole Studio showed Vite's error overlay (caught by ui-audit).
  it("every app stylesheet has balanced braces", async () => {
    const { readdirSync } = await import("node:fs");
    const walk = (d: string): string[] => readdirSync(path.join(root, d), { withFileTypes: true })
      .flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith(".css") ? [path.join(d, e.name)] : []));
    const bad = walk("app/src").filter((f) => {
      const s = src(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/"[^"\n]*"|'[^'\n]*'/g, "");
      let d = 0;
      for (const c of s) { if (c === "{") d++; else if (c === "}" && --d < 0) return true; }
      return d !== 0;
    });
    expect(bad).toEqual([]);
  });
});
