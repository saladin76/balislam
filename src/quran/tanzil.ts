/**
 * D220 (قرار المالك ٢٤ نوفمبر): نص Tanzil بالرسم العثماني (رواية حفص) مصدر المطابقة، محفوظًا على الجهاز بترخيصه كما هو
 * (`assets/quran/tanzil-uthmani.txt`، وNOTICE.md بجواره). هذا الملف يقرؤه ويبحث فيه فقط: لا شبكة، ولا كتابة، ولا تصحيح.
 *
 * - الملف يُقرأ مرة، ويُرفض إن لم تطابق بصمته TANZIL_SHA256 (نص تغيّر لا يصلح مرجعًا).
 * - السطر `سورة|آية|النص`، وما بدأ بـ# (كتلة الترخيص) أو كان فارغًا يُتخطى.
 * - Tanzil يضع البسملة في أول الآية الأولى من كل سورة إلا الفاتحة (هي آيتها الأولى) والتوبة (بلا بسملة)؛
 *   وليست من الآية، فتُحذف (كلماتها الأربع) عند قراءة الآية الأولى. والبسملة نفسها 1:1.
 * - المرجع `2:30` أو `2:35-36` أو «البقرة 30» (parseAyahRef)؛ والنطاق آياته بالترتيب.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { projectRoot } from "../config/paths";
import { parseAyahRef } from "../script/quranMeta";
import type { VerseLookup } from "./verseSource";

export const TANZIL_FILE = path.join(projectRoot, "assets", "quran", "tanzil-uthmani.txt");
export const TANZIL_SHA256 = "6933e133dd56db778c801bf738848454e43648105a151e8d84d86a7cae39ec5f";

let cache: Map<string, string> | null = null;

/** يقرأ النص ويتحقق من بصمته؛ الخريطة «سورة:آية» → نص الآية كما في الملف (بلا البسملة المضافة) */
export const loadTanzil = (file = TANZIL_FILE): Map<string, string> => {
  if (cache && file === TANZIL_FILE) return cache;
  const raw = readFileSync(file);
  const sha = createHash("sha256").update(raw).digest("hex");
  if (sha !== TANZIL_SHA256) throw Error(`نص المصحف المرجعي (${path.basename(file)}) تغيّرت بصمته؛ لا يُطابق به شيء حتى يُعاد كما نُزّل من Tanzil (D220).`);
  const map = new Map<string, string>();
  for (const line of raw.toString("utf8").split("\n")) {
    if (!line.trim() || line.startsWith("#")) continue;
    const m = /^(\d{1,3})\|(\d{1,3})\|(.+)$/.exec(line);
    if (!m) throw Error(`سطر غير متوقع في نص المصحف المرجعي: «${line.slice(0, 20)}…»`);
    map.set(`${Number(m[1])}:${Number(m[2])}`, m[3]!);
  }
  if (map.size !== 6236) throw Error(`نص المصحف المرجعي فيه ${map.size} آية لا ٦٢٣٦.`);
  // البسملة أربع كلمات؛ وفي أول التين والقدر بشدة على الباء (وصلها بما قبلها)، فتُعرف بحروفها لا ببايتاتها
  const bare = (w: string) => w.replace(/[\p{M}\u0640]/gu, "");
  const basmala = map.get("1:1")!.split(" ").map(bare).join(" ");
  for (let s = 2; s <= 114; s++) {
    if (s === 9) continue;
    const k = `${s}:1`, words = map.get(k)!.split(" ");
    if (words.slice(0, 4).map(bare).join(" ") !== basmala || words.length < 5) throw Error(`الآية ${k} في نص المصحف المرجعي لا تبدأ بالبسملة كما يضعها Tanzil.`);
    map.set(k, words.slice(4).join(" "));
  }
  if (file === TANZIL_FILE) cache = map;
  return map;
};

/** نص آية واحدة («2:30»)، أو undefined */
export const tanzilAyah = (surah: number, ayah: number): string | undefined => loadTanzil().get(`${surah}:${ayah}`);

/** البسملة بالرسم العثماني (1:1) */
export const tanzilBasmala = (): string => loadTanzil().get("1:1")!;

/**
 * آيات المرجع بالترتيب: «2:30» آية واحدة، و«2:35-36» آيتان. مرجع غير صالح أو خارج السورة: null.
 */
export const tanzilVerses: VerseLookup = (ref: string) => {
  const r = parseAyahRef(ref);
  if (!r.ok) return null;
  const out: { number: number; text: string }[] = [];
  for (let n = r.ref.from; n <= r.ref.to; n++) {
    const text = tanzilAyah(r.ref.surah, n);
    if (text === undefined) return null;
    out.push({ number: n, text });
  }
  return { key: r.ref.key, verses: out };
};

/** النص الكامل للمرجع كما يُعرض في بطاقة: آية واحدة كما هي، والنطاق بآياته مفصولة بمسافة (بلا علامة نهاية) */
export const tanzilText = (ref: string): string | null => {
  const v = tanzilVerses(ref);
  return v ? v.verses.map((x) => x.text).join(" ") : null;
};
