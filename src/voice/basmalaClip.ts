import path from "node:path";
import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, rename, stat } from "node:fs/promises";
import { projectRoot } from "../config/paths";
import { APPROVED_BASMALA_CLIP } from "./basmala";
import { assertApprovedBasmalaAudio } from "./quranGuard";

/**
 * D239 (owner decision 27 Nov 2026): the one approved basmala clip on the owner's machine.
 *
 * - Location: `assets/recitations/basmala/approved-basmala-v4.mp3` under the studio checkout (git-ignored by
 *   `assets/recitations/**\/*.mp3`; audio never enters git, D101). `BAL_BASMALA_CLIP` may point elsewhere (tests).
 * - `installBasmalaClip` copies a file there only when its bytes match the pinned sha256 (`assertApprovedBasmalaAudio`).
 * - `installedBasmalaClip` returns the clip only while the bytes on disk still match; otherwise the basmala scenes stay
 *   «مشروطة» exactly as before, with `reason` saying why.
 * Nothing here calls the voice service: the basmala is never generated.
 */
export const basmalaClipPath = (): string =>
  process.env.BAL_BASMALA_CLIP?.trim() || path.join(projectRoot, "assets", "recitations", "basmala", APPROVED_BASMALA_CLIP.file);

const sha256Of = async (file: string) => createHash("sha256").update(await readFile(file)).digest("hex");

export type BasmalaClipStatus =
  | { installed: true; path: string; file: string; sha256: string }
  | { installed: false; reason: string };

export const MISSING_CLIP = "نسخة البسملة المعتمدة (D239) غير مثبّتة على هذا الجهاز، فيبقى مشهدها مشروطًا كما كان. ثبّتها بالأمر: npx bal basmala install <الملف>";
export const MISMATCH_CLIP = "ملف البسملة المثبّت لا تطابق بصمته النسخة المعتمدة (D239)، فلا يُستعمل ويبقى مشهدها مشروطًا كما كان. أعد تثبيت الملف المعتمد: npx bal basmala install <الملف>";

/** The installed approved clip, verified byte for byte against the pinned sha256 on every call. */
export const basmalaClipStatus = async (): Promise<BasmalaClipStatus> => {
  const file = basmalaClipPath();
  let sha: string;
  try {
    if (!(await stat(file)).isFile()) return { installed: false, reason: MISSING_CLIP };
    sha = await sha256Of(file);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return { installed: false, reason: MISSING_CLIP };
    throw e;
  }
  try { assertApprovedBasmalaAudio(sha); } catch { return { installed: false, reason: MISMATCH_CLIP }; }
  return { installed: true, path: file, file: path.basename(file), sha256: sha };
};

export const installedBasmalaClip = async () => {
  const s = await basmalaClipStatus();
  return s.installed ? s : undefined;
};

/** Copy the owner-approved clip into place after verifying its bytes (refuses any other file). */
export const installBasmalaClip = async (source: string): Promise<{ path: string; sha256: string }> => {
  const sha = await sha256Of(source);
  assertApprovedBasmalaAudio(sha, path.basename(source));
  const dest = basmalaClipPath();
  await mkdir(path.dirname(dest), { recursive: true });
  const tmp = `${dest}.${process.pid}.tmp`;
  await copyFile(source, tmp);
  if (await sha256Of(tmp) !== sha) throw Error("تغيّر الملف أثناء النسخ؛ لم يُثبَّت شيء.");
  await rename(tmp, dest);
  return { path: dest, sha256: sha };
};

export type ApplyResult =
  | { episode: string; status: "own-recording" | "no-basmala" | "up-to-date" }
  | { episode: string; status: "recomposed"; scenes: string[] };

/**
 * Compose an episode's basmala scenes again with the approved clip (free: no voice request). An episode with its own
 * approved basmala recording is left exactly as it is (its ledger, fingerprints, assembly, Master and permission),
 * and so is one already composed with the clip. Re-composed scenes re-open alone for the owner's review.
 */
export const applyBasmalaClip = async (episode: string): Promise<ApplyResult> => {
  const { resolveScriptPath } = await import("../script/episodes");
  const { verifiedOwnRecitations } = await import("../quran/manualAudio");
  const { basmalaScenes } = await import("./sentenceContext");
  const { loadVoiceIndex } = await import("./generate");
  const { BASMALA_KEY } = await import("./basmala");
  const scriptPath = await resolveScriptPath(episode);
  if ((await verifiedOwnRecitations(scriptPath))[BASMALA_KEY]) return { episode, status: "own-recording" };
  const scenes = await basmalaScenes(scriptPath);
  if (!scenes.length) return { episode, status: "no-basmala" };
  const st = await basmalaClipStatus();
  if (!st.installed) throw Error(st.reason);
  const voice = await loadVoiceIndex(episode);
  if (scenes.every((id) => voice[id]?.basmala?.pending === false && voice[id]?.basmala?.sha256 === st.sha256)) return { episode, status: "up-to-date" };
  const { recomposeBasmalaScenes } = await import("./sentenceVoice");
  return { episode, status: "recomposed", scenes: await recomposeBasmalaScenes(episode) };
};
