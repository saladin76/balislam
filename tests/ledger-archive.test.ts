import { describe, expect, it } from "vitest";
import os from "node:os";
import path from "node:path";
import { mkdtemp, mkdir, readdir, writeFile, readFile } from "node:fs/promises";
import {
  approveAssembly, approveFinalMaster, approveSceneAv, approveScript, approveStoryboard, createSceneFirstProduction,
  grantPublish, submitAssembly, submitSceneAvPreview, type SceneFirstProduction,
} from "../src/studio/sceneProduction";
import type { AuditEvent, SignedSceneLedger } from "../src/studio/sceneLedgerStore";
import {
  archiveEpochs, archivedEpoch, epochHolds, predictAfterDeletion, replayFromHistory, sameShown, shownStatus, staleCheck,
} from "../src/studio/ledgerArchive";
import { backupLedgers, pruneLedgerBackups, LEDGER_BACKUP_KEEP } from "../src/studio/ledgerBackup";

/**
 * D244 (حادثة تنظيف 001، ٢٨ نوفمبر): التنظيف بعد النشر لا يغيّر حالة الحلقة، والاسترجاع من الأحداث الموقّعة نفسها،
 * والتجربة بلا حذف تتوقف إن تغيّرت الحالة، والنسخة الاحتياطية للسجل تُبقي آخر ٣٠.
 */
const h = (c: string) => c.repeat(64).slice(0, 64);
const AT = "2026-11-25T04:00:00.000Z";
const ids = ["c1-s1", "c1-s2", "c1-s3"];

/** حلقة منشورة كاملة + أحداثها كما يسجّلها الاستوديو */
const published = () => {
  let p: SceneFirstProduction = createSceneFirstProduction({ channel: "dafatir-alzaman", episode: "001", scriptSha256: h("a"), storyboardSha256: h("b"),
    scenes: ids.map((id, i) => ({ id, sourceSha256: h(String(i + 1)) })) });
  p = approveScript(p, "owner", AT, h("a"));
  p = approveStoryboard(p, "owner", AT, h("b"));
  const history: AuditEvent[] = [];
  const ev = (action: string, resultSha256: string, sceneId?: string): AuditEvent =>
    ({ seq: history.length + 1, action: action as AuditEvent["action"], at: AT, by: "owner", resultSha256, note: "", ...(sceneId ? { sceneId } : {}) });
  ids.forEach((id, i) => {
    const prev = h(String.fromCharCode(100 + i));
    p = submitSceneAvPreview(p, id, h(String(i + 1)), prev);
    history.push(ev("submit-scene", prev, id));
    p = approveSceneAv(p, id, { by: "owner", at: AT, previewSha256: prev, watchedWithAudio: true });
    history.push(ev("approve-scene", prev, id));
  });
  p = submitAssembly(p, h("e")); history.push(ev("assemble", h("e")));
  p = approveAssembly(p, { by: "owner", at: AT, videoSha256: h("e") }); history.push(ev("approve-assembly", h("e")));
  p = approveFinalMaster(p, { by: "owner", at: AT, masterSha256: h("f"), assembledVideoSha256: h("e") }); history.push(ev("approve-master", h("f")));
  p = grantPublish(p, { by: "owner", at: AT, masterSha256: h("f") }); history.push(ev("grant-publish", h("f")));
  const doc: SignedSceneLedger = { version: 1, state: p, revision: 10, history, previewEpochs: Object.fromEntries(ids.map((id) => [id, `gen-${id}`])),
    assemblyEpoch: "gen-asm", masterEpoch: "gen-master", mac: h("0") };
  return doc;
};
const files = { scene: (id: string) => `/ep/previews/scene-${id}-av.mp4`, assembly: "/ep/previews/episode.mp4", master: "/ep/out/package/001-episode.mp4" };
const present = { scene: (id: string) => `gen-${id}`, assembly: "gen-asm", master: "gen-master" };
const allDeleted = new Set([...ids.map(files.scene), files.assembly, files.master]);

