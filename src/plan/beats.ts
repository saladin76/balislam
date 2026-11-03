import { hasElement } from "../../brand/elements/registry";
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
  // عناصر صُممت للحلقة 001 بزبدة الكتب (٣ نوفمبر ٢٠٢٦)، ومعانيها مراجَعة: لا «كبر/يكبر» (السن والكبرياء)، ولا «حركات» العامة
  [["التكبير", "تكبيرة", "التكبيرة"], "hands-takbir"],
  [["الركوع", "ركوع", "يركع", "السجود", "سجود", "يسجد"], "prayer-postures"],
  [["يسمع", "تسمع", "الاستماع", "استماع", "الإصغاء", "يصغي"], "ear-listen"],
  [["شخصين", "الاثنان", "اثنين", "الطرفين"], "people"],
  [["شخص", "الانسان", "انسان", "غيره", "الاخرين", "الناس"], "person"],
  [["الحق", "حق", "الصواب", "الصحيح", "صحيح", "عدل", "عدلا", "بعدل", "ميزان", "بميزان"], "scale-brass-balanced"],
  [["الباطل", "باطل", "باطلا", "ظلم", "ظلما", "الخطا", "خطا", "مخطئا", "خاطئ", "بخطئه"], "scale-brass-tilted"],
  [["الحقيقه", "حقيقتها", "حقيقته", "الحقيقة"], "magnifier-brass"],
  [["خبر", "خبرا", "الخبر", "المعلومه", "معلومه"], "phone-notifications"],
  [["نصيحه", "نصيحة", "حجته", "حجة", "النقاش", "كلماته"], "speech-bubble"],
  [["قرار", "قرارا"], "path-fork"],
  [["الاعتذار", "تعتذر", "اعتذر"], "handshake"],
  [["الكبرياء", "يتكبر", "غرور"], "crown"],
  [["عاده", "عادة", "اعتدنا"], "refresh"],
  [["المال", "مال", "مصلحه", "مصلحة"], "money-bag"],
  [["النجاح", "نجاح"], "podium"],
  [["الدنيا", "الابد", "الحياة"], "hourglass-ornate"],
  [["دعاء", "الدعاء", "اللهم", "ارنا", "ارزقنا", "نسال"], "hands-dua"],
  [["القران", "القراني", "الوحي", "الايات"], "mushaf-rehal"],
  [["قلب", "نيتك", "النية", "يقبله"], "heart-light"],
  [["عين", "بعين", "محايدة", "محايده"], "glasses"],
  [["مخاوفنا", "الخوف", "مخاوف", "القلق"], "cloud-storm"],
  [["تجاربنا", "تجارب"], "footprints"],
  [["الافكار", "فكرة", "الفكره", "نفكر", "فكرت"], "head-idea"],
  [["تثبت", "تبينوا", "تاكد", "التاكد"], "search"],
  [["الهدايه", "طريق", "تسير", "يهدينا"], "compass-pocket"],
  [["العلم", "اهل العلم"], "book-open"],
  [["خطوه", "خطوات", "اول خطوة"], "path-milestones"],
  [["سؤال", "سؤالا"], "question-mark"],
  [["تتوقف", "التوقف", "اجتنابه", "الابتعاد"], "hand-stop"],
    [["يجرح", "تؤذي", "مؤلم", "يؤذي"], "heart-bandaged"],
  [["ينتصر", "انتصر", "انتصار"], "trophy"],
  [["قيمه", "قيمة", "قيمته", "قيمتي"], "diamond"],
  // التاريخ (عناصر «التاريخ والحضارات» لدفاتر الزمن وحدها؛ مرشّح المكتبة يمنعها عن غيرها).
  // روجعت سياقاتها: لم تُضف «العرش» و«الآثار» و«القوس» و«السهم» و«الفرس» (الفُرس) و«الجمال» (الجَمال) لأن لها معاني أخرى شائعة.
  [["سيف", "السيف", "سيوف", "السيوف"], "sword"],
  [["قلعه", "قلعة", "القلعه", "القلعة", "حصن", "الحصن", "حصون", "الحصون"], "fortress"],
  [["اسوار", "الاسوار", "سورها", "اسوارها"], "city-walls"],
  [["قافله", "قافلة", "القافله", "القافلة", "القوافل", "قوافل", "جمل", "الجمل", "الابل"], "camel"],
  [["خيمه", "خيمة", "الخيمه", "الخيمة", "الخيام", "خيام"], "tent"],
  [["هرم", "الهرم", "الاهرام", "اهرام"], "pyramid"],
  [["منجنيق", "المنجنيق", "المجانيق"], "catapult"],
  [["الخيل", "خيول", "الخيول"], "horse"],
  [["سفينه", "سفينة", "السفينه", "السفينة", "السفن", "سفن", "اسطول", "الاسطول"], "dhow-ship"],
  [["اطلال", "الاطلال", "خرائب", "انقاض", "الانقاض"], "ruins-columns"],
  [["خوذه", "خوذة", "الخوذة", "الخوذ"], "helmet"],
  [["مرسوم", "المرسوم", "معاهده", "معاهدة", "المعاهدة"], "wax-seal"],
];

/** حروف الجر والعطف الملتصقة وأل التعريف تُحذف قبل المطابقة. */
const stem = (w: string) =>
  normalizeArabic(w)
    .replace(/[^\p{L}]/gu, "")
    .replace(/^(و|ف)(?=..)/, "")
    .replace(/^(بال|كال|فال|لل|ال)(?=..)/, "")
    // حرف الجر الملتصق لا يُحذف إن بقي أقل من أربعة أحرف («كمال» ليست «مال»)
    .replace(/^(ب|ل|ك)(?=....)/, "");

