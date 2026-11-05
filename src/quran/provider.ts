import path from "node:path";
import { readFile, mkdir, rename, rm, writeFile } from "node:fs/promises";

/** Explicit, rights-gated production source. A preview selection is NOT a publishing licence. */
export type CloudRecitation = {
  provider: "alquran-cloud";
  edition: string;
  name: string;
  licence: { holder: string; evidence: string; scope: string; verifiedAt: string };
};
export type FoundationRecitation = { id: number; name: string; provider?: "quran-foundation" };
export type RecitationChoice = CloudRecitation | FoundationRecitation;

export const isCloudRecitation = (value: RecitationChoice | undefined): value is CloudRecitation =>
  value?.provider === "alquran-cloud";

export const requireCloudPublicationRights = (recitation: CloudRecitation): void => {
  const l = recitation.licence;
  if (!/^ar\.[a-z0-9._-]{1,75}$/i.test(recitation.edition))
    throw new Error("معرّف قارئ AlQuran Cloud غير صالح.");
  let evidenceIsHttps = false;
  try { const u = new URL(l?.evidence ?? ""); evidenceIsHttps = u.protocol === "https:" && !!u.hostname && !u.username && !u.password; }
  catch { evidenceIsHttps = false; }
  if (!l || !l.holder?.trim() || !evidenceIsHttps || !l.scope?.trim() ||
      !l.verifiedAt || !Number.isFinite(Date.parse(l.verifiedAt)) ||
      !/youtube|يوتيوب/i.test(l.scope) || !/نشر|publish|commercial|تجاري/i.test(l.scope))
    throw new Error("لا يُدرج تسجيل AlQuran Cloud في الرندر دون رابط إذن HTTPS موثق وصاحب حقوق ونطاق نشر يوتيوب لهذا التسجيل.");
};

export const recitationIdentity = (recitation: RecitationChoice): string =>
  isCloudRecitation(recitation) ? `cloud-${recitation.edition}` : `qf-${recitation.id}`;

/** Episode-only override lives inside the gitignored recitations folder, NOT plan.json or channel.json. */
export const episodeRecitationFile = (scriptPath: string) =>
  path.join(path.dirname(scriptPath), "recitations", "source.json");

export const readEpisodeRecitation = async (scriptPath: string): Promise<CloudRecitation | null> => {
  let content: string;
  try { content = await readFile(episodeRecitationFile(scriptPath), "utf8"); }
  catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
  let data: unknown;
  try { data = JSON.parse(content); } catch { throw new Error("ملف اختيار قارئ الحلقة غير صالح."); }
  const value = data as { version?: number; recitation?: CloudRecitation };
  if (value?.version !== 1 || !value.recitation || !isCloudRecitation(value.recitation))
    throw new Error("اختيار قارئ الحلقة غير صالح.");
  requireCloudPublicationRights(value.recitation);
  return value.recitation;
};

export const activeRecitation = async (scriptPath: string, channelChoice: RecitationChoice | undefined) =>
  (await readEpisodeRecitation(scriptPath)) ?? channelChoice;

/** Explicit user request only. Null reverts this episode to the channel default. */
export const saveEpisodeRecitation = async (scriptPath: string, choice: CloudRecitation | null) => {
  const target = episodeRecitationFile(scriptPath);
  if (!choice) { await rm(target, { force: true }); return; }
  if (!isCloudRecitation(choice)) throw new Error("مصدر القارئ المطلوب غير صالح.");
  requireCloudPublicationRights(choice);
  await mkdir(path.dirname(target), { recursive: true });
  const temp = target + ".tmp";
  try {
    await writeFile(temp, JSON.stringify({ version: 1, recitation: choice }, null, 2) + "\n", { mode: 0o600 });
    await rename(temp, target);
  } finally { await rm(temp, { force: true }); }
};
