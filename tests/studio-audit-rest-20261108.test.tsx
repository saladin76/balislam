/**
 * Funnel audit (8 Nov): the remaining items 5, 9–14, 16–18 (D38). See docs/studio/archive/funnel-audit-20261108.md.
 */
import React from "react";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { pickRenderQueue, environmentalFailure } from "../src/studio/prepareAll";
import { serialized, LEDGER_LOCK_WAIT_MS } from "../src/studio/sceneService";
import {
  approveScript, approveStoryboard, createSceneFirstProduction, reviseSceneInput, submitSceneAvPreview,
} from "../src/studio/sceneProduction";
import { seamTimesFrom } from "../src/studio/seamTimes";
import { arNum, clockAr, sceneName, seamName } from "../app/src/workspace/sceneNames";
import { SeamRow } from "../app/src/workspace/SceneProductionPanel";
import { citationNotice } from "../app/src/shell/citationNotice";
import { BoardAuditLog } from "../app/src/tabs/BoardAuditLog";
import { SettingsTab } from "../app/src/tabs/SettingsTab";
import { parseStudioHash, studioHash } from "../app/src/shell/route";
import { panelSource } from "./helpers/panelSource";

const noop = () => {};
const h = (c: string) => c.repeat(64);
const src = (f: string) => panelSource(f);

describe("5 · «جهّز كل المشاهد» بلا صوت لا يبدأ رندرًا لا يُراجع", () => {
  const q = (ids: string[]) => ids.map((id) => ({ id, sourceSha256: h(id.slice(-1)) }));
  it("without a voice, only scenes before the first one waiting for its narration are drafted", () => {
    // open scenes in order: s1 ready, s2 waits for voice, s3 ready (e.g. the closing scene, no narration)
    const queue = { list: q(["s1", "s3"]), beforeVoiceGap: q(["s1"]) };
    expect(pickRenderQueue(queue, { voiceMissing: true })).toEqual({
      // 12 Nov (QA balislam 9): s3 is ready itself; it waits only because it comes after the gap («after-gap», not «voice»)
      todo: q(["s1"]), skipped: [{ id: "s3", reason: "after-gap" }] });
    // with the voice made, everything ready is drafted as before
    expect(pickRenderQueue(queue, { voiceMissing: false })).toEqual({ todo: q(["s1", "s3"]), skipped: [] });
    // the current scene itself waits for voice: nothing is rendered at all
    expect(pickRenderQueue({ list: q(["s3"]), beforeVoiceGap: [] }, { voiceMissing: true }).todo).toEqual([]);
  });
  it("the same inputs that failed last time are skipped; a changed scene or a network failure is retried", () => {
    const queue = { list: q(["s1", "s2"]), beforeVoiceGap: q(["s1", "s2"]) };
    const previousFailures = [{ id: "s1", error: "boom", sourceSha256: h("1") }, { id: "s2", error: "boom", sourceSha256: h("x") }];
    expect(pickRenderQueue(queue, { voiceMissing: false, previousFailures })).toEqual({
      todo: q(["s2"]), skipped: [{ id: "s1", reason: "failed-before", error: "boom", sourceSha256: h("1") }] });
    expect(environmentalFailure("getaddrinfo ENOTFOUND remotion.media")).toBe(true);
    expect(pickRenderQueue(queue, { voiceMissing: false,
      previousFailures: [{ id: "s1", error: "getaddrinfo ENOTFOUND remotion.media", sourceSha256: h("1") }] }).todo).toEqual(q(["s1", "s2"]));
  });
  it("the button never says it is making voice when there is no key", () => {
    const ui = src("app/src/workspace/PrepareAll.tsx");
    expect(ui).toContain(`job!.phase === "voice" && job!.voice.status === "pending" && job!.voice.needed > 0 ? "يولّد الصوت…"`);
    expect(ui).toContain("يُجهَّز ما قبل أول مشهد ينقصه صوته فقط");
  });
});

