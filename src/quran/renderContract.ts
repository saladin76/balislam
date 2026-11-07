/**
 * Fail-closed Quran audio → renderer contract, for integration by PR #73.
 * Never choose unverified global licensed recordings or missing audio.
 * These checks cannot grant publication rights or human listening approval.
 */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseScript } from "../script/parse";
import { quranFromScript } from "./scriptText";
import { verifiedOwnRecitations } from "./manualAudio";
import { QF_MAX_AGE_MS, recitationsDirFor, verifiedProviderPart, type RecitationIndex } from "./sync";
import { isCloudRecitation, requireCloudPublicationRights, type RecitationChoice } from "./provider";
import { isOwnedRegularAudio } from "../voice/audioIntegrity";
import type { EpisodeMedia } from "../plan/media";

export type AuthorizedRecitationPart = { file: string; duration: number; sha256: string };
export type AuthorizedRecitation = {
  file: string; duration: number; parts: AuthorizedRecitationPart[];
  reciter: string; source: "manual" | "quran-foundation" | "alquran-cloud";
};
export type AuthorizedRecitations = Record<string, AuthorizedRecitation>;
const validSha = (v: unknown): v is string =>
  typeof v === "string" && /^[a-f0-9]{64}$/.test(v);
const sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const close = (a: number, b: number) =>
  Number.isFinite(a) && Number.isFinite(b) && a > 0 && b > 0 &&
  Math.abs(a - b) <= Math.max(0.15, b * 0.03);
const present = (value: unknown) => typeof value === "string" && value.trim().length > 0;
/** A declared never-returning function lets strict TypeScript narrow after every rejection. */
function reject(reason: string): never {
  throw new Error("تم رفض تلاوة الرندر: " + reason);
}

/** Quran Foundation serves audio but does not automatically grant publication rights. */
export const assertReciterPublicationRights = (choice: RecitationChoice): true => {
  if (!choice || !present(choice.name)) reject("اسم القارئ غير موثق.");
  if (isCloudRecitation(choice)) {
    requireCloudPublicationRights(choice);
    const proof = choice.licence;
    if (!present(proof.verifiedBy) || !present(proof.reviewNote) || proof.reviewNote!.trim().length < 12)
      reject("تلاوة القارئ تحتاج اسم المراجع البشري وملاحظة تدقيق الحقوق قبل النشر.");
    return true;
  }
  const r = choice.licence;
  let https = false;
  try {
    const u = new URL(r?.evidence ?? "");
    https = u.protocol === "https:" && Boolean(u.hostname) && !u.username && !u.password;
  } catch { /* no proof */ }
  const when = Date.parse(r?.verifiedAt ?? "");
  if (!Number.isInteger(choice.id) || choice.id <= 0 || !r || !present(r.holder) ||
      !https || !present(r.scope) || !/youtube|يوتيوب/i.test(r.scope) ||
      !/publish|نشر|commercial|تجاري/i.test(r.scope) ||
      !Number.isFinite(when) || when > Date.now() + 60_000)
    reject("تسجيل Quran Foundation يحتاج دليل حقوق نشر مرتبطًا بالقارئ؛ جلب الصوت ليس إذن نشر.");
  if (!present(r.verifiedBy) || !present(r.reviewNote) || r.reviewNote!.trim().length < 12)
    reject("تلاوة القارئ تحتاج اسم المراجع البشري وملاحظة تدقيق الحقوق قبل النشر.");
  return true;
};

/** Select only reviewed recordings bound to script.md and current source. */
export const approvedRecitationsForRender = async (
  scriptPath: string, choice: RecitationChoice | undefined,
): Promise<AuthorizedRecitations> => {
  const parsed = parseScript(await readFile(scriptPath, "utf8"), scriptPath);
  const authored = quranFromScript(parsed);
  if (authored.problems.length) reject("مرجع الآية أو نصها في السكريبت غير صالح.");
  const keys = Object.keys(authored.texts);
  if (!keys.length) return {};
  const dir = recitationsDirFor(scriptPath);
  const index = JSON.parse(await readFile(path.join(dir, "index.json"), "utf8")) as RecitationIndex;
  if (!index || typeof index !== "object" || Array.isArray(index)) reject("فهرس التسجيلات غير صالح.");
  const manual = await verifiedOwnRecitations(scriptPath);
  const result: AuthorizedRecitations = {};
  for (const key of keys) {
    const entry = index[key];
    if (!entry) reject("تسجيل الآية " + key + " غير موجود.");
    if (entry.provider === "manual") {
      const approved = manual[key];
      if (!approved || !validSha(approved.sha256) ||
          !present(approved.reciter) || !present(approved.rightsEvidence) ||
          approved.rightsEvidence!.trim().length < 12 || approved.parts.length !== 1)
        reject("اعتماد التلاوة اليدوية أو دليل الحقوق أو البصمة للآية " + key + " غير صالح.");
      const part = approved.parts[0]!;
      result[key] = {
        file: part.file, duration: part.duration,
        parts: [{ file: part.file, duration: part.duration, sha256: approved.sha256 }],
        reciter: approved.reciter.trim(), source: "manual",
      };
      continue;
    }
    if (!choice) reject("القارئ المصرح به مفقود للآية " + key + ".");
    assertReciterPublicationRights(choice);
    const cloud = isCloudRecitation(choice);
    const matches = cloud
      ? entry.provider === "alquran-cloud" && entry.edition === choice.edition
      : entry.provider === "quran-foundation" && entry.recitationId === choice.id;
    const age = Date.now() - Date.parse(entry.fetchedAt ?? "");
    if (!matches || !present(entry.reciter) || entry.reciter !== choice.name ||
        !Array.isArray(entry.parts) || !entry.parts.length ||
        !Number.isFinite(age) || age < -60_000 || (!cloud && age >= QF_MAX_AGE_MS))
      reject("مصدر الآية " + key + " لا يطابق اختيار القارئ أو صلاحية التسجيل.");
    const parts: AuthorizedRecitationPart[] = [];
    for (const part of entry.parts) {
      if (!validSha(part.sha256) || !(await verifiedProviderPart(dir, part)))
        reject("ملف الآية " + key + " فاسد أو بلا بصمة صحيحة.");
      parts.push({ file: part.file, duration: part.duration, sha256: part.sha256 });
    }
    result[key] = {
      file: parts[0]!.file, duration: parts.reduce((n, part) => n + part.duration, 0),
      parts, reciter: entry.reciter.trim(), source: cloud ? "alquran-cloud" : "quran-foundation",
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
