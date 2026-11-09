/**
 * ما تعلنه أدوات الاستوديو (kit-*) ومشهد الخاتمة لمحرر المشهد (D56): العبارات المكتوبة، ولحظات الظهور
 * التي تقرؤها من حقل «التوقيت» بمفاتيحها في kitShots.tsx، والكلمة التلقائية لكل لحظة (أول كلمة من عبارتها).
 * مصدر واحد لعدد العبارات أيضًا: يقرؤه فحص `npx bal zubdat check` (src/studio/zubdat.ts).
 * بلا React.
 */
import { firstWord, lastWord, parsePhrases, type AnchorSlot, type Props, type ShotUi } from "../../plan/sceneSlots";

const AR = "٠١٢٣٤٥٦٧٨٩";
const n = (i: number) => String(i).replace(/\d/g, (d) => AR[Number(d)]!);
const labels = (p: Props) => parsePhrases(p.labels);
/** لحظة كتابة عبارة: بدايتها عند أول كلمة منها، ونهايتها عند آخر كلمة، ما لم يحدد المالك غيرهما */
const written = (key: string, label: string, phrase: string, required = false): AnchorSlot => ({ key, label, fallback: phrase ? firstWord(phrase) : undefined, end: true, endFallback: phrase ? lastWord(phrase) : undefined, required });

export const INK_UI: Record<string, ShotUi> = {
  "kit-ideas": {
    title: "عدّاد الأفكار",
    line: "كل فكرة تُكتب لحظة نطقها، والعدّاد يتقدم معها",
    library: true,
    fields: ["labels", "cues"],
    phrases: { min: 2, max: 5, name: (i) => `الفكرة ${n(i + 1)}` },
    slots: (p) => [{ key: "count", label: "كلمة العدد في التمهيد" }, ...labels(p).slice(0, 5).map((s, i) => written(`idea${i + 1}`, `الفكرة ${n(i + 1)}`, s))],
  },
  "kit-shift": {
    title: "من… إلى…",
    line: "حال تُكتب ثم تُشطب، وحال جديدة يشير إليها سهم",
    library: true,
    fields: ["labels", "cues"],
    phrases: { min: 2, max: 2, name: (i) => (i === 0 ? "الحال الأولى" : "الحال الجديدة") },
    slots: (p) => {
      const [from = "", to = ""] = labels(p);
      return [written("from", "الحال الأولى", from), { key: "cross", label: "الشطب (عند كلمة النفي)" }, written("to", "الحال الجديدة", to)];
    },
  },
  "kit-chain": {
    title: "سلسلة السبب والنتيجة",
    line: "حلقات تتصل واحدة بعد أخرى حتى النتيجة",
    library: true,
    fields: ["labels", "cues"],
    phrases: { min: 2, max: 4, name: (i, total) => (i === total - 1 && total > 1 ? "النتيجة" : `الحلقة ${n(i + 1)}`) },
    slots: (p) => {
      const L = labels(p).slice(0, 4);
      return L.map((s, i) => written(`step${i + 1}`, i === L.length - 1 && L.length > 1 ? "النتيجة" : `الحلقة ${n(i + 1)}`, s));
    },
  },
  "kit-meter": {
    title: "مقياس المستوى",
    line: "لجملة تقول صراحةً إن شيئًا يرتفع أو ينخفض",
    library: true,
    fields: ["labels", "cues"],
    phrases: { min: 0, max: 3, name: (i) => ["الأدنى", "الأعلى", "ما يُقاس"][i] ?? "" },
    slots: (p) => {
      const [low = "", high = "", subject = ""] = labels(p);
      const out: AnchorSlot[] = [{ ...written("rise", "الارتفاع", high), required: !high }, { key: "fall", label: "الانخفاض" }];
      if (low) out.push(written("low", "الأدنى", low));
      if (high) out.push(written("high", "الأعلى", high));
      if (subject) out.push(written("subject", "ما يُقاس", subject));
      return out;
    },
  },
  "kit-book": {
    title: "بطاقة الكتاب",
    line: "العنوان والمؤلف، وسؤال على ورقة لاصقة",
    library: true,
    fields: ["labels", "cues"],
    phrases: { min: 1, max: 3, name: (i) => ["العنوان", "المؤلف", "سؤال الورقة اللاصقة"][i] ?? "" },
    slots: (p) => {
      const [title = "", author = "", note = ""] = labels(p);
      return [written("title", "العنوان", title), ...(author ? [written("author", "المؤلف", author)] : []), ...(note ? [written("note", "سؤال الورقة اللاصقة", note)] : [])];
    },
  },
  outro: { closing: true, library: true, fields: ["task"] },
};

/** عدد العبارات الذي تقبله كل أداة (للفحص) */
export const kitPhraseRange = (shot: string): [number, number] => {
  const p = INK_UI[shot]?.phrases;
  return p ? [p.min, p.max] : [0, 9];
};
