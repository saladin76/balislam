import { elementLibrary, hasElement } from "../../brand/elements/registry";
import { normalizeArabic } from "../script/quranMeta";

/**
 * «لقطات» السبورة: كل جملة من التعليق تتحول إلى رسمة صغيرة + كلمة بخط اليد.
 * التوليد آلي (من معاني الكلمات ووسوم مكتبة العناصر)، ويمكن تعديل كل لقطة من الاستوديو.
 *
 * صيغة اللقطة (سطر لكل جملة):  الرسمة | الكلمة المكتوبة
 * الرسمة: معرّف عنصر من المكتبة، أو person / people / person:وضعية
 */
export type Beat = { draw: string; label: string };

/** كلمات المعاني الشائعة في محتوى القناة ← أنسب رسمة (تُقدَّم على مطابقة الوسوم). */
const CONCEPTS: [string[], string][] = [
  [["شخصين", "الاثنان", "اثنين", "الطرفين"], "people"],
  [["شخص", "الانسان", "انسان", "غيره", "الاخرين", "الناس", "قريب"], "person"],
  [["الحق", "حق", "الصواب", "الصحيح", "صحيح", "عدل", "عدلا", "بعدل", "ميزان", "بميزان"], "scale-brass-balanced"],
  [["الباطل", "باطل", "باطلا", "ظلم", "ظلما", "الخطا", "خطا", "مخطئا", "خاطئ", "بخطئه"], "scale-brass-tilted"],
  [["الحقيقه", "حقيقتها", "حقيقته", "الحقيقة"], "magnifier-brass"],
  [["خبر", "خبرا", "الخبر", "المعلومه", "معلومه"], "phone-notifications"],
  [["نصيحه", "نصيحة", "حجته", "حجة", "النقاش", "كلماته", "يقول", "تقول"], "speech-bubble"],
  [["قرار", "قرارا", "موقفك", "موقف"], "path-fork"],
  [["الاعتذار", "تعتذر", "اعتذر"], "handshake"],
  [["الكبرياء", "يتكبر", "غرور"], "crown"],
  [["عاده", "عادة", "اعتدنا"], "refresh"],
  [["المال", "مال", "مصلحه", "مصلحة"], "money-bag"],
  [["النجاح", "نجاح"], "podium"],
  [["الدنيا", "الابد", "الحياة"], "hourglass-ornate"],
  [["دعاء", "الدعاء", "اللهم", "ارنا", "ارزقنا", "نسال"], "hands-dua"],
  [["القران", "القراني", "الله", "الوحي", "الايات"], "mushaf-rehal"],
  [["قلب", "نيتك", "النية", "يقبله"], "heart-light"],
  [["عين", "بعين", "محايدة", "محايده"], "glasses"],
  [["مخاوفنا", "الخوف", "مخاوف", "القلق"], "cloud-storm"],
  [["تجاربنا", "تجارب"], "footprints"],
  [["الافكار", "فكرة", "الفكره", "نفكر", "فكرت"], "head-idea"],
  [["تثبت", "تبينوا", "تاكد", "التاكد"], "search"],
  [["الهدايه", "طريق", "تسير", "يهدينا"], "compass-pocket"],
  [["العلم", "اهل العلم", "كلمات"], "book-open"],
  [["خطوه", "خطوات", "اول خطوة"], "path-milestones"],
  [["سؤال", "سؤالا"], "question-mark"],
  [["تتوقف", "التوقف", "اجتنابه", "الابتعاد"], "hand-stop"],
  [["مقتنع", "متاكد", "يقين", "اليقين"], "check"],
  [["يجرح", "تؤذي", "مؤلم", "يؤذي"], "heart-bandaged"],
  [["تدافع", "ينتصر", "انتصر"], "trophy"],
  [["قيمه", "قيمة", "قيمته", "قيمتي"], "diamond"],
];

/** حروف الجر والعطف الملتصقة وأل التعريف تُحذف قبل المطابقة. */
const stem = (w: string) =>
  normalizeArabic(w)
    .replace(/[^\p{L}]/gu, "")
    .replace(/^(و|ف)(?=..)/, "")
    .replace(/^(بال|كال|فال|لل|ال)(?=..)/, "")
    .replace(/^(ب|ل|ك)(?=...)/, "");

const STOP = new Set(["في", "من", "على", "الى", "عن", "ان", "لا", "لم", "لن", "ما", "هو", "هي", "هذا", "هذه", "ذلك", "كل", "قد", "لكن", "بل", "ثم", "او", "ام", "حتى", "مع", "عند", "التي", "الذي", "كان", "نحن", "انت", "انه", "انها", "انك", "لان", "اي", "فقط", "دائما", "احيانا", "يمكن", "مجرد", "ليس", "ليست"].map((x) => normalizeArabic(x)));