describe("D244: الأرشفة بعد النشر", () => {
  it("الجيل المؤرشف صالح والملف مفقود وحده؛ أي ملف يظهر مكانه يفتح المشهد", () => {
    expect(epochHolds(archivedEpoch(h("d")), "missing")).toBe(true);
    expect(epochHolds(archivedEpoch(h("d")), "gen-new")).toBe(false);
    expect(epochHolds("gen-x", "missing")).toBe(false);
    expect(epochHolds(undefined, "missing")).toBe(false);
  });

  it("حادثة 001: حذف الملفات بلا أرشفة يفتح المشاهد كلها ويسقط التجميع وMaster والنشر", () => {
    const doc = published();
    const after = predictAfterDeletion(doc, files, present, allDeleted, null);
    expect(shownStatus(after)).toEqual({ approvedScenes: 0, scenes: 3, assemblyApproved: false, master: null, published: null });
    expect(sameShown(doc.state, after)).toBe(false);
  });

  it("مع الأرشفة قبل الحذف تبقى الحالة كما هي (منشورة، والمشاهد معتمدة)", () => {
    const doc = published();
    const arch = archiveEpochs(doc, files, allDeleted, h("f"));
    expect(arch.archived).toEqual(ids);
    const after = predictAfterDeletion(doc, files, present, allDeleted, arch);
    expect(sameShown(doc.state, after)).toBe(true);
    expect(shownStatus(after).published).toBe(h("f"));
    // وبعد الحذف فعلًا: فحص الاستوديو بالأجيال المؤرشفة لا يغيّر شيئًا
    const missing = { scene: () => "missing", assembly: "missing", master: "missing" };
    expect(staleCheck({ ...doc, ...arch }, missing).stale).toBe(false);
  });

  it("لا أرشفة لـ Master إن لم تطابق النسخة الدائمة بصمته المعتمدة", () => {
    expect(() => archiveEpochs(published(), files, allDeleted, h("9"))).toThrow(/لا تطابق/);
  });
});

describe("D244: الاسترجاع من أحداث السجل الموقّعة", () => {
  it("يعيد بناء المشاهد والتجميع وMaster وإذن النشر كما كانت بالضبط", () => {
    const doc = published();
    const broken = staleCheck(doc, { scene: () => "missing", assembly: "missing", master: "missing" }).state;
    expect(shownStatus(broken).approvedScenes).toBe(0);
    const restored = replayFromHistory(broken, doc.history);
    expect(restored).toEqual(doc.state);
  });

  it("لا يضيف اعتمادًا ليس في السجل: مشهد آخر قرار عليه تصحيح يبقى كما هو، فلا سلسلة نشر متسقة", () => {
    const doc = published();
    const history = [...doc.history];
    history.splice(5, 1, { ...history[5]!, action: "correct-scene" }); // c1-s3: «النبرة غير مناسبة» بدل الاعتماد
    const broken = staleCheck(doc, { scene: () => "missing", assembly: "missing", master: "missing" }).state;
    expect(() => replayFromHistory(broken, history)).toThrow();
  });

  it("يرفض إن تغيّر مشهد بعد التجميع في السجل", () => {
    const doc = published();
    const history = [...doc.history, { seq: doc.history.length + 1, action: "submit-scene" as const, sceneId: "c1-s1", at: AT, by: "owner" as const, resultSha256: h("9"), note: "" }];
    expect(() => replayFromHistory(doc.state, history)).toThrow(/بعد التجميع|ترتيب/);
  });
});

describe("D244: نسخة السجل الاحتياطية", () => {
  it("تنسخ كل السجلات بايتًا ببايت وتُبقي آخر ٣٠ نسخة", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "ledger-bk-"));
    const share = await mkdtemp(path.join(os.tmpdir(), "share-"));
    for (const [ch, ep] of [["dafatir-alzaman", "001-a"], ["balislam", "002-b"]]) {
      await mkdir(path.join(root, "channels", ch!, "episodes", ep!), { recursive: true });
      await writeFile(path.join(root, "channels", ch!, "episodes", ep!, "scene-production.v1.json"), `{"ep":"${ep}"}`);
    }
    let last = "";
    for (let i = 0; i < LEDGER_BACKUP_KEEP + 3; i++) last = (await backupLedgers(root, share, "daily", new Date(Date.UTC(2026, 10, 1, 0, i)))).dir;
    const kept = await readdir(path.join(share, "backups", "ledger"));
    expect(kept.length).toBe(LEDGER_BACKUP_KEEP);
    expect(await readFile(path.join(last, "balislam", "002-b", "scene-production.v1.json"), "utf8")).toBe('{"ep":"002-b"}');
    expect(await pruneLedgerBackups(path.join(share, "backups", "ledger"))).toEqual([]);
  });

  it("بلا مجلد مشترك مركّب: ترمي (فلا تنظيف بلا نسخة)", async () => {
    await expect(backupLedgers(os.tmpdir(), "/no/such/share", "cleanup")).rejects.toThrow(/غير مركّب/);
  });
});
