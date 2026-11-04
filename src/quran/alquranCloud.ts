/** AlQuran Cloud optional ayah-level Quran text/audio preview.
 * No local writes; public access is not a licence for video publication.
 * Docs: https://alquran.cloud/api and https://alquran.cloud/terms-and-conditions
 */
export const ALQURAN_API = "https://api.alquran.cloud/v1";
export class AlQuranError extends Error {}
export type AudioEdition = { identifier: string; name: string };
export type AyahPreview = { surah: number; ayah: number; text: string; audio: string; reciter: string; rightsVerified: false; publicationAllowed: false };

const validNumber = (v: number, max: number) => Number.isSafeInteger(v) && v >= 1 && v <= max;
const validEdition = (v: string) => /^ar\.[a-z0-9._-]{1,75}$/i.test(v);
const safeAudio = (raw: unknown) => {
  if (typeof raw !== "string") throw new AlQuranError("لم يرجع رابط صوت صالح.");
  let u: URL;
  try { u = new URL(raw); } catch { throw new AlQuranError("رابط الصوت غير صالح."); }
  if (u.protocol !== "https:" || u.hostname !== "cdn.islamic.network" || u.port || u.username || u.password || u.hash ||
      !/^\/quran\/audio\/(?:32|40|48|64|128|192)\/ar\.[a-z0-9._-]+\/\d+\.mp3$/i.test(u.pathname))
    throw new AlQuranError("رابط التلاوة لا ينتمي إلى خادم AlQuran Cloud المسموح.");
  return u.href;
};

export const createAlQuranClient = (fetchImpl: typeof fetch = fetch) => {
  const get = async (p: string): Promise<unknown> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetchImpl(`${ALQURAN_API}${p}`, { signal: controller.signal, headers: { accept: "application/json" } });
      if (!response.ok) throw new AlQuranError(`خدمة AlQuran Cloud غير متاحة حاليًا (${response.status}).`);
      const json: unknown = await response.json();
      if (!json || typeof json !== "object" || (json as any).code !== 200 || !(json as any).data)
        throw new AlQuranError("استجابة خدمة القرآن غير صالحة.");
      return (json as any).data;
    } catch (e) {
      if (e instanceof AlQuranError) throw e;
      throw new AlQuranError("تعذّر الاتصال بخدمة AlQuran Cloud.");
    } finally { clearTimeout(timer); }
  };
  const editions = async (): Promise<AudioEdition[]> => {
    const data = await get("/edition/format/audio");
    if (!Array.isArray(data)) throw new AlQuranError("قائمة القرّاء غير صالحة.");
    return data.flatMap((e: any) => (
      typeof e?.identifier === "string" && validEdition(e.identifier) && typeof e?.name === "string" && e.name.trim()
        ? [{ identifier: e.identifier, name: e.name.slice(0, 160) }] : []
    ));
  };
  const ayah = async (surah: number, number: number, edition: string): Promise<AyahPreview> => {
    if (!validNumber(surah, 114) || !validNumber(number, 286) || !validEdition(edition))
      throw new AlQuranError("رقم السورة أو الآية أو القارئ غير صالح.");
    const ref = `${surah}:${number}`;
    const text = await get(`/ayah/${ref}/quran-uthmani`) as any;
    const audio = await get(`/ayah/${ref}/${encodeURIComponent(edition)}`) as any;
    const same = (a: any) => a?.surah?.number === surah && a?.numberInSurah === number;
    if (!same(text) || !same(audio) || typeof text?.text !== "string" || !text.text.trim())
      throw new AlQuranError("نص الآية أو التلاوة لا يطابق المرجع المطلوب.");
    return { surah, ayah: number, text: text.text, audio: safeAudio(audio.audio), reciter: edition, rightsVerified: false, publicationAllowed: false };
  };
  return { editions, ayah };
};
