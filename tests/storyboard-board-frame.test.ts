import { createHash } from "node:crypto";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { HORIZON_BOARD_VIEW, boardWords, horizonCloseSeconds, shotFrame } from "../src/plan/storyboardView";
import { storyboardVisualHash } from "../src/plan/storyboard";
import { sceneFrames } from "../src/plan/duration";
import { emptyMedia } from "../src/plan/media";
import { EXIT_BEAT } from "../src/remotion/dafatir/horizon/book";
import { HZ_META } from "../src/remotion/dafatir/horizon/meta";
import { boardTimings } from "../src/render/storyboardStills";
import { episodeFrames } from "../src/remotion/scenes/Episode";
import { loadChannel } from "../src/channel";
import { channelInfo } from "../src/channel/types";
// @ts-expect-error — مصدّر PDF المشترك ملف .mjs بلا أنواع
import { normalizeStoryboard, safeImageData } from "../scripts/studio-storyboard-pdf.mjs";
import type { Plan, PlanScene } from "../src/plan/types";

/**
 * الأمر 027: لوحة الستوري بورد = ما سيُرندر، عند اللحظة التي يُرى فيها المشهد مكتملًا في الفيديو.
 * قبلها كانت لوحة «خط الأفق» عند 80% من المشهد، فتقع كثيرًا في قلب الصفحة أو خفوت الحبر أو رجوع الكادر،
 * ولوحة عنوان الفصل صفحةً فارغة.
 */
const EP = "channels/dafatir-alzaman/episodes/001-adam-beginning";
// خطة V7 محفوظة (فيها بطاقات الآيات والفصول التي تُختبر لوحاتها)؛ V8 الحالية بلا بطاقات تُختبر في آخر الملف
const plan = JSON.parse(readFileSync(path.join(EP, "plan.v7.json"), "utf8")) as Plan;
const plan8 = JSON.parse(readFileSync(path.join(EP, "plan.json"), "utf8")) as Plan;
const scenes = plan.chapters.flatMap((c) => c.scenes);
const fps = 30;

const owned: string[] = [];
afterEach(async () => { for (const d of owned.splice(0)) await rm(d, { recursive: true, force: true }); });

describe("لحظة لوحة الستوري بورد", () => {
  it("القوالب الأخرى كما كانت: بطاقة الآية 55%، وغيرها 80% (لوحات بالإسلام وزبدة الكتب لا تتغير)", () => {
    const verse = { id: "v", template: "verse-card", narration: "", props: {} } as unknown as PlanScene;
    const noor = { id: "n", template: "noor-text", narration: "جملة.", props: {} } as unknown as PlanScene;
    expect(shotFrame(verse, 120)).toBe(66);
    expect(shotFrame(noor, 300)).toBe(240);
  });

  it("خط الأفق في الحلقة 001: كل لوحة بعد آخر كلمة وقبل بدء الخروج، وعنوان الفصل في منتصفه", () => {
    let horizon = 0;
    for (const s of scenes.filter((x) => x.template === "horizon-shot")) {
      const d = sceneFrames(s, emptyMedia);
      const f = shotFrame(s, d);
      expect(f, s.id).toBeGreaterThanOrEqual(0);
      expect(f, s.id).toBeLessThan(d);
      if (s.props.shot === "chapter") { expect(f, s.id).toBe(Math.round(d * 0.5)); continue; }
      const close = horizonCloseSeconds(s);
      if (close === undefined) continue;
      horizon++;
      const exit = (s.props.exit as string) || HZ_META[String(s.props.shot)]!.exit;
      // كل الكلام منطوق (فكل ما يُكتب على الصفحة ظهر)
      expect(f / fps, s.id).toBeGreaterThanOrEqual(close);
      // ولم يبدأ القلب ولا الخفوت ولا رجوع الكادر قبل القلب
      expect(f / fps, s.id).toBeLessThan(close + (exit === "turn" ? 0.05 : EXIT_BEAT));
    }
    expect(horizon).toBeGreaterThan(40);
  });

  it("بصوت الراوي تُحسب اللحظة من نهاية آخر كلمة في الصوت، وإلا من التقدير", () => {
    const s = scenes.find((x) => x.id === "c5-s3")!;
    const tokens = s.narration.split(/\s+/).filter(Boolean);
    const words = tokens.map((w, i) => ({ word: w, start: 1 + i * 0.5, end: 1.4 + i * 0.5 }));
    const end = words[words.length - 1]!.end;
    expect(horizonCloseSeconds(s, words)).toBeCloseTo(end, 6);
    expect(shotFrame(s, 900, words)).toBe(Math.round((end + 0.25) * fps));
    // صوت لا يطابق النص لا يُستعمل
    const media = { voice: { [s.id]: { text: "نص آخر", words } } };
    expect(boardWords(s, media)).toBeUndefined();
    expect(boardWords(s, { voice: { [s.id]: { text: s.narration.trim(), words } } })).toBe(words);
  });

  it("تغيير لحظة اللوحة يعيد فتح ستوري بورد مشاهد خط الأفق وحدها", () => {
    const v3 = (scene: PlanScene) => {
      const props = Object.fromEntries(Object.entries(scene.props ?? {})
        .filter(([, value]) => value != null && value !== "")
        .sort(([left], [right]) => left.localeCompare(right)));
      return createHash("sha1").update(JSON.stringify({
        version: 3, template: scene.template, props, narration: scene.narration.trim(),
        backdrop: scene.backdrop ?? "", durationSec: scene.durationSec ?? null,
        sfx: scene.sfx ?? [], overlays: scene.overlays ?? {}, captions: scene.captions ?? null,
        ayahKey: scene.ayahKey ?? "", transition: scene.transition ?? "",
      })).digest("hex").slice(0, 12);
    };
    const horizon = scenes.find((x) => x.template === "horizon-shot")!;
    const verse = scenes.find((x) => x.template === "verse-card")!;
    expect(HORIZON_BOARD_VIEW).toBe("settled-close-1");
    expect(storyboardVisualHash(horizon)).not.toBe(v3(horizon));
    expect(storyboardVisualHash(verse)).toBe(v3(verse));
  });
});

