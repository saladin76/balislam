/**
 * عميل Quran Foundation Content API (الإصدار 4).
 * المصادقة: OAuth2 client_credentials بنطاق content، والرمز صالح ساعة.
 * الشروط: يُعرض النص كما هو بلا تعديل، مع نسبته للمصدر.
 * المراجع: https://api-docs.quran.foundation/docs/quickstart
 */
export type QfEnv = "prelive" | "production";

export const QF_URLS: Record<QfEnv, { auth: string; api: string }> = {
  prelive: { auth: "https://prelive-oauth2.quran.foundation", api: "https://apis-prelive.quran.foundation" },
  production: { auth: "https://oauth2.quran.foundation", api: "https://apis.quran.foundation" },
};

export { QF_ATTRIBUTION } from "./attribution";

export type QuranClientOptions = {
  clientId: string;
  clientSecret: string;
  env?: QfEnv;
  fetchImpl?: typeof fetch;
};

export type Verse = { key: string; number: number; text: string; meaning?: string };

/** ترجمات المعاني تأتي أحيانًا بحواشٍ داخل <sup>؛ نحذفها ونبقي النص فقط. */
export const cleanTranslation = (html: string) =>
  html
    .replace(/<sup[^>]*>.*?<\/sup>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();

export class QuranApiError extends Error {}

export const createQuranClient = (opts: QuranClientOptions) => {
  const env = opts.env ?? "prelive";
  const urls = QF_URLS[env];
  const f = opts.fetchImpl ?? fetch;
  let token: { value: string; expires: number } | null = null;

  const getToken = async (force = false): Promise<string> => {
    if (!force && token && Date.now() < token.expires - 60_000) return token.value;
    const res = await f(`${urls.auth}/oauth2/token`, {
      method: "POST",
      headers: {
        authorization: `Basic ${Buffer.from(`${opts.clientId}:${opts.clientSecret}`).toString("base64")}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials&scope=content",
    });
    if (!res.ok) throw new QuranApiError(`تعذّر الحصول على رمز الدخول من Quran Foundation (${res.status}). تأكد من QF_CLIENT_ID وQF_CLIENT_SECRET وQF_ENV.`);
    const data = (await res.json()) as { access_token: string; expires_in?: number };
    token = { value: data.access_token, expires: Date.now() + (data.expires_in ?? 3600) * 1000 };
    return token.value;
  };

  const get = async <T>(path: string, retry = true): Promise<T> => {
    const res = await f(`${urls.api}/content/api/v4${path}`, {
      headers: { "x-auth-token": await getToken(), "x-client-id": opts.clientId, accept: "application/json" },
    });
    if (res.status === 401 && retry) {
      await getToken(true);
      return get<T>(path, false);
    }
    if (!res.ok) throw new QuranApiError(`طلب Quran Foundation فشل (${res.status}) للمسار ${path}.`);
    return (await res.json()) as T;
  };

  /** آية واحدة بالرسم العثماني، مثل verse("53:39"). */
  const verse = async (key: string, opts: { translationId?: number } = {}): Promise<Verse> => {
    const q = opts.translationId ? `&translations=${opts.translationId}` : "";
    const data = await get<{ verse?: { verse_key?: string; verse_number?: number; text_uthmani?: string; translations?: { text?: string }[] } }>(`/verses/by_key/${key}?fields=text_uthmani${q}`);
    const text = data.verse?.text_uthmani;
    if (!text) throw new QuranApiError(`لم يرجع نص للآية ${key}.`);
    const raw = data.verse?.translations?.[0]?.text;
    return { key, number: data.verse?.verse_number ?? Number(key.split(":")[1]), text, meaning: raw ? cleanTranslation(raw) : undefined };
  };

  /** ترجمات المعاني المتاحة (اختياريًا بلغة معيّنة مثل en أو turkish). */
  const translations = async (language?: string): Promise<{ id: number; name: string; author: string; language: string }[]> => {
    const data = await get<{ translations?: { id: number; name?: string; author_name?: string; language_name?: string }[] }>(`/resources/translations${language ? `?language=${encodeURIComponent(language)}` : ""}`);
    return (data.translations ?? []).map((t) => ({ id: t.id, name: t.name ?? `#${t.id}`, author: t.author_name ?? "", language: t.language_name ?? "" }));
  };

  return { env, verse, translations, getToken };
};

export type QuranClient = ReturnType<typeof createQuranClient>;

export const quranClientFromEnv = (fetchImpl?: typeof fetch): QuranClient | null => {
  const clientId = process.env.QF_CLIENT_ID;
  const clientSecret = process.env.QF_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  const env = process.env.QF_ENV === "production" ? "production" : "prelive";
  return createQuranClient({ clientId, clientSecret, env, fetchImpl });
};
