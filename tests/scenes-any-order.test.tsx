/**
 * D145 (owner decision 15 Nov 2026, all three channels): «كل شيء متاح، وكل مشهد يعالج لوحده». Every scene is produced,
 * reviewed and approved / sent back in ANY order; the assembly, then Master, then publish still wait for every scene.
 * The ledger (src/studio/sceneProduction.ts, sceneGates.ts, sceneDecisions.ts, prepareAll.ts) and step ٢/٣ of the Studio.
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  createSceneFirstProduction, approveScript, approveStoryboard, submitSceneAvPreview, approveSceneAv,
  requestSceneCorrection, reviseSceneInput, submitAssembly, sceneFirstProgress, approvedSceneInputsSha256,
} from "../src/studio/sceneProduction";
import { checkRenderAllowed } from "../src/studio/sceneGates";
import { pickRenderQueue } from "../src/studio/prepareAll";
import type { CurrentInput } from "../src/studio/sceneLedgerStore";
import { SceneProductionPanel } from "../app/src/workspace/SceneProductionPanel";
import { AssemblyMissing } from "../app/src/workspace/sceneProduction/FinalSteps";
import { SCENE_STATE_LABEL, assemblyMissing, nextUnapproved, sceneStateOf } from "../app/src/workspace/sceneProduction/sceneStates";
import { ownerMessage } from "../app/src/serverMessages";
import type { SceneProductionRead } from "../app/src/api";
import type { Plan } from "../src/plan/types";
import { channelInfo, type ChannelConfig } from "../src/channel/types";
import { panelSource } from "./helpers/panelSource";

const h = (c: string) => c.repeat(64);
const at = "2026-11-15T09:00:00.000Z";
const ids = ["s1", "s2", "s3", "s4", "s5"];
const planned = () => approveStoryboard(approveScript(createSceneFirstProduction({
  channel: "balislam", episode: "001", scriptSha256: h("a"), storyboardSha256: h("b"),
  scenes: ids.map((id, i) => ({ id, sourceSha256: h(String(i + 1)) })),
}), "owner", at, h("a")), "owner", at, h("b"));
const src = (id: string) => h(String(ids.indexOf(id) + 1));
const approve = (p: ReturnType<typeof planned>, id: string, cut: string, recitationPending = false) =>
  approveSceneAv(submitSceneAvPreview(p, id, src(id), cut), id, { by: "owner", at, previewSha256: cut, watchedWithAudio: true, recitationPending });
const current = (over: Partial<CurrentInput> = {}) => ({
  planReady: true, voiceReady: Object.fromEntries(ids.map((id) => [id, true])), recitationPending: {},
  blocks: { scenes: {}, episode: [] }, ...over,
}) as unknown as CurrentInput;

describe("the ledger: each scene on its own, any order", () => {
  it("approves scene 3 before 1 and 2, sends scene 5 back, and keeps every other scene as it was", () => {
    let p = approve(planned(), "s3", h("c"));
    expect(p.scenes.map((s) => s.status)).toEqual(["queued", "queued", "approved", "queued", "queued"]);
    p = requestSceneCorrection(submitSceneAvPreview(p, "s5", src("s5"), h("e")), "s5");
    expect(p.scenes.map((s) => s.status)).toEqual(["queued", "queued", "approved", "queued", "needs_revision"]);
    expect(sceneFirstProgress(p)).toMatchObject({ currentScene: "s1", unapprovedScenes: ["s1", "s2", "s4", "s5"], approvedScenes: 1, canAssemble: false });
  });

  it("the assembly waits for ALL scenes (and no conditional one), and says which are left", () => {
    let p = approve(approve(planned(), "s5", h("e")), "s2", h("d"));
    expect(() => submitAssembly(p, h("f"))).toThrow("not approved yet: s1, s3, s4.");
    expect(() => approvedSceneInputsSha256(p)).toThrow(/s1, s3, s4/);
    p = approve(approve(p, "s4", h("4")), "s1", h("1"));
    // a verse approved «مشروطًا بالتلاوة» still holds the assembly
    const conditional = approve(p, "s3", h("3"), true);
    expect(sceneFirstProgress(conditional)).toMatchObject({ unapprovedScenes: [], recitationPending: ["s3"], canAssemble: false });
    expect(() => submitAssembly(conditional, h("f"))).toThrow(/recitation/);
    const all = approve(p, "s3", h("3"));
    expect(sceneFirstProgress(all)).toMatchObject({ currentScene: null, unapprovedScenes: [], canAssemble: true });
    expect(submitAssembly(all, h("f")).assembly?.videoSha256).toBe(h("f"));
  });

  it("an edit re-opens only that scene and cancels the assembly", () => {
    let p = planned();
    for (const id of ["s4", "s1", "s5", "s2", "s3"]) p = approve(p, id, h(id.slice(1)));
    const assembled = submitAssembly(p, h("f"));
    const edited = reviseSceneInput(assembled, "s4", h("9"));
    expect(edited.scenes.map((s) => s.status)).toEqual(["approved", "approved", "approved", "needs_revision", "approved"]);
    expect(edited.assembly).toBeUndefined();
    expect(sceneFirstProgress(edited)).toMatchObject({ currentScene: "s4", unapprovedScenes: ["s4"], canAssemble: false });
  });

  it("an old ledger approved in order migrates as is (no event rewritten, the chain stays approved)", () => {
    let p = planned();
    for (const id of ids) p = approve(p, id, h(id.slice(1)));
    const stored = JSON.parse(JSON.stringify(p)); // as read back from scene-production.v1.json
    expect(sceneFirstProgress(stored)).toMatchObject({ approvedScenes: 5, unapprovedScenes: [], canAssemble: true });
    expect(approvedSceneInputsSha256(stored)).toBe(approvedSceneInputsSha256(p));
    expect(stored).toEqual(p);
  });

  it("«أنتج هذا المشهد» works on any scene not approved yet; an approved one is not re-rendered over its reviewed bytes", () => {
    const p = approve(planned(), "s2", h("d"));
    expect(() => checkRenderAllowed(p, current(), "s5", src("s5"), "current")).not.toThrow();
    expect(() => checkRenderAllowed(p, current(), "s1", src("s1"), "ahead")).not.toThrow();
    expect(() => checkRenderAllowed(p, current(), "s2", src("s2"), "current")).toThrow(/approved/);
    expect(() => checkRenderAllowed(p, current(), "s5", h("0"), "current")).toThrow(/inputs changed/);
    // the other gates are unchanged: «اعتمد التجهيز» first, a scene blocked by a fix, a missing voice
    expect(() => checkRenderAllowed(p, current({ planReady: false }), "s5", src("s5"), "current")).toThrow(/storyboard/);
    expect(() => checkRenderAllowed(p, current({ blocks: { scenes: { s5: ["آية بلا نص"] }, episode: [] } } as never), "s5", src("s5"), "current")).toThrow(/آية بلا نص/);
    expect(() => checkRenderAllowed(p, current({ voiceReady: {} }), "s5", src("s5"), "current")).toThrow(/narration/);
  });

  it("«جهّز كل المشاهد» drafts every ready scene, even after one still waiting for its voice", () => {
    const q = (xs: string[]) => xs.map((id) => ({ id, sourceSha256: src(id) }));
    expect(pickRenderQueue({ list: q(["s1", "s4", "s5"]), beforeVoiceGap: q(["s1"]), gap: "s2" }, { voiceMissing: true }))
      .toEqual({ todo: q(["s1", "s4", "s5"]), skipped: [] });
  });

  it("the server holds no order between scenes any more", () => {
    const decisions = panelSource("src/studio/sceneDecisions.ts");
    const ledger = panelSource("src/studio/sceneProduction.ts");
    expect(decisions).not.toContain("Approve the previous scene");
    expect(ledger).not.toContain("Approve the previous scene");
    expect(ledger).not.toContain("p.scenes.slice(0, index)");
  });
});

describe("«أنتج كل المشاهد الجاهزة»: free renders only", () => {
  it("never reaches a voice client, whatever key is configured", () => {
    const prep = panelSource("src/studio/prepareAll.ts");
    expect(prep).toContain("const needed = opts.renderOnly ? [] :");
    expect(prep).toContain("if (!opts.renderOnly) try {");
    const api = panelSource("app/server/api.ts");
    // 15–16 Nov: every start is free unless it carries the scenes the owner confirmed in «ولّد الصوت الآن».
    expect(api).toContain("const voiceClient = paid ? channelMod.runWithChannel(ch, () => elevenLabsFromEnv()) : null;");
    expect(api).toContain("renderOnly: !paid");
    expect(panelSource("app/src/workspace/PrepareAll.tsx")).toContain("أنتج كل المشاهد الجاهزة");
  });
});

// ── The Studio (identical for the three channels) ─────────────────────────────────────────────────
type Scene = SceneProductionRead["scenes"][number];
const scene = (id: string, over: Partial<Scene> = {}): Scene => ({ id, status: "queued", sourceSha256: h("c"), readyForAv: true, approved: false, ...over });

describe("each scene's own state, in the owner's words", () => {
  it("لم يُنتج / جاهز للمراجعة / معتمد / بانتظار التعديل / مشروط بالتلاوة", () => {
    expect(SCENE_STATE_LABEL[sceneStateOf(scene("a"))]).toBe("لم يُنتج");
    expect(SCENE_STATE_LABEL[sceneStateOf(scene("a", { draft: "ready" }))]).toBe("جاهز للمراجعة");
    expect(SCENE_STATE_LABEL[sceneStateOf(scene("a", { status: "in_review", previewSha256: h("d") }))]).toBe("جاهز للمراجعة");
    expect(SCENE_STATE_LABEL[sceneStateOf(scene("a", { status: "approved", approved: true }))]).toBe("معتمد");
    expect(SCENE_STATE_LABEL[sceneStateOf(scene("a", { status: "needs_revision", awaitingChange: true, correction: { note: "x", at } }))]).toBe("بانتظار التعديل");
    expect(SCENE_STATE_LABEL[sceneStateOf(scene("a", { status: "approved", approved: true, conditional: true }))]).toBe("مشروط بالتلاوة");
  });
  it("«اعتمد المشهد» moves to the next scene NOT yet approved (after it, then from the start)", () => {
    const list = [scene("a"), scene("b", { approved: true }), scene("c"), scene("d", { approved: true }), scene("e")];
    expect(nextUnapproved(list, "c")).toBe("e");
    expect(nextUnapproved(list, "e")).toBe("a");
    expect(nextUnapproved([scene("a", { approved: true }), scene("b")], "b")).toBe(null);
  });
});

describe("step ٣: the assembly says what is missing, with a link to each scene", () => {
  const read = (approved: string[], conditional: string[] = []): SceneProductionRead => {
    const all = Array.from({ length: 12 }, (_, i) => `c1-s${i + 1}`);
    return {
      schemaVersion: 1, channel: "balislam", episode: "001", revision: 1,
      progress: { currentScene: all.find((x) => !approved.includes(x)) ?? null, approvedScenes: approved.length, totalScenes: all.length,
        unapprovedScenes: all.filter((x) => !approved.includes(x)), recitationPending: conditional,
        canAssemble: false, assemblyApproved: false, masterApproved: false, publishAllowed: false },
      script: { sha256: h("a"), approved: true }, storyboard: { sha256: h("b"), approved: true },
      scenes: all.map((id) => scene(id, approved.includes(id) ? { status: "approved", approved: true, conditional: conditional.includes(id) } : {})),
      assembly: null, seams: [], master: null, candidates: { scenes: {}, assemblySha256: null, masterSha256: null },
    };
  };
  it("«باقي ٧ مشاهد غير معتمدة: ٣، ٨، …» and each number opens its scene", () => {
    const data = read(["c1-s1", "c1-s2", "c1-s4", "c1-s5", "c1-s6"]);
    expect(assemblyMissing(data).unapproved).toEqual(["c1-s3", "c1-s7", "c1-s8", "c1-s9", "c1-s10", "c1-s11", "c1-s12"]);
    const html = renderToStaticMarkup(<AssemblyMissing data={data} onOpenScene={() => {}} />);
    const text = html.replace(/<[^>]+>/g, "");
    expect(text).toBe("باقي ٧ مشاهد غير معتمدة: ٣، ٧، ٨، ٩، ١٠، ١١، ١٢.");
    expect(html.match(/<button/g)).toHaveLength(7);
  });
  it("one scene left, and verses waiting for their recitation", () => {
    const all = Array.from({ length: 12 }, (_, i) => `c1-s${i + 1}`);
    const text = renderToStaticMarkup(<AssemblyMissing data={read(all.filter((x) => x !== "c1-s8"), ["c1-s3"])} />).replace(/<[^>]+>/g, "");
    expect(text).toBe("باقي مشهد واحد غير معتمد: ٨. وبانتظار التلاوة (مشهد واحد): ٣.");
  });
  it("the server's refusal reads in Arabic with the scenes named", () => {
    expect(ownerMessage("All audiovisual scenes must be approved first; not approved yet: المشهد ٣, المشهد ٨."))
      .toBe("التجميع ينتظر اعتماد كل المشاهد؛ لم يُعتمد بعد: المشهد ٣، المشهد ٨.");
    expect(ownerMessage("This scene is approved; an edit to it re-opens it for a new production and review.")).toContain("يعيده وحده");
  });
});

const EPISODES = { balislam: "001-know-the-truth", "zubdat-alkutub": "001-awwal-marra-osalli", "dafatir-alzaman": "001-adam-beginning" } as const;
type Ch = keyof typeof EPISODES;
const planOf = (ch: Ch) => JSON.parse(panelSource(`channels/${ch}/episodes/${EPISODES[ch]}/plan.json`)) as Plan;
const channelOf = (ch: Ch) => channelInfo(JSON.parse(panelSource(`channels/${ch}/channel.json`)) as ChannelConfig);
const stepRead = (ch: Ch, plan: Plan, shown: string, shownApproved: boolean): SceneProductionRead => {
  const all = plan.chapters.flatMap((c) => c.scenes.map((s) => s.id));
  return {
    schemaVersion: 1, channel: ch, episode: EPISODES[ch], revision: 3,
    progress: { currentScene: all[0]!, approvedScenes: shownApproved ? 1 : 0, totalScenes: all.length, recitationPending: [],
      unapprovedScenes: all.filter((x) => !(shownApproved && x === shown)),
      canAssemble: false, assemblyApproved: false, masterApproved: false, publishAllowed: false },
    script: { sha256: h("a"), approved: true }, storyboard: { sha256: h("b"), approved: true },
    scenes: all.map((id) => id !== shown ? scene(id)
      : shownApproved ? scene(id, { status: "approved", approved: true, previewSha256: h("d") })
      : scene(id, { status: "in_review", previewSha256: h("d") })),
    prepared: { ready: 1, total: all.length }, assembly: null, seams: [], master: null,
    candidates: { scenes: { [shown]: h("d") }, assemblySha256: null, masterSha256: null },
  };
};
const stepHtml = (ch: Ch, shownAt: number, shownApproved: boolean) => {
  const plan = planOf(ch);
  const all = plan.chapters.flatMap((c) => c.scenes.map((s) => s.id));
  const shown = all[shownAt]!;
  const noop = () => {};
  return { shown, all, html: renderToStaticMarkup(
    <SceneProductionPanel episodeId="001" channelId={ch} plan={plan} channel={channelOf(ch)} initialRead={stepRead(ch, plan, shown, shownApproved)}
      viewSceneId={shown} media={{ voice: {} } as never} hasVoiceKeys={false}
      editor={() => <div>editor</div>} livePreview={() => <div>live</div>}
      onOpenScene={noop} onOpenStoryboard={noop} onOpenScript={noop} onOpenPublish={noop} onOpenFinal={noop} onOpenSettings={noop} />) };
};
const text = (html: string) => html.replace(/<svg[\s\S]*?<\/svg>/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

describe("step ٢ on the three channels: any scene is decided where it is", () => {
  for (const ch of Object.keys(EPISODES) as Ch[]) {
    it(`${ch}: scene 3 in review while 1 and 2 are not approved: «اعتمد المشهد» on it, no «waits for its turn»`, () => {
      const { html } = stepHtml(ch, 2, false);
      const t = text(html);
      expect(t).toContain("اعتمد المشهد");
      expect(t).toContain("جاهز للمراجعة");
      expect(t).not.toMatch(/يُعتمد بعد ما قبله|ينتظر دوره|تُعتمد بالترتيب|المراجعة بالترتيب/);
      expect(html).not.toMatch(/<button[^>]*disabled[^>]*>[^<]*اعتمد المشهد/);
      // the filmstrip states every scene by its own state
      expect(html).toContain("— لم يُنتج");
      expect(html).toContain("— جاهز للمراجعة");
    });
    it(`${ch}: an approved scene on screen says so and links to the next one not approved`, () => {
      const { html, all } = stepHtml(ch, 1, true);
      const t = text(html);
      expect(t).toContain("اعتُمد هذا المشهد. أي تعديل فيه يعيده وحده للمراجعة.");
      expect(t).toContain(`إلى المشهد ${(3).toLocaleString("ar-EG")} (غير معتمد)`);
      expect(all.length).toBeGreaterThan(2);
      expect(html).toContain("— معتمد");
    });
  }
});