const STOP = new Set(["له", "لها", "لهم", "لهما", "لنا", "لك", "به", "بها", "بهم", "في", "من", "على", "الى", "عن", "ان", "لا", "لم", "لن", "ما", "هو", "هي", "هذا", "هذه", "ذلك", "كل", "قد", "لكن", "بل", "ثم", "او", "ام", "حتى", "مع", "عند", "التي", "الذي", "كان", "نحن", "انت", "انه", "انها", "انك", "لان", "اي", "فقط", "دائما", "احيانا", "يمكن", "مجرد", "ليس", "ليست"].map((x) => normalizeArabic(x)));

const conceptFor = (word: string): string | null => {
  const n = normalizeArabic(word).replace(/[^\p{L}\s]/gu, "");
  const s = stem(word);
  for (const [words, draw] of CONCEPTS) for (const w of words) if (normalizeArabic(w) === n || stem(w) === s) return draw;
  return null;
};

/**
 * قاعدة القناة: لا عنصر إلا ما يطابق الكلمة المنطوقة ومعناها في الجملة.
 * العناصر المساندة تأتي من قائمة المعاني المراجَعة (CONCEPTS) فقط، لا من مطابقة الوسوم الآلية،
 * مع استثناء العبارات التي تتغير فيها دلالة الكلمة.
 */
const SENSE_EXCEPTIONS: [RegExp, RegExp][] = [
  // «في حقك/حقي/حقه» = تجاه الشخص، لا الحق مقابل الباطل
  [/^(ف|و)?في$/, /^حق(ك|ي|ه|هم|نا)$/],
  // «للغاية» = جدًا
  [/.*/, /^للغاي(ه|ة)$/],
];

/** كلمات المعنى التي تُرسم مساندة لا يُرسم منها شيء بجوار ذكر الله أو كلامه (توقيرًا). */
export const SACRED_NEIGHBORS = /^(الله|لله|بالله|فالله|والله|اللهم|تعالي|تعالى|سبحانه|عز|وجل|ربه|ربك|ربنا|ربي|الرحمن|النبي)$/;

export const wordElement = (word: string, prev = "", next = ""): string | null => {
  const clean = (x: string) => normalizeArabic(x.replace(/[«»"“”'؟?!.,،:؛…]/g, ""));
  const w = clean(word);
  if (!w || STOP.has(w)) return null;
  if (SACRED_NEIGHBORS.test(clean(prev)) || SACRED_NEIGHBORS.test(clean(next))) return null;
  for (const [p, x] of SENSE_EXCEPTIONS) if (p.test(clean(prev)) && x.test(w)) return null;
  return conceptFor(word.replace(/[«»"“”'؟?!.,،:؛…]/g, ""));
};

/** هل رسمة اللقطة من قائمة المعاني المراجَعة لكلمة من عنوانها؟ (وإلا اختيرت آليًا وتحتاج مراجعة) */
export const isCuratedBeat = (b: Beat) =>
  b.draw.startsWith("person") || b.draw === "people" || b.label.split(/\s+/).some((w) => conceptFor(w.replace(/[«»"“”'؟?!.,،:؛…]/g, "")) === b.draw);

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
/** allow: مرشّح مكتبة القناة (drawAllowed في src/channel/library.ts)؛ ما ليس من مكتبتها لا يُختار أبدًا */
export const beatFor = (sentence: string, used: Set<string> = new Set(), allow: (id: string) => boolean = () => true): Beat => {
  const words = sentence.split(/\s+/).filter(Boolean);
  const clean = (w: string) => w.replace(/[«»"“”'؟?!.,،:؛…]/g, "");
  let fallback: Beat | null = null;
  for (const w of words) {
    if (STOP.has(normalizeArabic(clean(w)))) continue;
    const c = conceptFor(clean(w));
    if (c && allow(c)) {
      const beat = { draw: c, label: clean(w) };
      if (!used.has(c)) return beat;
      fallback ??= beat;
    }
  }
  if (fallback) return fallback;
  // بلا معنى مراجَع في المكتبة: لا يُستعمل أقرب عنصر ولا مطابقة الوسوم ولا عنصر عام (المصباح).
  // الموضع يبقى بلا رسمة (الكلمة وحدها) ويظهر في فحص الخطة طلبًا لعنصر جديد يُصمَّم ويُضاف للمكتبة.
  // الاستثناء الوحيد: الجملة السؤال تأخذ علامة السؤال، وهي معناها.
  const longest = words.map(clean).filter((w) => !STOP.has(normalizeArabic(w))).sort((a, b) => b.length - a.length)[0] ?? "";
  return { draw: /[؟?]/.test(sentence) && allow("question-mark") ? "question-mark" : "", label: longest };
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

export const beatsFor = (narration: string, max = 3, allow?: (id: string) => boolean): Beat[] => {
  const sents = sentenceGroups(narration, max);
  const used = new Set<string>();
  return sents.map((s) => {
    const b = beatFor(s, used, allow);
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
/** لقطة بلا عنصر مطابق في المكتبة: تحتاج عنصرًا جديدًا يُصمَّم لها */
export const needsElement = (b: Beat) => !b.draw.trim();

export const isDrawable = (draw: string): boolean =>
  draw.includes("+") ? draw.split("+").every((d) => isDrawable(d.trim())) : draw === "people" || /^(person|woman|child|elder)(:[a-z-]+)?$/.test(draw) || hasElement(draw);
