/**
 * D233 (قرار المالك): كل حلقة تُرندر كاملة على جهاز واحد، ولا تُخلط مشاهد من الجهازين في حلقة واحدة.
 * السبب: Chrome على ويندوز يرسم النص العربي أنزل ببضعة بكسلات من Chrome على الماك، فيقفز النص عند الوصلات.
 *
 * مصدر كل قطعة مشهد: اسم جهاز العامل من result.json (`worker`) لما رُندر على الويندوز، و«mac» لما رُندر على الماك
 * أو لا مصدر له. التجميع و«قبل النهائية» وMaster، على الماك وعلى الويندوز، تُرفض إن جاءت قطع الحلقة من أكثر من جهاز.
 * على الماك يُقرأ المصدر من previews/scene-provenance.json (يكتبه استيراد نواتج العامل؛ ما ليس فيه = «mac»).
 */
import path from "node:path";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createReadStream, existsSync } from "node:fs";

export const MAC_MACHINE = "mac";
export type SceneMachine = { sceneId: string; machine: string; commit?: string };
export type ProvenanceFile = { version: 1; scenes: Record<string, { machine: string; commit?: string; sha256?: string }> };

/** جهاز القطعة من نتيجة العامل؛ بلا نتيجة أو بلا اسم جهاز = الماك. */
export const machineOfResult = (result: { worker?: unknown } | null | undefined): string =>
  typeof result?.worker === "string" && result.worker.trim() ? result.worker.trim() : MAC_MACHINE;

export const provenanceFile = (previewsDir: string) => path.join(previewsDir, "scene-provenance.json");

/** مصدر قطع مشاهد الماك (المعاينات): من scene-provenance.json؛ ما ليس فيه أو لا تطابق بصمته الملف الحالي = «mac». */
export const previewMachines = async (previewsDir: string, cuts: { sceneId: string; sha256?: string }[]): Promise<SceneMachine[]> => {
  let file: ProvenanceFile | null = null;
  try { file = JSON.parse(await readFile(provenanceFile(previewsDir), "utf8")) as ProvenanceFile; } catch { file = null; }
  return cuts.map((c) => {
    const p = file?.scenes?.[c.sceneId];
    const same = p && (!p.sha256 || !c.sha256 || p.sha256 === c.sha256);
    return same && typeof p.machine === "string" && p.machine.trim()
      ? { sceneId: c.sceneId, machine: p.machine.trim(), ...(p.commit ? { commit: p.commit } : {}) }
      : { sceneId: c.sceneId, machine: MAC_MACHINE };
  });
};

/**
 * مصدر قطع مشاهد حلقة على الماك (previews/scene-<id>-av.mp4) لـMaster: ما ليس في scene-provenance.json = «mac»؛
 * وما فيه يُحسب لجهازه ما دامت بصمة الملف الحالي هي المسجلة (قطعة أُعيد رندرها على الماك بعدها = «mac»).
 */
export const episodeSceneMachines = async (previewsDir: string, sceneIds: string[]): Promise<SceneMachine[]> => {
  let file: ProvenanceFile | null = null;
  try { file = JSON.parse(await readFile(provenanceFile(previewsDir), "utf8")) as ProvenanceFile; } catch { file = null; }
  const cuts: { sceneId: string; sha256?: string }[] = [];
  for (const id of sceneIds) {
    const p = file?.scenes?.[id];
    let sha: string | undefined;
    if (p?.sha256) {
      const f = path.join(previewsDir, `scene-${id}-av.mp4`);
      sha = existsSync(f) ? await sha256Of(f) : "missing";
    }
    cuts.push({ sceneId: id, ...(sha ? { sha256: sha } : {}) });
  }
  return previewMachines(previewsDir, cuts);
};
const sha256Of = (file: string) => new Promise<string>((resolve, reject) => {
  const h = createHash("sha256");
  createReadStream(file).on("data", (d) => h.update(d)).on("error", reject).on("end", () => resolve(h.digest("hex")));
});

/**
 * D232 (phase 2): the import of a worker scene cut records where it was rendered, bound to the exact bytes now in
 * previews/scene-<id>-av.mp4. A later Mac render of the scene changes the bytes, so the record no longer counts.
 */
export const recordPreviewProvenance = async (previewsDir: string, sceneId: string, entry: { machine: string; commit?: string; sha256: string }) => {
  let file: ProvenanceFile = { version: 1, scenes: {} };
  try {
    const cur = JSON.parse(await readFile(provenanceFile(previewsDir), "utf8")) as ProvenanceFile;
    if (cur?.version === 1 && cur.scenes && typeof cur.scenes === "object") file = cur;
  } catch { /* first record */ }
  file.scenes[sceneId] = { machine: entry.machine, ...(entry.commit ? { commit: entry.commit } : {}), sha256: entry.sha256 };
  await mkdir(previewsDir, { recursive: true });
  const tmp = `${provenanceFile(previewsDir)}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tmp, JSON.stringify(file, null, 1) + "\n");
  await rename(tmp, provenanceFile(previewsDir));
};

const label = (m: string) => (m === MAC_MACHINE ? "الماك" : `جهاز الرندر «${m}»`);

/**
 * يرمي برسالة عربية إن جاءت قطع الحلقة من أكثر من جهاز: المشاهد وأجهزتها، وإعادة رندر الشاذة على جهاز الأغلبية.
 * يعيد الجهاز الوحيد (أو null بلا مشاهد).
 */
export const assertOneMachine = (scenes: SceneMachine[], what: string): string | null => {
  const by = new Map<string, string[]>();
  for (const s of scenes) by.set(s.machine, [...(by.get(s.machine) ?? []), s.sceneId]);
  if (by.size <= 1) return scenes[0]?.machine ?? null;
  const groups = [...by.entries()].sort((a, b) => b[1].length - a[1].length);
  const main = groups[0]!;
  const odd = groups.slice(1);
  throw new Error(
    `لا ${what}: مشاهد الحلقة رُندرت على أكثر من جهاز (D233: كل حلقة تُرندر كاملة على جهاز واحد، لأن النص العربي يُرسم بإزاحة مختلفة على كل جهاز).\n` +
    groups.map(([m, ids]) => `- ${label(m)} (${ids.length}): ${ids.join("، ")}`).join("\n") +
    `\nأعد رندر ${odd.map(([m, ids]) => `${ids.join("، ")} (رُندرت على ${label(m)})`).join("، و")} على ${label(main[0])}، ثم أعد المحاولة.`,
  );
};
