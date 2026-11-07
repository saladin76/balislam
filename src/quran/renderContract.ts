/**
 * Owner-supplied, human-reviewed Quran recitation contract.
 * No external Quran provider, TTS or shared-library fallback is eligible.
 * These checks are not substitutes for trusted workflow/scene AV signoffs.
 */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseScript } from "../script/parse";
import { quranFromScript } from "./scriptText";
import { verifiedOwnRecitations } from "./manualAudio";
import { isOwnedRegularAudio } from "../voice/audioIntegrity";
import type { EpisodeMedia } from "../plan/media";

export type AuthorizedRecitationPart = { file: string; duration: number; sha256: string };
export type AuthorizedRecitation = {
  file: string; duration: number; parts: AuthorizedRecitationPart[];
  reciter: string; source: "manual";
};
export type AuthorizedRecitations = Record<string, AuthorizedRecitation>;
const validSha = (v: unknown): v is string =>
  typeof v === "string" && /^[a-f0-9]{64}$/.test(v);
const sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const close = (a: number, b: number) =>
  Number.isFinite(a) && Number.isFinite(b) && a > 0 && b > 0 &&
  Math.abs(a - b) <= Math.max(0.15, b * 0.03);
const present = (value: unknown) => typeof value === "string" && value.trim().length > 0;
function reject(reason: string): never {
  throw new Error("تم رفض تلاوة الرندر: " + reason);
}

/** Compatibility-only fail-closed export. External reciters are retired. */
export const assertReciterPublicationRights = (_choice: unknown): true =>
  reject("أُلغيت خدمات القراء الخارجية؛ ارفع التلاوة البشرية إلى ملفات الحلقة وراجعها.");

/** Select only current, human-approved, episode-owned recordings bound to script.md. */
export const approvedRecitationsForRender = async (
  scriptPath: string, choice?: unknown,
): Promise<AuthorizedRecitations> => {
  if (choice !== undefined && choice !== null)
    reject("لا يُسمح باختيار مصدر تلاوة خارجي؛ استخدم التسجيل الذي قدّمه صاحب المشروع.");
  const parsed = parseScript(await readFile(scriptPath, "utf8"), scriptPath);
  const authored = quranFromScript(parsed);
  if (authored.problems.length) reject("مرجع الآية أو نصها في السكريبت غير صالح.");
  const keys = Object.keys(authored.texts);
  if (!keys.length) return {};

  const manual = await verifiedOwnRecitations(scriptPath);
  const result: AuthorizedRecitations = {};
  for (const key of keys) {
    const approved = manual[key];
    if (!approved || approved.provider !== "manual" ||
        !validSha(approved.sha256) || !present(approved.reciter) ||
        !present(approved.rightsEvidence) || !approved.approvedBy?.trim() ||
        !approved.reviewNote?.trim() || approved.reviewNote.trim().length < 12 ||
        approved.rightsEvidence!.trim().length < 12 || approved.parts.length !== 1)
      reject("التلاوة اليدوية للآية " + key + " غير موجودة أو غير معتمدة أو تفتقد حقوق المصدر.");
    const part = approved.parts[0]!;
    result[key] = {
      file: part.file, duration: part.duration,
      parts: [{ file: part.file, duration: part.duration, sha256: approved.sha256 }],
      reciter: approved.reciter.trim(), source: "manual",
    };
  }
  return result;
};

/**
 * Renderer PR #73: call AFTER collecting/staging and BEFORE bundle consumption;
 * repeat for direct renders, queue recovery and final Master publication.
 * ALSO call verifyStagedMedia(root, media.base) to verify the snapshot manifest.
 */
export const assertRenderedRecitationsMatchApprovals = async (
  scriptPath: string, choice: RecitationChoice | undefined,
  media: Pick<EpisodeMedia, "base" | "mode" | "recitations">,
  privateStageRoot: string,
): Promise<true> => {
  const expected = await approvedRecitationsForRender(scriptPath, choice);
  const episode = path.basename(path.dirname(scriptPath));
  const channel = path.basename(path.dirname(path.dirname(path.dirname(scriptPath))));
  const prefix = "_render/" + channel + "/" + episode + "/";
  if (media.mode !== "static" ||
      !/^_render\/[a-z0-9]+(?:-[a-z0-9]+)*\/[0-9]{3}-[a-z0-9]+(?:-[a-z0-9]+)*\/[a-f0-9]{24}\/$/.test(media.base) ||
      !media.base.startsWith(prefix))
    reject("لقطة الوسائط لا تخص الحلقة والقناة.");
  const actual = media.recitations;
  const keys = Object.keys(expected).sort();
  if (!actual || JSON.stringify(Object.keys(actual).sort()) !== JSON.stringify(keys))
    reject("مجموعة الآيات المعروضة لا تطابق نص السكريبت.");
  const root = path.join(privateStageRoot, media.base, "recitations");
  for (const key of keys) {
    const ok = expected[key]!;
    const received = actual[key];
    if (!received || received.source !== ok.source || received.reciter !== ok.reciter ||
        received.file !== ok.file || !close(received.duration, ok.duration) ||
        !Array.isArray(received.parts) || received.parts.length !== ok.parts.length)
      reject("تلاوة الآية " + key + " ليست التسجيل المختار والمعتمد.");
    for (let i = 0; i < ok.parts.length; i++) {
      const part = ok.parts[i]!;
      const selected = received.parts[i];
      if (!selected || selected.file !== part.file || !validSha(selected.sha256) ||
          selected.sha256 !== part.sha256 || !close(selected.duration, part.duration) ||
          !await isOwnedRegularAudio(root, part.file))
        reject("تلاوة الآية " + key + " لم تُنقل إلى الرندر ببصمتها المعتمدة.");
      const bytes = await readFile(path.join(root, part.file));
      if (sha(bytes) !== part.sha256)
        reject("تلاوة الآية " + key + " تغيّرت بعد مراجعتها أو أثناء النقل.");
    }
  }
  return true;
};