/** فهرس وسوم المكتبة: جذع الوسم ← العنصر (العناصر الأولى أولى). */
let tagIndex: Map<string, string> | null = null;
const tags = () => {
  if (!tagIndex) {
    tagIndex = new Map();
    for (const e of elementLibrary) {
      if (e.kind === "backdrop") continue;
      for (const t of [e.nameAr, ...e.tags]) {
        const s = stem(t);
        if (s.length >= 3 && !tagIndex.has(s)) tagIndex.set(s, e.id);
      }
    }
  }
  return tagIndex;
};

const conceptFor = (word: string): string | null => {
  const n = normalizeArabic(word).replace(/[^\p{L}\s]/gu, "");
  const s = stem(word);
  for (const [words, draw] of CONCEPTS) for (const w of words) if (normalizeArabic(w) === n || stem(w) === s) return draw;
  return null;
};

/** يقسم النص إلى جمل (حسب علامات الوقف)، ويدمج الجمل القصيرة جدًا مع التالية. */
export const sentencesOf = (text: string): string[] => {
  const raw = text
    .split(/(?<=[.؟?!:؛])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const out: string[] = [];
  for (const s of raw) {
    const prev = out[out.length - 1];
    if (prev && prev.split(/\s+/).length < 4) out[out.length - 1] = `${prev} ${s}`;
    else out.push(s);
  }
  return out;
};

/** لقطة لجملة: أول كلمة لها معنى معروف تحدد الرسمة والكلمة المكتوبة. */
export const beatFor = (sentence: string, used: Set<string> = new Set()): Beat => {
  const words = sentence.split(/\s+/).filter(Boolean);
  const clean = (w: string) => w.replace(/[«»"“”'؟?!.,،:؛…]/g, "");
  let fallback: Beat | null = null;
  for (const w of words) {
    if (STOP.has(normalizeArabic(clean(w)))) continue;
    const c = conceptFor(clean(w));
    if (c) {
      const beat = { draw: c, label: clean(w) };
      if (!used.has(c)) return beat;
      fallback ??= beat;
    }
  }
  for (const w of words) {
    const s = stem(clean(w));
    if (s.length < 3 || STOP.has(normalizeArabic(clean(w)))) continue;
    const id = tags().get(s);
    if (id) {
      const beat = { draw: id, label: clean(w) };
      if (!used.has(id)) return beat;
      fallback ??= beat;
    }
  }
  if (fallback) return fallback;
  // بلا رسمة مناسبة: علامة تعجب/سؤال مع أطول كلمة في الجملة
  const longest = words.map(clean).filter((w) => !STOP.has(normalizeArabic(w))).sort((a, b) => b.length - a.length)[0] ?? "";
  return { draw: /[؟?]/.test(sentence) ? "question-mark" : "lightbulb", label: longest };
};

/** لقطات مشهد كامل (حتى 3 لقطات: الجمل الزائدة تُدمج). */
export const sentenceGroups = (narration: string, max = 3): string[] => {
  let sents = sentencesOf(narration);
  // جمل أقل من اللقطات المطلوبة: تُقسم عند الفواصل (القوائم: «بتجاربنا، ومخاوفنا، …»)
  if (sents.length < max) {
    const pieces = sents.flatMap((x) => x.split(/(?<=،)\s+/)).map((x) => x.trim()).filter(Boolean);
    if (pieces.length > sents.length) sents = pieces;
  }
  while (sents.length > max) {
    // ادمج أقصر جملتين متجاورتين
    let k = 0;
    let best = Infinity;
    for (let i = 0; i < sents.length - 1; i++) {
      const n = sents[i]!.length + sents[i + 1]!.length;
      if (n < best) {
        best = n;
        k = i;
      }
    }
    sents = [...sents.slice(0, k), `${sents[k]} ${sents[k + 1]}`, ...sents.slice(k + 2)];
  }
  return sents;
};

export const beatsFor = (narration: string, max = 3): Beat[] => {
  const sents = sentenceGroups(narration, max);
  const used = new Set<string>();
  return sents.map((s) => {
    const b = beatFor(s, used);
    used.add(b.draw);
    return b;
  });
};

export const beatsToText = (beats: Beat[]) => beats.map((b) => `${b.draw} | ${b.label}`).join("\n");

export const parseBeats = (text: string): Beat[] =>
  text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [draw = "", label = ""] = l.split("|").map((x) => x.trim());
      return { draw, label };
    });

/** رسمة صالحة: عنصر موجود أو شخصية. */
export const isDrawable = (draw: string) => draw === "person" || draw === "people" || draw.startsWith("person:") || hasElement(draw);