describe("9 · قفل السجل ينتظر الكاتب الحي بدل «مشغول» بعد ١٫٥ ث", () => {
  it("waits for a live writer that holds the lock longer than the old 60×25 ms, and never deletes it", async () => {
    expect(LEDGER_LOCK_WAIT_MS).toBeGreaterThanOrEqual(10_000);
    const dir = await mkdtemp(path.join(os.tmpdir(), "ledger-lock-"));
    const file = path.join(dir, "scene-production.v1.json");
    const live = `${process.pid} ${randomUUID()}`; // this process: a live writer, never recovered
    try {
      await writeFile(file + ".lock", live);
      const started = Date.now();
      setTimeout(() => void rm(file + ".lock", { force: true }), 1_900);
      expect(await serialized(file, async () => "done")).toBe("done");
      expect(Date.now() - started).toBeGreaterThanOrEqual(1_800);
      // A bounded wait still says «busy» and leaves the live lock alone.
      await writeFile(file + ".lock", live);
      await expect(serialized(file, async () => "never", 300)).rejects.toThrow(/ledger is busy/);
      expect(await readFile(file + ".lock", "utf8")).toBe(live);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }, 15_000);
});

describe("10 · «بانتظار التعديل» لمن طُلب تعديله فقط", () => {
  it("an input change keeps a never-submitted scene queued; a submitted one is re-opened", () => {
    let p = createSceneFirstProduction({ channel: "c", episode: "001", scriptSha256: h("a"), storyboardSha256: h("b"),
      scenes: [{ id: "s1", sourceSha256: h("1") }, { id: "s2", sourceSha256: h("2") }] });
    p = approveStoryboard(approveScript(p, "owner", new Date().toISOString(), h("a")), "owner", new Date().toISOString(), h("b"));
    p = submitSceneAvPreview(p, "s1", h("1"), h("9"));
    p = reviseSceneInput(reviseSceneInput(p, "s2", h("3")), "s1", h("4"));
    expect(p.scenes.map((s) => [s.id, s.status])).toEqual([["s1", "needs_revision"], ["s2", "queued"]]);
    expect(p.scenes[1]!.sourceSha256).toBe(h("3"));
  });
  it("the badge says «بانتظار التعديل» only with the owner's correction", () => {
    expect(src("app/src/workspace/SceneProductionPanel.tsx")).toContain(`scene.correction ? "بانتظار التعديل" : "عُدّل؛ يحتاج إنتاجًا جديدًا"`);
  });
});

describe("11 · أسماء المشاهد والوصلات بالأرقام، والوصلة تنقل المشغّل", () => {
  const order = ["c1-s1", "c1-s2", "c2-s1"];
  it("names scenes by their place, in Arabic digits", () => {
    expect(sceneName(order, "c2-s1")).toBe("المشهد ٣");
    expect(seamName(order, "c1-s2>c2-s1")).toBe("المشهد ٢ ← ٣");
    expect(clockAr(83.4)).toBe("١:٢٣");
    expect(arNum(31)).toBe("٣١");
  });
  it("seam times are the running sum of the real cut durations, or nothing when one is unknown", () => {
    expect(seamTimesFrom(["c1-s1>c1-s2", "c1-s2>c2-s1"], { "c1-s1": 21.7, "c1-s2": 29.9, "c2-s1": 10 }))
      .toEqual({ "c1-s1>c1-s2": 21.7, "c1-s2>c2-s1": 51.6 });
    expect(seamTimesFrom(["c1-s1>c1-s2"], { "c1-s2": 3 })).toEqual({});
    expect(seamTimesFrom(["c1-s1>c1-s2"])).toEqual({});
  });
  it("a seam row shows its name and a jump button, and jumping never checks it", () => {
    const html = renderToStaticMarkup(<SeamRow label="المشهد ٢ ← ٣" at={51.6} checked={false} onCheck={noop} onJump={noop} />);
    expect(html).toContain("المشهد ٢ ← ٣");
    expect(html).toContain("عند ٠:٥١");
    expect(html).not.toContain("c1-");
    expect(renderToStaticMarkup(<SeamRow label="x" checked onCheck={noop} onJump={noop} />)).not.toContain("<button");
  });
  it("the spine and step screens name the scene, and say «النسخة النهائية» not «Master»", () => {
    const spine = src("app/src/shell/EpisodeSpine.tsx");
    expect(spine).toContain("sceneName(w.scenes.map((x) => x.id), w.progress.currentScene)");
    expect(spine).not.toMatch(/text: "[^"]*Master/);
    expect(src("app/src/workspace/SceneProductionPanel.tsx")).not.toContain(`seam.replace(">", " → ")`);
  });
});

describe("12 · عدد الاستشهادات غير الموثّقة في سطر اعتماد السكريبت", () => {
  it("counts unverified citations and the verses among them; silent when all are verified", () => {
    const items = [
      ...Array.from({ length: 11 }, () => ({ kind: "other", status: "verified" })),
      { kind: "ayah", status: "pending" }, { kind: "ayah", status: "pending" }, { kind: "ayah", status: "changed" },
      { kind: "hadith", status: "pending" }, { kind: "other", status: "rejected" },
    ];
    expect(citationNotice(items)).toBe("استشهادات غير موثّقة: ٥ من ١٦ (منها ٣ آيات). للتوثيق فقط ولا تمنع شيئًا (لا الاعتماد ولا النسخة النهائية ولا النشر)؛ وثّقها في «سجل التوثيق» (أدوات وتفاصيل بجوار السكريبت).");
    expect(citationNotice(items.slice(0, 11))).toBe("");
    expect(citationNotice([])).toBe("");
  });
});

