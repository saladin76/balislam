/**
 * D234 (قاعدة ثابتة للقنوات الثلاث، قرار المالك ٢٦ نوفمبر): لا يدخل سكريبت الإنتاج (صوت أو رندر) إلا بعد هذا الترتيب:
 *   مسودة ← مراجعة محرر المحتوى ← المراجعة العلمية بطبقتيها (D230) ← اعتماد المالك ← صوت ← رندر.
 *
 * - **مراجعة المحرر جملةً جملة:** سجل المحرر (`editor-review.json` في مجلد الحلقة، محتوى يُحفظ في main) يحفظ بصمة كل جملة
 *   مرّت به. أي جملة جديدة أو متغيّرة بعده (مثل تعديل من المراجعة العلمية) تعود وحدها «بانتظار المحرر»، لا السكريبت كله.
 * - **المراجعة العلمية:** بنود المتخصص في خانة الحلقة من `stock.json` (D213)؛ تُفرَّغ حين تُطبَّق المراجعة الآلية بطبقتيها
 *   (D230). خانة بلا بنود = مُراجَعة؛ وحلقة بلا خانة في ترتيب النشر = لا سجل مراجعة، فتبقى «بانتظار المراجعة العلمية».
 * - **اعتماد المالك:** «اعتمدت السكريبت» في «بانتظارك» (D213، موقّع محليًا) لا يُقبل قبل المحرر والمراجعة العلمية.
 *   والحلقة التي ليست «مسودة» فتح المالك إنتاجها بسجل «إنتاج المشاهد» (D76) فاعتمادها هناك.
 * - **البوابة:** الصوت والرندر يُرفضان لأي سكريبت فيه جملة لم تمرّ بالمحرر (scriptPipelineStore.ts: assertEditorPassed).
 *   الاستثناءات صريحة بقرار المالك في EDITOR_GATE_EXCEPTIONS (فارغة: استثناء D229 أُلغي بـ D235).
 *
 * نقي بلا نظام ملفات: القراءة والكتابة في scriptPipelineStore.ts.
 */
import { createHash } from "node:crypto";

export const EDITOR_REVIEW_FILE = "editor-review.json";

export const STATUS_EDITOR = "بانتظار المحرر";
export const STATUS_SCHOLARLY = "بانتظار المراجعة العلمية";
export const STATUS_OWNER = "بانتظار اعتمادك";
export const STATUS_READY = "جاهز للإنتاج";
export type PipelineStatus = typeof STATUS_EDITOR | typeof STATUS_SCHOLARLY | typeof STATUS_OWNER | typeof STATUS_READY;
/** الترتيب الثابت (D234) */
export const PIPELINE_ORDER: readonly PipelineStatus[] = [STATUS_EDITOR, STATUS_SCHOLARLY, STATUS_OWNER, STATUS_READY];

export type ScriptSentence = { line: number; text: string; hash: string };

export type EditorPass = {
  /** تاريخ مراجعة المحرر (ISO) */
  at: string;
  /** من راجع (المحرر)، ومن سجّل المرور (المنسّق بعد أن سلّمه المالك رد المحرر) */
  by: string;
  recordedBy: string;
  /** رقم دفعة المحرر إن وُجدت (دفعة-المحرر-NN.md) */
  batch?: number;
  /** بصمة السكريبت كاملًا وقت التسجيل، وعدد جمله، وعدد الجمل التي كانت تنتظر المحرر فيه */
  scriptSha256: string;
  sentences: number;
  reviewed: number;
  /** سبب الاعتبار «مرّ بالمحرر» بلا مراجعة فعلية (حلقة منشورة قبل القاعدة)؛ يُذكر صراحة */
  grandfathered?: string;
  note?: string;
};
export type EditorReview = {
  version: 1;
  channel: string;
  episode: string;
  /** بصمات الجمل التي مرّت بالمحرر (sha256 مقطوعة ١٦ خانة للنص بعد التطبيع) */
  sentences: string[];
  passes: EditorPass[];
};

/** تطبيع الجملة قبل البصمة: NFC، وحذف التشكيل والتطويل (تصحيح النطق لا يعيدها للمحرر)، ومسافات موحدة. */
export const normalizeSentence = (s: string): string =>
  s.normalize("NFC").replace(/[ً-ْٰـ]/g, "").replace(/\s+/g, " ").trim();
export const sentenceHash = (s: string): string => createHash("sha256").update(normalizeSentence(s)).digest("hex").slice(0, 16);
export const scriptSha256 = (text: string): string => createHash("sha256").update(text).digest("hex");

