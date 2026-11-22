/**
 * D199 (owner decision 22 Nov): «اعتمد المشاهد التي شاهدتها كاملة في المعاينة قبل النهائية» بثلاثة شروط:
 * (١) نسخة المشهد في المعاينة هي نسخته الحالية، (٢) شوهد فعلًا حتى نهايته في المشغّل (لا تقديم ولا تخطٍّ)،
 * (٣) تُعرض القائمة قبل التأكيد ويُستثنى أي مشهد عليه ملاحظة مفتوحة؛ ويُسجَّل في السجل الموقّع.
 * لا شبكة ولا مفاتيح؛ القناة في مجلد مؤقت.
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { cpSync, copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runWithChannel } from "../src/channel";
import { approveStoryboard } from "../src/plan/storyboard";
import type { Plan } from "../src/plan/types";
import { decideSceneProduction, inspectSceneProduction, recordSceneRenderEvidence } from "../src/studio/sceneService";
import { runOwnerRequest } from "../src/studio/ownerContext";
import { appendStudioNote } from "../src/studio/notesInbox";
import { stateFileFor } from "../src/studio/sceneLedgerStore";
import { addPreFinalWatch, approveWatchedPreFinal, preFinalWatchView, PREFINAL_SLOT, watchFileFor } from "../src/studio/preFinalApprove";
import { PRE_FINAL_SLOT } from "../src/studio/assembleScenes";
import { fullyWatched, mergeSpans, playbackTracker, sceneSpansOf, type Span } from "../src/studio/preFinalWatch";
import { panelSource } from "./helpers/panelSource";

const repo = path.resolve(import.meta.dirname, "..");
const sha = (b: Buffer | string) => createHash("sha256").update(b).digest("hex");
/** Playback reported as the player does: steps of 0.25 s, never longer than 1 s per span. */
const played = (from: number, to: number): Span[] => {
  const out: Span[] = [];
  for (let t = from; t < to - 1e-9; t += 0.25) out.push([Math.round(t * 100) / 100, Math.round(Math.min(to, t + 0.25) * 100) / 100]);
  return out;
};

describe("D199 — المنطق الخالص", () => {
  it("المشغّل لا يعدّ ما قُفز فوقه ولا سرعة غير العادية ولا الإيقاف", () => {
    const tr = playbackTracker();
    const at = (t: number, o: Partial<{ paused: boolean; rate: number; seeking: boolean }> = {}) => tr.tick(t, { paused: false, rate: 1, ...o });
    expect(at(0)).toBeNull();
    expect(at(0.25)).toEqual([0, 0.25]);
    expect(at(5)).toBeNull(); // قفزة للأمام: لا تُحسب
    expect(at(5.25)).toEqual([5, 5.25]);
    tr.seek();
    expect(at(5.5)).toBeNull(); // بعد تقديم يبدأ العدّ من جديد
    expect(at(5.75, { rate: 2 })).toBeNull(); // سرعة مضاعفة
    expect(at(6)).toBeNull();
    expect(at(6.25)).toEqual([6, 6.25]);
    expect(at(6.5, { paused: true })).toBeNull();
  });
  it("«كاملًا»: يُتسامح في الطرفين وفجوات النبض فقط", () => {
    expect(fullyWatched(mergeSpans(played(0, 10)), 0, 10)).toBe(true);
    expect(fullyWatched(mergeSpans(played(0.2, 9.8)), 0, 10)).toBe(true);
    expect(fullyWatched(mergeSpans([...played(0, 4), ...played(5, 10)]), 0, 10)).toBe(false); // ثانية قُفز فوقها
    expect(fullyWatched(mergeSpans(played(0, 9)), 0, 10)).toBe(false); // لم يبلغ النهاية
  });
  it("مواضع المشاهد في الملف من سجله بالترتيب", () => {
    expect(sceneSpansOf({ sceneSeconds: { a: 2, b: 3, c: 1.5 } })).toEqual([{ id: "a", from: 0, to: 2 }, { id: "b", from: 2, to: 5 }, { id: "c", from: 5, to: 6.5 }]);
    expect(PREFINAL_SLOT).toBe(PRE_FINAL_SLOT);
  });
});

const ENV = ["BAL_CHANNELS_DIR", "BAL_CHANNEL", "BAL_WORKFLOW_HMAC_KEY"] as const;
const saved: Record<string, string | undefined> = {};
let tmp = "";
beforeAll(() => { for (const k of ENV) saved[k] = process.env[k]; tmp = mkdtempSync(path.join(os.tmpdir(), "bal-prefinal-bulk-")); });
afterAll(() => {
  for (const k of ENV) if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k];
  if (tmp) rmSync(tmp, { recursive: true, force: true });
});