describe("13 · «سجل مراجعة اللوحات»: ملاحظته تُكتب مع «اعتمد التجهيز» (funnel v3)", () => {
  const st = { total: 31, approved: 0, changed: [], fresh: [], ok: false, scenes: {} };
  it("the log lives under «أدوات وتفاصيل»; the board note is asked next to the one filled button of step ١", () => {
    // 12 Nov (QA balislam 1, D76): the log is read-only history; no withdrawal and no second board approval.
    const html = renderToStaticMarkup(<BoardAuditLog st={st} channelId="balislam" episodeId="002" />);
    expect(html).toContain("سجل مراجعة اللوحات");
    expect(html).not.toContain("اسحب الاعتماد");
    expect(html).not.toContain("<button");
    const spine = src("app/src/shell/EpisodeSpine.tsx");
    expect(spine).toContain("ملاحظة (اختيارية، سطر واحد)");
    expect(spine).toContain("needNote && boardNote.trim() ? { note: boardNote.trim() } : {}");
  });
});

describe("14 · صفحة المفاتيح: شرح قصير وعودة إلى الحلقة", () => {
  it("offers the way back when opened from an episode, and folds the technical details", () => {
    expect(renderToStaticMarkup(<SettingsTab onKeysChanged={noop} onBack={noop} />)).toContain("العودة إلى الحلقة");
    expect(renderToStaticMarkup(<SettingsTab onKeysChanged={noop} />)).not.toContain("العودة إلى الحلقة");
    const ui = src("app/src/tabs/SettingsTab.tsx");
    expect(ui.indexOf("BAL_ENV_FILE")).toBeGreaterThan(ui.indexOf("تفاصيل تقنية"));
    expect(src("app/src/App.tsx")).toContain("if (EPISODE_TABS.includes(tab)) setSettingsReturn(tab)");
  });
});

describe("16 · بعد اعتماد كل المشاهد يبقى الشريط والمشغّل لإعادة المشاهدة", () => {
  it("step ٣ keeps the strip and an approved scene's video, with one forward action", () => {
    const ui = src("app/src/workspace/SceneProductionPanel.tsx");
    expect(ui).toContain("const allDoneHere = Boolean(sceneMode && onOpenFinal && data && data.script.approved && data.storyboard.approved && !currentId);");
    expect(ui).toContain("(currentId && scene) || allDoneHere");
    expect(ui).toContain("اختر أي مشهد من الشريط لتعيد مشاهدته");
  });
});

describe("17 · المعاينات الصامتة تبدأ مكتومة", () => {
  it("autoplaying silent players are muted from the start (no browser refusal, no warning)", () => {
    const preview = src("app/src/ui/Preview.tsx");
    expect(preview).toContain("initiallyMuted={muted}");
    expect(preview.match(/initiallyMuted/g)?.length).toBeGreaterThanOrEqual(2);
    expect(src("app/src/tabs/EpisodeTab.tsx")).toMatch(/episodeOverlays=\{plan\.overlays\} muted \/>/);
  });
});

describe("18 · رابط لكل حلقة وخطوة", () => {
  it("round-trips channel, episode and step; rejects junk", () => {
    expect(studioHash({ channel: "zubdat-alkutub", episode: "001", tab: "episode" })).toBe("#/zubdat-alkutub/001/episode");
    expect(parseStudioHash("#/zubdat-alkutub/001/episode")).toEqual({ channel: "zubdat-alkutub", episode: "001", tab: "episode" });
    expect(parseStudioHash("#/balislam/settings")).toEqual({ channel: "balislam", tab: "settings" });
    expect(studioHash({ channel: "balislam", episode: "002", tab: "settings" })).toBe("#/balislam/settings");
    expect(parseStudioHash("#/balislam/002")).toEqual({ channel: "balislam", episode: "002", tab: "script" });
    expect(parseStudioHash("#/balislam/002/nope")).toEqual({ channel: "balislam", episode: "002", tab: "script" });
    expect(parseStudioHash("#/../etc")).toEqual({});
    expect(parseStudioHash("")).toEqual({});
    // an episode step without an episode falls back to the channel only
    expect(studioHash({ channel: "balislam", tab: "review" })).toBe("#/balislam");
  });
  it("a link never carries the owner passphrase", () => {
    const code = src("app/src/shell/route.ts").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(code).not.toMatch(/secret|passphrase|token/i);
  });
});