/**
 * جمل نص السكريبت كما يراها المحرر: كل سطر غير فارغ بعد الترويسة وخارج تعليقات HTML، مقسومًا عند علامات الوقف
 * (. ؟ ? ! ؛ …). سطر التوجيه («[آية: …]» و«[مشهد: …]») والعنوان وحدة واحدة. أرقام الأسطر من 1 كما في المحرر.
 */
export const scriptSentences = (text: string): ScriptSentence[] => {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  let i = 0;
  if (lines[0]?.trim() === "---") {
    const end = lines.findIndex((l, k) => k > 0 && l.trim() === "---");
    if (end > 0) i = end + 1;
  }
  const out: ScriptSentence[] = [];
  let inComment = false;
  for (; i < lines.length; i++) {
    let line = lines[i]!;
    // تعليقات HTML (ملاحظات الإنتاج) ليست من النص
    let visible = "";
    while (line.length) {
      if (inComment) {
        const close = line.indexOf("-->");
        if (close < 0) { line = ""; break; }
        inComment = false;
        line = line.slice(close + 3);
      } else {
        const open = line.indexOf("<!--");
        if (open < 0) { visible += line; line = ""; break; }
        visible += line.slice(0, open);
        inComment = true;
        line = line.slice(open + 4);
      }
    }
    const t = visible.trim();
    if (!t) continue;
    const parts = /^(\[|#|>)/.test(t) ? [t] : t.split(/(?<=[.؟?!؛…])\s+/).map((x) => x.trim()).filter(Boolean);
    for (const p of parts) out.push({ line: i + 1, text: p, hash: sentenceHash(p) });
  }
  return out;
};

export type EditorState = {
  /** هل في السجل مرور سابق للمحرر على هذه الحلقة؟ */
  reviewed: boolean;
  /** جمل السكريبت الحالية التي لم تمرّ بالمحرر (كلها إن لم يمرّ بها، أو المتغيّرة وحدها بعد مروره) */
  pending: ScriptSentence[];
  total: number;
  /** مراجعة جزئية: مرّ بالمحرر ثم تغيّرت جمل */
  partial: boolean;
  last?: Pick<EditorPass, "at" | "by" | "batch" | "grandfathered">;
};

export const editorState = (text: string, record: EditorReview | null | undefined): EditorState => {
  const all = scriptSentences(text);
  const passed = new Set(record?.sentences ?? []);
  const pending = all.filter((s) => !passed.has(s.hash));
  const last = record?.passes.at(-1);
  const reviewed = Boolean(record && record.passes.length);
  return {
    reviewed, pending, total: all.length, partial: reviewed && pending.length > 0,
    ...(last ? { last: { at: last.at, by: last.by, ...(last.batch !== undefined ? { batch: last.batch } : {}), ...(last.grandfathered ? { grandfathered: last.grandfathered } : {}) } } : {}),
  };
};

export type ScriptPipeline = {
  status: PipelineStatus;
  editor: { passed: boolean; partial: boolean; pending: number; total: number; at?: string; by?: string; grandfathered?: string };
  scholarly: { passed: boolean; items: string[]; note?: string };
  owner: { approved: boolean; stale?: boolean; at?: string };
};

/**
 * الحالة بالترتيب الثابت: أول خطوة لم تكتمل. المحرر أولًا (جملة واحدة متغيّرة تكفي)، ثم المراجعة العلمية، ثم اعتماد المالك.
 * - scholarly: بنود المتخصص الباقية (null = لا خانة في ترتيب النشر، فلا سجل مراجعة).
 * - grandfathered في آخر مرور للمحرر (حلقة منشورة قبل القاعدة) يُغني عن المراجعة العلمية واعتماد النص؛ وأي جملة تتغيّر بعده تعود للمحرر.
 * - owner: الحلقة «المسودة» باعتماد «اعتمدت السكريبت» الحالي (غير المتغيّر)؛ وما ليس مسودة فُتح إنتاجه بسجل «إنتاج المشاهد» (D76).
 */
export const scriptPipeline = (o: {
  editor: EditorState;
  specialist: string[] | null;
  draft: boolean;
  approval: { approved: boolean; at?: string; stale?: boolean };
}): ScriptPipeline => {
  const e = o.editor;
  const grandfathered = e.last?.grandfathered && !e.pending.length ? e.last.grandfathered : undefined;
  const editor = { passed: e.pending.length === 0 && e.reviewed, partial: e.partial, pending: e.pending.length, total: e.total,
    ...(e.last ? { at: e.last.at, by: e.last.by } : {}), ...(grandfathered ? { grandfathered } : {}) };
  const scholarly = grandfathered
    ? { passed: true, items: [], note: grandfathered }
    : o.specialist === null
      ? { passed: false, items: [], note: "خارج ترتيب النشر: لا سجل مراجعة علمية لهذه الحلقة." }
      : { passed: o.specialist.length === 0, items: o.specialist };
  const owner = !o.draft || grandfathered
    ? { approved: true }
    : { approved: o.approval.approved && !o.approval.stale, ...(o.approval.stale ? { stale: true } : {}), ...(o.approval.at ? { at: o.approval.at } : {}) };
  const status: PipelineStatus = !editor.passed ? STATUS_EDITOR : !scholarly.passed ? STATUS_SCHOLARLY : !owner.approved ? STATUS_OWNER : STATUS_READY;
  return { status, editor, scholarly, owner };
};

/** «اعتمدت السكريبت» يظهر ويُقبل وحده بعد المحرر والمراجعة العلمية */
export const ownerMayApprove = (p: ScriptPipeline): boolean => p.editor.passed && p.scholarly.passed;
export const ownerApprovalRefusal = (p: ScriptPipeline): string | null =>
  ownerMayApprove(p) ? null
    : `لا يُعتمد السكريبت قبل أن يمرّ بالمحرر والمراجعة العلمية (D234). حالته الآن «${p.status}»${p.editor.partial ? `: ${p.editor.pending} جملة متغيّرة تنتظر المحرر` : ""}.`;

/** رسالة البوابة: تسمي الحالة وعدد الجمل التي تنتظر المحرر */
export const editorGateMessage = (e: EditorState): string =>
  `هذا السكريبت «${STATUS_EDITOR}» (D234): لا صوت ولا رندر قبل أن يمرّ بمحرر المحتوى — ${e.partial
    ? `${e.pending.length} جملة تغيّرت بعد مراجعته تنتظره`
    : `لم يراجعه بعد (${e.total} جملة)`}. الترتيب: مسودة ← المحرر ← المراجعة العلمية ← اعتمادك ← صوت ← رندر.`;

/**
 * الاستثناءات الصريحة من بوابة المحرر، كل واحد بقرار المالك (صوت مشاهد بعينها في حلقة بعينها، بقرار مسجّل في
 * `frozen.voiceOnly` من stock.json). لا يُضاف إليها شيء إلا بقرار جديد. فارغة اليوم: استثناء D229 لصوت الدقيقة الأولى
 * من «بالإسلام» 001 أُلغي بـ D235 (تجميد «بالإسلام» كاملًا).
 */
export const EDITOR_GATE_EXCEPTIONS: readonly { channel: string; episode: string; decision: string; voiceOnly: true }[] = Object.freeze([]);

/** هل يُعفى هذا الطلب من بوابة المحرر؟ صوت (لا رندر) لمشاهد كلها في استثناء القرار المسجّل في stock.json نفسه. */
export const editorGateException = (o: {
  channel: string; episode?: string; voiceScenes?: readonly string[] | null;
  voiceOnly?: readonly { episode: string; scenes: string[]; decision: string }[];
}, exceptions: readonly { channel: string; episode: string; decision: string }[] = EDITOR_GATE_EXCEPTIONS): string | null => {
  if (!o.episode || !o.voiceScenes?.length) return null;
  for (const x of exceptions) {
    if (x.channel !== o.channel || x.episode !== o.episode) continue;
    const entry = (o.voiceOnly ?? []).find((v) => v.episode === x.episode && v.decision === x.decision);
    if (entry && o.voiceScenes.every((s) => entry.scenes.includes(s))) return x.decision;
  }
  return null;
};

export const editorReviewIssues = (r: unknown, channel?: string, episode?: string): string[] => {
  const x = r as Partial<EditorReview> | null;
  const out: string[] = [];
  if (!x || x.version !== 1) return ["سجل المحرر: الصيغة غير صالحة."];
  if (channel && x.channel !== channel) out.push("سجل المحرر: القناة لا تطابق مجلده.");
  if (episode && x.episode !== episode) out.push("سجل المحرر: رقم الحلقة لا يطابق مجلدها.");
  if (!Array.isArray(x.sentences) || x.sentences.some((h) => typeof h !== "string" || !/^[a-f0-9]{16}$/.test(h))) out.push("سجل المحرر: بصمات الجمل غير صالحة.");
  if (!Array.isArray(x.passes) || !x.passes.length) out.push("سجل المحرر: لا مرور مسجّل.");
  for (const p of x.passes ?? [])
    if (!p || typeof p.at !== "string" || !p.at || typeof p.by !== "string" || !p.by.trim() || typeof p.recordedBy !== "string" || !/^[a-f0-9]{64}$/.test(String(p.scriptSha256)))
      out.push("سجل المحرر: مرور ناقص (التاريخ، ومن راجع، ومن سجّل، وبصمة السكريبت).");
  return out;
};