describe("D199 — «اعتمد المشاهد التي شاهدتها كاملة» على سجل حقيقي", () => {
  it("الشروط الثلاثة، والقائمة قبل التأكيد، والسجل الموقّع", async () => {
    const channels = path.join(tmp, "channels");
    cpSync(path.join(repo, "channels", "dafatir-alzaman"), path.join(channels, "dafatir-alzaman"),
      { recursive: true, filter: (s) => !/[\\/]episodes([\\/]|$)/.test(s) });
    process.env.BAL_CHANNELS_DIR = channels;
    delete process.env.BAL_CHANNEL;
    process.env.BAL_WORKFLOW_HMAC_KEY = "LOCAL_TEST_ONLY__prefinal_bulk_signing_key_2026";
    const dir = path.join(channels, "dafatir-alzaman", "episodes", "003-bulk");
    mkdirSync(path.join(dir, "voice"), { recursive: true });
    const scriptPath = path.join(dir, "script.md");
    writeFileSync(scriptPath, `---\ntitle: "اختبار"\nepisode: "003"\n---\n## الفصل 1 · تجربة\nالمشهد الأول.\n\nالمشهد الثاني.\n\nالمشهد الثالث.\n\nالمشهد الرابع.\n`);
    const ids = ["c1-s1", "c1-s2", "c1-s3", "c1-s4"];
    const scenes = ids.map((id, i) => ({ id, template: "hz-text", line: 6 + 2 * i, narration: `المشهد ${["الأول", "الثاني", "الثالث", "الرابع"][i]}.`, sfx: [], props: {} }));
    const plan = { episode: "003", title: "اختبار", chapters: [{ number: 1, title: "تجربة", scenes }] } as unknown as Plan;
    writeFileSync(path.join(dir, "plan.json"), JSON.stringify(plan));
    for (const s of scenes) writeFileSync(path.join(dir, "voice", `${s.id}.wav`), "x");
    writeFileSync(path.join(dir, "voice", "index.json"), JSON.stringify(Object.fromEntries(scenes.map((s) =>
      [s.id, { file: `${s.id}.wav`, hash: `h-${s.id}`, text: s.narration, duration: 2, words: [] }]))));

    await runWithChannel("dafatir-alzaman", async () => {
      const st0 = await inspectSceneProduction("003");
      await decideSceneProduction("003", { action: "approve-script", expectedSha256: st0.script.sha256 });
      await approveStoryboard(scriptPath, plan, { note: "راجعت لوحات الاختبار" });
      await decideSceneProduction("003", { action: "approve-storyboard", expectedSha256: (await inspectSceneProduction("003")).storyboard.sha256 });
      // كل مشهد: معاينة حقيقية (ثانيتان) ودليل رندرها؛ c1-s1 أُرسل للمراجعة، والباقي مسودات جاهزة
      const previews = path.join(dir, "previews");
      mkdirSync(previews, { recursive: true });
      for (const [i, id] of ids.entries()) {
        execFileSync("ffmpeg", ["-nostdin", "-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i", `testsrc=size=160x90:rate=15:duration=2`,
          "-f", "lavfi", "-i", `sine=frequency=${300 + 40 * i}:duration=2`, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "ultrafast", "-c:a", "aac", "-shortest",
          path.join(previews, `scene-${id}-av.mp4`)]);
        const cur = (await inspectSceneProduction("003")).scenes.find((s) => s.id === id)!;
        await recordSceneRenderEvidence("003", id, cur.sourceSha256, "current");
      }
      const s1 = (await inspectSceneProduction("003")).scenes[0]!;
      await decideSceneProduction("003", { action: "submit-scene", sceneId: "c1-s1", expectedSha256: s1.sourceSha256 });

      // «المعاينة قبل النهائية» كما يكتبها التجميع: الملف وسجله بنسخة كل مشهد فيه وبصمة الملف (الشرط ١)
      const file = path.join(previews, `${PRE_FINAL_SLOT}.mp4`);
      copyFileSync(path.join(previews, "scene-c1-s1-av.mp4"), file);
      const cutSha = Object.fromEntries(ids.map((id) => [id, sha(readFileSync(path.join(previews, `scene-${id}-av.mp4`)))]));
      // c1-s4 في المعاينة بنسخة قديمة (غير نسخته الحالية)
      cutSha["c1-s4"] = "0".repeat(64);
      const fileSha256 = sha(readFileSync(file));
      const st = statSync(file);
      writeFileSync(path.join(previews, `${PRE_FINAL_SLOT}.seams.json`), JSON.stringify({ version: 1, size: st.size, mtimeMs: st.mtimeMs, fps: 30,
        sceneSeconds: { "c1-s1": 2, "c1-s2": 2, "c1-s3": 2, "c1-s4": 2 }, seams: [], loudness: { target: null, gain: {} }, headTrimmed: 0,
        sceneSha256: cutSha, fileSha256 }));
      // ملاحظة مفتوحة على c1-s2 (الشرط ٣)
      await appendStudioNote(dir, { channel: "dafatir-alzaman", episode: "003-bulk", sceneId: "c1-s2", raw: "[الحركة @0:01] تجربة", createdAt: new Date().toISOString(),
        sceneInputSha256: "a".repeat(64), previewSha256: "b".repeat(64), ledgerSeq: 99 });

      // قبل المشاهدة: لا شيء مؤهل
      const v0 = await preFinalWatchView("003");
      expect(v0.available).toBe(true);
      if (!v0.available) return;
      expect(v0.eligible).toEqual([]);
      // شاهد: c1-s1 كاملًا، وc1-s2 كاملًا (عليه ملاحظة)، وc1-s3 مع قفزة فوق نصف ثانية، وc1-s4 كاملًا (نسخة قديمة)
      await addPreFinalWatch("003", fileSha256, [...played(0, 4), ...played(4, 5), ...played(5.5, 8)]);
      // ملف معاينة آخر: لا يُقبل ما شوهد منه
      await expect(addPreFinalWatch("003", "f".repeat(64), played(0, 1))).rejects.toThrow(/تغيّرت المعاينة/);
      // مقطع أطول من خطوة المشغّل: مرفوض (لا يُدّعى ما لم يُشغَّل)
      await expect(addPreFinalWatch("003", fileSha256, [[0, 8]])).rejects.toThrow(/Malformed/);

      const v = await preFinalWatchView("003");
      if (!v.available) throw Error("unavailable");
      expect(v.eligible).toEqual(["c1-s1"]);
      expect(Object.fromEntries(v.excluded.map((x) => [x.id, x.reason]))).toEqual({ "c1-s2": "note", "c1-s3": "unwatched", "c1-s4": "stale" });

      // بلا تأكيد، أو بقائمة غير التي عُرضت: لا اعتماد
      await expect(approveWatchedPreFinal("003", { fileSha256, sceneIds: ["c1-s1"] })).rejects.toThrow(/أكّد/);
      await expect(approveWatchedPreFinal("003", { fileSha256, sceneIds: ["c1-s1", "c1-s3"], confirmed: true })).rejects.toThrow(/تغيّرت قائمة المشاهد/);
      // من خارج جهاز المالك: مرفوض (D54)
      await expect(runOwnerRequest({ remoteAddress: "192.168.1.20", sameOrigin: true, host: "127.0.0.1:4321" },
        () => approveWatchedPreFinal("003", { fileSha256, sceneIds: ["c1-s1"], confirmed: true }))).rejects.toThrow();

      const r = await approveWatchedPreFinal("003", { fileSha256, sceneIds: ["c1-s1"], confirmed: true });
      expect(r).toEqual({ approved: ["c1-s1"], failed: [] });
      const after = await inspectSceneProduction("003");
      expect(after.scenes.find((s) => s.id === "c1-s1")!.approved).toBe(true);
      for (const id of ["c1-s2", "c1-s3", "c1-s4"]) expect(after.scenes.find((s) => s.id === id)!.approved).toBe(false);
      // السجل الموقّع: الحدث نفسه «approve-scene» بعلامة الاعتماد بعد المعاينة وبصمتها
      const ledger = JSON.parse(readFileSync(stateFileFor(scriptPath), "utf8")) as { history: { action: string; sceneId?: string; note: string; via?: unknown }[] };
      const ev = ledger.history.filter((h) => h.action === "approve-scene").pop()!;
      expect(ev).toMatchObject({ sceneId: "c1-s1", via: { kind: "prefinal-watched", prefinalSha256: fileSha256 } });
      expect(ev.note).toContain("اعتمد بعد مشاهدة المعاينة قبل النهائية كاملة");
      // ما شوهد محفوظ على جهاز المالك بجوار الحلقة، مربوط ببصمة الملف
      expect(JSON.parse(readFileSync(watchFileFor(scriptPath), "utf8"))).toMatchObject({ version: 1, fileSha256 });
      // بعد الاعتماد: المعتمد يظهر «معتمد من قبل» ولا يُعتمد مرتين
      const v2 = await preFinalWatchView("003");
      if (v2.available) expect(v2.excluded.find((x) => x.id === "c1-s1")?.reason).toBe("approved");
    });
  }, 120_000);

  it("لا يضع العميل علامة «بعد المعاينة» بنفسه، ولا تُقبل إلا على «اعتمد المشهد»", async () => {
    await expect(decideSceneProduction("003", { action: "correct-scene", expectedSha256: "a".repeat(64), sceneId: "c1-s1", note: "x", viaPreFinal: "b".repeat(64) }))
      .rejects.toThrow(/Malformed/);
    const api = readFileSync(path.join(repo, "app/server/api.ts"), "utf8");
    expect(api).toContain("const { viaPreFinal: _via, ...command } = (body ?? {}) as Record<string, unknown>;");
    expect(api).toContain("await decideSceneProduction(ep, command);");
  });

  it("الزر في «معاينة قبل النهائية» يعرض القائمة (ما سيُعتمد وما لن يُعتمد بسببه) قبل التأكيد", () => {
    const ui = panelSource("app/src/workspace/PreFinalWatch.tsx");
    expect(ui).toContain("اعتمد المشاهد التي شاهدتها كاملة في المعاينة قبل النهائية");
    expect(ui).toContain('role="dialog" aria-label="قائمة الاعتماد قبل التأكيد"');
    expect(ui).toContain("BULK_REASON_AR[x.reason]");
    expect(ui).toMatch(/setOpen\(true\)/);
    const pf = panelSource("app/src/workspace/PreFinal.tsx");
    expect(pf).toContain("onSeeking={watch.handlers.onSeeking}");
    expect(pf).toContain("<PreFinalApproveWatched");
  });
});