describe("لوحات الستوري بورد من الخطة (bal storyboard --stills)", () => {
  it("توقيت اللوحات هو توقيت تكوين الحلقة نفسه (بطاقة الأعراف 15 ضمنه)", () => {
    const channel = channelInfo(loadChannel("dafatir-alzaman"));
    const t = boardTimings(plan, channel);
    expect(t.total).toBe(episodeFrames({ plan, channel, media: emptyMedia }));
    expect(t.scenes.map((x) => x.scene.id)).toContain("c4-v7");
    expect(t.scenes).toHaveLength(scenes.length);
    for (const r of t.scenes) expect(r.frame).toBe(shotFrame(r.scene, r.durationInFrames));
  });

  it("V9.2 (محفوظة، versions/v9.2): توقيت اللوحات = تكوين الحلقة، 49 لوحة بلا بطاقة آية ولا فصل", () => {
    // D143: الخطة الحية يحرّرها المالك (حذف الغلاف والبسملة بطلبه)، فيُفحص العدد على النسخة المحفوظة
    const plan92 = JSON.parse(readFileSync(path.join(EP, "versions/v9.2/plan.json"), "utf8")) as Plan;
    const channel = channelInfo(loadChannel("dafatir-alzaman"));
    const t = boardTimings(plan92, channel);
    expect(t.total).toBe(episodeFrames({ plan: plan92, channel, media: emptyMedia }));
    expect(t.scenes).toHaveLength(49);
    expect(t.scenes.filter((x) => x.scene.template === "verse-card" || x.scene.props?.shot === "chapter")).toEqual([]);
    for (const r of t.scenes) expect(r.frame).toBe(shotFrame(r.scene, r.durationInFrames));
  });

  it("البيان بصيغة مصدّر PDF المشترك (scenes[].board نسبةً إلى مجلد الحلقة)", async () => {
    const ep = await mkdtemp(path.join(os.tmpdir(), "sb-stills-"));
    owned.push(ep);
    await mkdir(path.join(ep, "storyboard-stills"));
    await writeFile(path.join(ep, "storyboard-stills", "c1-s0.jpg"), Buffer.from([255, 216, 255, 224, 0, 16, 74, 70, 73, 70, 0, 1, 1]));
    const manifest = { kind: "storyboard-stills", channel: "dafatir-alzaman", episode: "001-adam-beginning", storyboardVersion: "plan abc",
      scenes: [{ id: "c1-s0", chapter: 1, chapterTitle: "ف", name: "cover", narration: "", shot: "cover", board: "storyboard-stills/c1-s0.jpg" }] };
    const file = path.join(ep, "storyboard-stills", "storyboard.json");
    await writeFile(file, JSON.stringify(manifest));
    const n = normalizeStoryboard(manifest, file);
    expect(n.root).toBe(path.resolve(ep));
    expect(n.scenes[0].landscape).toBe("storyboard-stills/c1-s0.jpg");
    expect(n.status).toBe("PENDING_REVIEW");
    expect(safeImageData(n.root, n.scenes[0].landscape).src.startsWith("data:image/jpeg;base64,")).toBe(true);
  });
});
