/**
 * D232 (سارٍ، اعتمده المالك ٢٧ نوفمبر): الماك لا يرندر. كل الرندر على جهاز الويندوز، والماك احتياطي للطوارئ وحده
 * «وبإذني كل مرة» (نص المالك). فكل رندر فيديو على الماك (Remotion أو وصل ffmpeg) يستهلك إذنًا صريحًا لمرة واحدة:
 *
 * - الإذن ملف محلي لا يُرفع (`renders/mac-render-permit.json`، و`BAL_MAC_RENDER_PERMIT_FILE` للاختبارات) يكتبه
 *   `npx bal mac-render-permit --owner-words "<نص إذن المالك>"` بعد أن يأذن المالك بنفسه في هذه المرة.
 * - فيه: نص إذن المالك، وعدد مرات الرندر (الافتراضي ١)، وانتهاء الصلاحية (الافتراضي ٦٠ دقيقة)، والحلقة إن حُددت.
 * - كل رندر يستهلك مرة قبل أن يبدأ (نقل ذري، فلا يستهلك رندران متزامنان المرة نفسها)، ويُسجَّل في
 *   `renders/mac-render-permits.log.jsonl`. إذن منتهٍ أو مستهلَك أو لحلقة أخرى = رفض برسالة عربية.
 * - العامل (ويندوز) لا يحتاج إذنًا: هو جهاز الرندر. والفحص على الماك وحده (`process.platform === "darwin"`).
 * - الصور الثابتة الصغيرة (إطارات الستوري بورد والهوية والغلاف) خارج هذا الإذن إلى أن يُنفَّذ نوعها على العامل.
 */
import path from "node:path";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { appendFile, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { projectRoot } from "../config/paths";

export type MacRenderPermit = {
  ownerWords: string;
  grantedAt: string;
  expiresAt: string;
  uses: number;
  /** مجلد الحلقة (مثل 001-…) أو رقمها؛ بلا قيمة = أي حلقة */
  episode?: string;
};

export const permitFile = () => process.env.BAL_MAC_RENDER_PERMIT_FILE || path.join(projectRoot, "renders", "mac-render-permit.json");
const permitLog = () => path.join(path.dirname(permitFile()), "mac-render-permits.log.jsonl");

/** هل هذا الجهاز هو الماك (لا جهاز الرندر)؟ */
export const isMacHost = (platform: NodeJS.Platform = process.platform) => platform === "darwin";

export const MAC_RENDER_REFUSED = "D232: الماك لا يرندر. المهمة لجهاز الرندر (الويندوز)؛ والرندر على الماك للطوارئ وحدها وبإذن المالك الصريح في كل مرة";

export const grantMacRenderPermit = async (o: { ownerWords: string; uses?: number; minutes?: number; episode?: string; now?: Date }) => {
  const words = o.ownerWords.trim();
  if (words.length < 4) throw new Error("نص إذن المالك مطلوب كما قاله (مثل «اسمح بالرندر على الماك هذه المرة»).");
  const uses = o.uses ?? 1;
  const minutes = o.minutes ?? 60;
  if (!Number.isInteger(uses) || uses < 1 || uses > 50) throw new Error("عدد مرات الرندر بين ١ و٥٠.");
  if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 24 * 60) throw new Error("مدة الإذن بالدقائق بين ١ و١٤٤٠.");
  const now = o.now ?? new Date();
  const permit: MacRenderPermit = { ownerWords: words, grantedAt: now.toISOString(), expiresAt: new Date(now.getTime() + minutes * 60_000).toISOString(), uses,
    ...(o.episode ? { episode: o.episode } : {}) };
  await mkdir(path.dirname(permitFile()), { recursive: true });
  const tmp = `${permitFile()}.${randomUUID()}.tmp`;
  await writeFile(tmp, JSON.stringify(permit, null, 1) + "\n");
  await rename(tmp, permitFile());
  await appendFile(permitLog(), JSON.stringify({ event: "granted", ...permit }) + "\n");
  return permit;
};

export const revokeMacRenderPermit = async () => {
  if (!existsSync(permitFile())) return false;
  await rm(permitFile(), { force: true });
  await appendFile(permitLog(), JSON.stringify({ event: "revoked", at: new Date().toISOString() }) + "\n");
  return true;
};

export const readMacRenderPermit = async (): Promise<MacRenderPermit | null> => {
  try { return JSON.parse(await readFile(permitFile(), "utf8")) as MacRenderPermit; } catch { return null; }
};

const episodeMatches = (permit: string | undefined, episode: string | undefined) =>
  !permit || (!!episode && (episode === permit || episode.slice(0, 3) === permit.slice(0, 3)));

/**
 * قبل أي رندر فيديو: على جهاز الرندر لا شيء؛ وعلى الماك يستهلك مرة من الإذن أو يرفض.
 * `what` وصف الرندر للسجل والرسالة، و`episode` مجلد الحلقة أو رقمها.
 */
export const consumeMacRenderPermit = async (what: string, o: { episode?: string; platform?: NodeJS.Platform; now?: Date } = {}): Promise<void> => {
  if (!isMacHost(o.platform)) return;
  const file = permitFile();
  const claimed = `${file}.${randomUUID()}.claim`;
  // النقل الذري: من ينقل الملف أولًا يملكه؛ والآخر لا يجده فيُرفض أو يعيد المحاولة بعد أن يُعاد
  try { await rename(file, claimed); } catch { throw new Error(`${MAC_RENDER_REFUSED} (لا إذن الآن: ${what}).`); }
  let permit: MacRenderPermit | null = null;
  try { permit = JSON.parse(await readFile(claimed, "utf8")) as MacRenderPermit; } catch { permit = null; }
  const now = o.now ?? new Date();
  const why = !permit || typeof permit.ownerWords !== "string" || !permit.ownerWords.trim() ? "الإذن تالف أو بلا نص المالك"
    : !(Date.parse(permit.expiresAt) > now.getTime()) ? "انتهت صلاحية الإذن"
    : !(Number.isInteger(permit.uses) && permit.uses >= 1) ? "استُهلك الإذن"
    : !episodeMatches(permit.episode, o.episode) ? `الإذن لحلقة أخرى (${permit.episode})`
    : null;
  if (why) {
    await rm(claimed, { force: true });
    await appendFile(permitLog(), JSON.stringify({ event: "refused", what, episode: o.episode ?? null, why, at: now.toISOString() }) + "\n").catch(() => undefined);
    throw new Error(`${MAC_RENDER_REFUSED} (${why}: ${what}).`);
  }
  const left = permit!.uses - 1;
  if (left > 0) await writeFile(claimed, JSON.stringify({ ...permit, uses: left }, null, 1) + "\n").then(() => rename(claimed, file));
  else await rm(claimed, { force: true });
  await appendFile(permitLog(), JSON.stringify({ event: "used", what, episode: o.episode ?? null, ownerWords: permit!.ownerWords, left, at: now.toISOString() }) + "\n");
};
