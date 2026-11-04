/**
 * MP3Quran v3 public catalogue adapter.
 * Browse-only: no automatic downloads, no edits to recitations/index.json,
 * and no assumption that API access grants publication rights.
 * Documentation: https://www.mp3quran.net/ar/api
 */
export const MP3QURAN_API = "https://www.mp3quran.net/api/v3";

export type Mp3QuranMoshaf = {
  id: number;
  name: string;
  server: string;
  surah_total: number;
  surah_list: string;
};
export type Mp3QuranReciter = {
  id: number;
  name: string;
  moshaf: Mp3QuranMoshaf[];
};
export type Mp3QuranSurah = { id: number; name: string };

export class Mp3QuranError extends Error {}

const boundedNumber = (value: unknown, max: number) =>
  Number.isSafeInteger(Number(value)) && Number(value) >= 1 && Number(value) <= max ? Number(value) : null;

const safeText = (s: unknown) => typeof s === "string" ? s.slice(0, 180) : "";

const allowedServer = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  try {
    const u = new URL(value);
    // Do not use remote metadata as a general-purpose fetch proxy.
    // The API catalogue has historically used serverN.mp3quran.net.
    if (u.protocol !== "https:" || u.username || u.password ||
      !/^(?:server\d+\.)mp3quran\.net$/.test(u.hostname) ||
      u.port || u.search || u.hash) return null;
    return u.href.endsWith("/") ? u.href : u.href + "/";
  } catch { return null; }
};

export const createMp3QuranClient = (fetchImpl: typeof fetch = fetch) => {
  const get = async (resource: "reciters" | "suwar") => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetchImpl(`${MP3QURAN_API}/${resource}?language=ar`, {
        signal: controller.signal,
        headers: { accept: "application/json" },
      });
      if (!response.ok) throw new Mp3QuranError(`تعذّر الاتصال بمكتبة MP3Quran (${response.status}).`);
      return (await response.json()) as Record<string, unknown>;
    } catch (error) {
      if (error instanceof Mp3QuranError) throw error;
      throw new Mp3QuranError("تعذّر جلب بيانات MP3Quran. تحقق من الاتصال وحاول مرة أخرى.");
    } finally { clearTimeout(timeout); }
  };
  const reciters = async (): Promise<Mp3QuranReciter[]> => {
    const data = await get("reciters");
    if (!Array.isArray(data.reciters)) throw new Mp3QuranError("استجابة القراء غير صالحة.");
    return data.reciters.flatMap((r: any) => {
      const id = boundedNumber(r?.id, 100000);
      if (!id || !safeText(r?.name) || !Array.isArray(r?.moshaf)) return [];
      const moshaf = r.moshaf.flatMap((m: any) => {
        const mid = boundedNumber(m?.id, 100000);
        const server = allowedServer(m?.server);
        if (!mid || !server) return [];
        return [{
          id: mid, name: safeText(m?.name), server,
          surah_total: Math.max(0, Math.min(114, Number(m?.surah_total) || 0)),
          surah_list: String(m?.surah_list ?? "").slice(0, 700),
        }];
      });
      return [{ id, name: safeText(r.name), moshaf }];
    });
  };
  const suwar = async (): Promise<Mp3QuranSurah[]> => {
    const data = await get("suwar");
    if (!Array.isArray(data.suwar)) throw new Mp3QuranError("استجابة السور غير صالحة.");
    return data.suwar.flatMap((s: any) => {
      const id = boundedNumber(s?.id, 114);
      return id && safeText(s?.name) ? [{ id, name: safeText(s.name) }] : [];
    });
  };
  const preview = (moshaf: Mp3QuranMoshaf, surah: number): string => {
    const id = boundedNumber(surah, 114);
    const server = allowedServer(moshaf.server);
    const available = moshaf.surah_list.split(",").map((n) => Number(n.trim()));
    if (!id || !server || !available.includes(id)) throw new Mp3QuranError("السورة غير متاحة لهذه الرواية.");
    return `${server}${String(id).padStart(3, "0")}.mp3`;
  };
  return { reciters, suwar, preview };
};
