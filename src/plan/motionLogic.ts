/**
 * فحص استدلالي لمواءمة أحداث الحركة بالنص، وليس فحص فهم بصري آلي.
 * يُستدعى بعد قياس البكسلات؛ لا يُصدر اعتمادًا شرعيًا أو فنيًا ولا يغيّر الخطة.
 */
import type { PlanScene } from "./types";
import { normalizeArabic } from "../script/quranMeta";
import { isCuratedBeat, parseBeats } from "./beats";

export type MotionLogicFinding = {
  kind: "meaning" | "timing" | "rhythm";
  level: "warning" | "info";
  message: string;
};
export type MotionLogicReview = {
  status: "needs-review" | "no-obvious-issues" | "not-assessable";
  /** عدد مراسي الأحداث التي أمكن إيجادها في التعليق */
  matched: number;
  total: number;
  findings: MotionLogicFinding[];
};

type Anchor = { label: string; source: string; draw?: string };
const wordsOf = (value: string): string[] => value.split(/\s+/u).map((w) => normalizeArabic(w).replace(/[^\p{L}\p{N}]/gu, "")).filter(Boolean);
const forms = (s: string): string[] => {
  const n = wordsOf(s)[0] ?? "";
  return [...new Set([n, n.replace(/^[وف](?=...)/u, ""), n.replace(/^(?:وال|بال|فال|كال|لل|ال)(?=...)/u, "")])].filter((w) => w.length >= 2);
};
const wordMatches = (a: string, b: string): boolean => forms(a).some((x) => forms(b).includes(x));
const anchorIndex = (narration: string[], label: string, after = 0): number => {
  const target = wordsOf(label);
  if (!target.length) return -1;
  for (let i = after; i <= narration.length - target.length; i++)
    if (target.every((w, j) => wordMatches(w, narration[i + j]!))) return i;
  return -1;
};

const sceneAnchors = (scene: PlanScene): Anchor[] => {
  const p = scene.props;
  const anchors: Anchor[] = [];
  if (p.beats && ["board-story", "sketch-board", "motion-story"].includes(scene.template))
    for (const beat of parseBeats(p.beats)) if (beat.label.trim())
      anchors.push({ label: beat.label, draw: beat.draw, source: "الرسمة" });
  // القوالب المصوَّرة: «الحدث | الكلمة التي تطلقه».
  if (p.cues)
    for (const line of p.cues.split("\n").map((x) => x.trim()).filter(Boolean)) {
      const parts = line.split("|").map((x) => x.trim());
      if (parts[1]) anchors.push({ label: parts[1], source: "الحدث" });
    }
  // قالب حبر ومعنى: النص | الدور | الكلمة المحفّزة. فحص المرساة لا يحكم بصحة معنى الدور.
  if (scene.template === "ink-meaning" && p.items)
    for (const line of p.items.split("\n").map((x) => x.trim()).filter(Boolean)) {
      const [label = "", role = "", cue = ""] = line.split("|").map((x) => x.trim());
      // أحداث link/mark/... قد تكون إثراءً بصريًا؛ لا تفترض أن اسم الحدث كلمة منطوقة.
      if (["key", "word", "line", "book", "quote", "focus"].includes(role) && (cue || label))
        anchors.push({ label: cue || label, source: "الكتابة" });
    }
  return anchors;
};

export const inspectMotionLogic = (
  scene: PlanScene,
  motion?: { pct: number; still: number },
): MotionLogicReview => {
  const findings: MotionLogicFinding[] = [];
  const add = (kind: MotionLogicFinding["kind"], level: MotionLogicFinding["level"], message: string) =>
    findings.push({ kind, level, message });

  if (motion) {
    if (motion.still > 2) add("rhythm", "warning", `سكون متصل ${motion.still} ث: راجع إن كان يخدم المعنى، خصوصًا لحظات التأمل والآيات.`);
    if (motion.pct < 80) add("rhythm", "info", `الحركة المرئية ${motion.pct}٪ أقل من مرجع 80٪؛ ليست مشكلة تلقائية إذا كان السكون مقصودًا.`);
    if (motion.pct > 97) add("rhythm", "info", `الحركة ${motion.pct}٪؛ راجع كثرة الانتقالات واحتمال إرهاق المشاهد.`);
  }

  const anchors = sceneAnchors(scene);
  const narration = wordsOf(scene.narration);
  let matched = 0;
  let previous = -1;
  for (const a of anchors) {
    const first = anchorIndex(narration, a.label);
    if (first < 0) {
      add("timing", "warning", `${a.source} «${a.label}» مرتبط بكلمة لم تُوجد في التعليق؛ افحص توقيت ظهوره.`);
      continue;
    }
    matched++;
    // تكرار الكلمة قد يكون مقصودًا؛ لا نُصدر تحذير ترتيب إلا حين لا يوجد ظهور لاحق.
    const later = anchorIndex(narration, a.label, Math.max(0, previous + 1));
    if (first < previous && later < 0)
      add("timing", "warning", `ترتيب ${a.source} «${a.label}» لا يوافق ترتيب الكلمات المنطوقة في السكريبت.`);
    previous = later >= 0 ? later : first;

    if (a.draw !== undefined && a.draw && !isCuratedBeat({ draw: a.draw, label: a.label }))
      add("meaning", "info", `الرسمة «${a.draw}» مع «${a.label}» ليست مطابقة مؤكدة من قاموس المعاني المراجع؛ افحص ملاءمتها للسياق.`);
  }

  if (anchors.length === 0)
    add("meaning", "info", "لا توجد أحداث مرتبطة بكلمات يمكن فحصها في هذا القالب؛ راجع مناسبة الصورة والحركة للجملة بصريًا.");
  if (anchors.length > 0 && !narration.length)
    add("timing", "warning", "أحداث مرتبطة بكلمات رغم غياب التعليق الصوتي؛ راجع مقصدها.");

  // هذه أدلة من النص وإعدادات القالب، لا نرى بها معنى اللقطة أو انتقالاتها الفعلية.
  add("meaning", "info", "المطابقة الآلية لا تثبت أن الحركة مفهومة أو منطقية؛ يلزم مشاهدة المشهد لتأكيد المعنى والتزامن.");
  return {
    status: findings.some((f) => f.level === "warning") ? "needs-review" : anchors.length ? "no-obvious-issues" : "not-assessable",
    matched,
    total: anchors.length,
    findings,
  };
};
