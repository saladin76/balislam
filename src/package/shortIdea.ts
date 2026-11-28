/**
 * الشورت فكرة كاملة وحده (D241، قاعدة ثابتة للقنوات الثلاث، قرار المالك ٢٧ نوفمبر).
 *
 * كل شورت/ريل يفهمه من لم يرَ الحلقة من أوله إلى آخره: يبدأ بخطاف من أول ثانية (سؤال، أو جملة قوية يعلّمها المحرر:
 * حقيقة مدهشة أو رقم أو جملة لافتة؛ تعديل المالك ٢٧ نوفمبر: الخطاف لا يلزم أن يكون سؤالًا، فلا تتشابه الشورتس)، وفيه الفكرة
 * نفسها كاملة، وينتهي بختام واضح (جواب أو خلاصة أو سؤال للتعليقات)، ولا يُقطع في منتصف الكلام. ويجوز أن يُجمع من جمل
 * غير متتالية من الحلقة نفسها (أجزاء بالترتيب) ما دامت فكرة واحدة؛ ولا جملة جديدة ولا صوت جديد.
 *
 * هذه الوحدة نقية (بلا قرص ولا شبكة): تأخذ جمل الحلقة بالترتيب، وأجزاء الشورت (مدى جمل لكل جزء)، وتقول «يمر» أو
 * «مرفوض» بسبب كل رفض وجملته. يُرفض الشورت إن:
 *  - بدأ جزء منه في منتصف جملة (ما قبله في الحلقة جملة لم تتم: تنتهي بنقطتين أو فاصلة أو بلا علامة وقف)، أو انتهى
 *    جزء في منتصف جملة (آخر جملة فيه تنتهي بنقطتين أو فاصلة أو «…» أو بلا علامة)؛
 *  - فيه كلمة تشير إلى خارجه (قائمة مراجَعة بعد التطبيع كـ src/package/traces.ts): ذكر الحلقة («في الحلقة الماضية»)
 *    أو ما قيل فيها («كما قلنا»، «ذكرنا»)، في أي موضع من الشورت؛ وفي أول جملة من كل جزء وحدها: اسم الإشارة
 *    («هذا»، «تلك»…) والضمير المحيل («بعدهما»، «قبله») وأدوات الوصل التي تفترض كلامًا قبلها («والجواب»، «ثم»،
 *    «لكن»، «والثالث»)، لأن ما تشير إليه قبل الجزء خارج الشورت. وفي غير أول الجزء لا تُعلَّم الإشارة: ما تحيل إليه
 *    في الشورت نفسه غالبًا («وهذا ما نعرفه»)، والفراغ أقل ضررًا من إنذار كاذب يُغرق المحرر؛
 *  - انتهى بسؤال لا جواب له فيه، إلا سؤال التعليقات المقصود (نمط «اكتب لنا في التعليقات» أو `closingQuestion: "comment"`)؛
 *  - لم يبدأ بخطاف معلَّم: أول جملة سؤال (فيها «؟»)، أو علّمها المحرر/المالك خطافًا (`hook: "line"`، ونوعه اختياريًا
 *    `hookKind`: حقيقة مدهشة `fact` أو رقم `number` أو جملة لافتة `striking`). فحص خفيف عمدًا: لا يحكم الكود على
 *    قوة الجملة، بل يطلب أن يقرر إنسان أنها خطاف إن لم تكن سؤالًا؛ وشورت بلا خطاف معلَّم مرفوض.
 * نص الآية والحديث لا يُفحص للإشارة (كلام الله ورسوله بلفظه)، وما بين «» اقتباس لا يُفحص كذلك.
 */

export type IdeaSentenceKind = "narration" | "verse" | "hadith";
/** جملة من جمل الحلقة بالترتيب. `unit`: الوحدة التي جاءت منها (المشهد في الخطة، والفقرة في السكريبت). */
export type IdeaSentence = { text: string; kind: IdeaSentenceKind; unit?: string };
/** جزء من الشورت: من الجملة a إلى الجملة b (شاملتين) في جمل الحلقة. */
export type IdeaPart = [number, number];
export type ShortIdeaSpec = {
  parts: IdeaPart[];
  /** المحرر/المالك علّم أول جملة خطافًا (ليست سؤالًا) */
  hook?: boolean;
  /** آخر جملة سؤال للتعليقات مقصود */
  commentClose?: boolean;
};
export type ShortIdeaRule = "empty" | "start" | "end" | "outward" | "question" | "hook";
export type ShortIdeaIssue = { rule: ShortIdeaRule; message: string; sentence?: string; index?: number };
export type ShortIdeaResult = { ok: boolean; issues: ShortIdeaIssue[]; sentences: IdeaSentence[] };

/* ── التطبيع (كـ normalizeForTraces: NFKC وحذف المحارف الخفية والتشكيل وتوحيد الألف والياء، والتاء المربوطة هاءً) ── */

const FORMAT = /[­᠎​-‏‪-‮⁠-⁯﻿\p{Cf}]/gu;
const ARABIC_MARKS = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/g;
export const normalizeIdea = (text: string): string =>
  String(text ?? "")
    .normalize("NFKC")
    .replace(FORMAT, "")
    .toLowerCase()
    .replace(ARABIC_MARKS, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه");
const tokensOf = (text: string): string[] => normalizeIdea(text).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
/** النص بلا اقتباس «…» ولا آية ﴿…﴾ ولا [ … ]: ما يُفحص للإشارة */
const ownWords = (text: string) => text.replace(/«[^«»]*»/g, " ").replace(/﴿[^﴿﴾]*﴾/g, " ").replace(/\[[^\]]*\]/g, " ");

/* ── التقسيم إلى جمل (عند علامات الوقف، ولا يُقطع داخل «» ولا ﴿﴾ ولا []) ── */

const END_MARK = /[.؟?!…:؛;]["»”’)\]]*$/u;
/** جمل نص بالترتيب: كل جملة تنتهي عند علامة وقف (. ؟ ! … : ؛) خارج الأقواس والاقتباس. */
export const ideaSentencesOf = (text: string): string[] => {
  const ws = String(text ?? "").trim().split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let cur: string[] = [];
  let depth = 0;
  for (const w of ws) {
    cur.push(w);
    for (const ch of w) {
      if (ch === "﴿" || ch === "[" || ch === "«") depth++;
      else if (ch === "﴾" || ch === "]" || ch === "»") depth = Math.max(0, depth - 1);
    }
    if (depth === 0 && END_MARK.test(w)) { out.push(cur.join(" ")); cur = []; }
  }
  if (cur.length) out.push(cur.join(" "));
  return out;
};

const lastMark = (text: string): string => {
  const t = text.trim().replace(/["»”’)\]]+$/u, "");
  return t.slice(-1);
};
/** جملة تامة تصلح بداية لما بعدها أو نهاية لشورت: تنتهي بنقطة أو علامة سؤال أو تعجب (لا نقطتين ولا فاصلة ولا «…») */
export const isClosedSentence = (s: IdeaSentence): boolean => {
  if (s.kind !== "narration") return true;
  const m = lastMark(s.text);
  return m === "." || m === "؟" || m === "?" || m === "!";
};
export const isQuestion = (s: IdeaSentence) => s.kind === "narration" && /[؟?]/.test(ownWords(s.text));
const endsWithQuestion = (s: IdeaSentence) => s.kind === "narration" && /[؟?]/.test(lastMark(s.text));

/* ── سؤال التعليقات المقصود ── */

// الكلمات بين مسافتين (\b لا يعمل مع الحروف العربية)
const CTA = [/ [وف]?(ال)?تعليق(ات)? /, / [وف]?علق(وا)? /, / [وف]?(اكتب|اكتبوا|شاركنا|شاركونا|اخبرنا|اخبرونا) /, / [وف]?(قل|قولوا) لنا /];
/** آخر جملة دعوة للتعليق («اكتب لنا في التعليقات»، «أخبرنا في التعليقات»، «شاركنا رأيك»). */
export const isCommentCta = (text: string): boolean => {
  const n = ` ${tokensOf(text).join(" ")} `;
  return CTA.some((re) => re.test(n));
};

/* ── الإشارة إلى خارج الشورت: قائمة مراجَعة ── */

/**
 * عبارات تشير إلى الحلقة أو إلى ما قيل فيها، في أي موضع من الشورت. كل عبارة كلمات بعد التطبيع؛ والكلمة الأولى
 * تقبل «و» أو «ف» قبلها. اختيرت بعد فحصها على شورتس القنوات الثلاث وسكريبتاتها (tests/shorts-idea-d241.test.ts).
 */
export const OUTWARD_ANYWHERE: { words: string[]; label: string }[] = [
  ...["قلنا", "ذكرنا", "راينا", "عرفنا", "سبق", "مر", "تقدم", "اشرنا", "بينا", "اسلفنا", "شرحنا", "تحدثنا"].map((w) => ({ words: ["كما", w], label: `كما ${w}` })),
  ...["ذكرنا", "ذكرناه", "ذكرناها", "اشرنا", "تحدثنا", "تكلمنا", "شرحنا", "شرحناه", "اسلفنا", "عقدنا", "مررنا", "عرفناه", "عرفناها"].map((w) => ({ words: [w], label: w })),
  ...["معها", "معه", "عند"].map((w) => ({ words: ["تركنا", w], label: `تركنا ${w}` })),
  { words: ["توقفنا", "عند"], label: "توقفنا عند" },
  { words: ["وقفنا", "عند"], label: "وقفنا عند" },
  { words: ["راينا", "في"], label: "رأينا في" },
  { words: ["سبق", "ان"], label: "سبق أن" },
  { words: ["مر", "بنا"], label: "مرّ بنا" },
  { words: ["الحلقه"], label: "الحلقة" },
  { words: ["حلقتنا"], label: "حلقتنا" },
  { words: ["الحلقات"], label: "الحلقات" },
  { words: ["هذا", "الجزء"], label: "هذا الجزء" },
  { words: ["الجزء", "الاول"], label: "الجزء الأول" },
  { words: ["الجزء", "الثاني"], label: "الجزء الثاني" },
  { words: ["الجزء", "الماضي"], label: "الجزء الماضي" },
  { words: ["الجزء", "القادم"], label: "الجزء القادم" },
  { words: ["انفا"], label: "آنفًا" },
  { words: ["سنري"], label: "سنرى" },
  { words: ["سنعرف"], label: "سنعرف" },
  { words: ["سنعود"], label: "سنعود" },
  { words: ["سنتحدث"], label: "سنتحدث" },
];

/** اسم الإشارة (يُعلَّم في أول جملة من كل جزء وحدها). */
const DEMONSTRATIVES = new Set(["هذا", "هذه", "ذلك", "تلك", "هولاء", "اولئك", "اوليك", "هذان", "هاتان", "هذين", "هاتين", "ذاك", "ذلكم", "هكذا", "هنا", "هناك"]);
/** ضمائر محيلة إلى ما قبلها */
const REFERRING = /^(بعد|قبل|مثل|بين)(ه|ها|هما|هم|هن)$/;
/** أدوات تفترض كلامًا قبلها إن بدأت بها الجملة الأولى من الجزء */
const START_CONNECTIVES = new Set(["الجواب", "ثم", "لكن", "لكنه", "لكنها", "لكنهم", "بل", "اما", "اذن", "ايضا", "كذلك", "لذلك", "لهذا", "بذلك", "بهذا",
  "الثاني", "الثالث", "الرابع", "الخامس", "السادس", "الاخير", "الاخيره", "الثانيه", "الثالثه", "الرابعه"]);
/** «ايضا» و«كذلك» تفترضان ما قبلهما في أي موضع من الجملة الأولى */
const START_ANYWHERE_IN_FIRST = new Set(["ايضا", "كذلك"]);
const PREFIXES = ["و", "ف", "ب", "ل", "ك", "وب", "ول", "فب", "فل", "وك", "فك"];
/** الكلمة نفسها أو بأداة ملتصقة قبلها (و، ف، ب، ل، ك) إن كان الباقي في القائمة */
const baseOf = (tok: string, inSet: (w: string) => boolean): string | null => {
  if (inSet(tok)) return tok;
  for (const p of PREFIXES) if (tok.startsWith(p) && tok.length - p.length >= 2 && inSet(tok.slice(p.length))) return tok.slice(p.length);
  return null;
};

export type OutwardHit = { label: string; word: string };
/** كلمات الإشارة إلى خارج الشورت في جملة. `first`: الجملة الأولى من جزء (تُفحص فيها الإشارة والوصل أيضًا). */
export const outwardHits = (s: IdeaSentence, first: boolean): OutwardHit[] => {
  if (s.kind !== "narration") return [];
  const toks = tokensOf(ownWords(s.text));
  const hits: OutwardHit[] = [];
  const seen = new Set<string>();
  const add = (label: string, word: string) => { if (!seen.has(label)) { seen.add(label); hits.push({ label, word }); } };
  for (let i = 0; i < toks.length; i++) {
    for (const p of OUTWARD_ANYWHERE) {
      const [w0, ...rest] = p.words;
      const t0 = toks[i]!;
      const head = t0 === w0 || (/^[وف]/.test(t0) && t0.slice(1) === w0);
      if (head && rest.every((w, k) => toks[i + 1 + k] === w)) add(p.label, toks.slice(i, i + p.words.length).join(" "));
    }
  }
  // «حلقة» نكرةً: حلقة من الحلقات بعد «في/كل/أي/هذه/من» («في حلقة سابقة»، «كانت هذه حلقة من سلسلة»)، لا حلقة البيوت والناس
  toks.forEach((t, i) => {
    if (/^[وف]?حلقه$/.test(t) && /^([وف]?(في|كل|اي|هذه|من))$/.test(toks[i - 1] ?? "")) add("حلقة", `${toks[i - 1]} ${t}`);
    // «بعد قليل» إشارة إلى ما يأتي في الحلقة («نعود إليه بعد قليل»)، لا في أول الجملة سردًا («وبعد قليل، رأى…»)
    if (i > 0 && /^[وف]?بعد$/.test(t) && toks[i + 1] === "قليل") add("بعد قليل", "بعد قليل");
  });
  if (!first) return hits;
  // ما بعد أول فاصلة في الجملة قد يحيل إلى ما قبلها في الجملة نفسها («انتقل إلى مدينته، واستمر العمل بعد ذلك سنوات»):
  // هناك تُعلَّم الإشارة المتبوعة باسم معرّف وحدها («في تلك البلاد»)، لا القائمة بنفسها («بعد ذلك»)
  const commaAt = (() => {
    const own = normalizeIdea(ownWords(s.text));
    const k = own.search(/[،,]/);
    return k < 0 ? Infinity : tokensOf(own.slice(0, k)).length;
  })();
  toks.forEach((t, i) => {
    const afterComma = i >= commaAt;
    const nounNext = /^(ال|[وفبلك]ال)/.test(toks[i + 1] ?? "");
    const d = baseOf(t, (w) => DEMONSTRATIVES.has(w));
    // «هنا» و«هناك» مكانًا لا إشارةً إلى كلام سابق إلا في أول الجملة («وهنا يظهر الفرق»)
    if (d && (d !== "هنا" && d !== "هناك" || i === 0) && (!afterComma || nounNext)) add(`إشارة «${d}»`, t);
    if ((REFERRING.test(t) || (/^[وف]/.test(t) && REFERRING.test(t.slice(1)))) && !afterComma) add(`إحالة «${t}»`, t);
    const c = baseOf(t, (w) => START_CONNECTIVES.has(w));
    if (c && (i === 0 || START_ANYWHERE_IN_FIRST.has(c))) add(`وصل «${t}»`, t);
  });
  // «أي» تفسيرًا في أول الجملة («أي صرفتهم عن دينهم») لا سؤالًا
  if (toks[0] === "اي" && !isQuestion(s)) add("تفسير «أي»", toks[0]!);
  return hits;
};

/* ── الفحص ── */

const quote = (t: string) => `«${t.trim()}»`;

/** يفحص شورتًا واحدًا على جمل حلقته بالقاعدة D241. */
export const checkShortIdea = (episode: readonly IdeaSentence[], spec: ShortIdeaSpec): ShortIdeaResult => {
  const issues: ShortIdeaIssue[] = [];
  const parts = spec.parts.filter(([a, b]) => Number.isInteger(a) && Number.isInteger(b));
  const bad = parts.find(([a, b]) => a < 0 || b >= episode.length || a > b);
  if (!parts.length || bad) {
    issues.push({ rule: "empty", message: bad ? "جزء من الشورت خارج جمل الحلقة." : "الشورت بلا جمل." });
    return { ok: false, issues, sentences: [] };
  }
  const used = new Set<number>();
  for (const [a, b] of parts) for (let i = a; i <= b; i++) {
    if (used.has(i)) { issues.push({ rule: "empty", message: `الجملة ${quote(episode[i]!.text)} مكررة في الشورت.`, index: i }); }
    used.add(i);
  }
  const sentences = parts.flatMap(([a, b]) => episode.slice(a, b + 1));
  if (!sentences.some((s) => s.kind === "narration" && s.text.trim()))
    issues.push({ rule: "empty", message: "الشورت بلا سرد: آية أو حديث وحده لا يحمل فكرة بلا كلام قبله وبعده." });

  parts.forEach(([a, b], k) => {
    const label = parts.length > 1 ? `الجزء ${k + 1}` : "الشورت";
    // البداية: ما قبلها في الحلقة جملة تامة (أو هو آخر الجزء السابق نفسه)
    const prevPartEnd = k > 0 ? parts[k - 1]![1] : -2;
    const before = episode[a - 1];
    if (before && a - 1 !== prevPartEnd && !isClosedSentence(before))
      issues.push({ rule: "start", index: a, sentence: episode[a]!.text,
        message: `${label === "الشورت" ? "" : `${label}: `}قبله في الحلقة ${quote(before.text)} ولم تتم الجملة.` });
    // النهاية: آخر جملة تامة، ولا تمهّد لآية أو حديث بعدها خارج الشورت
    const last = episode[b]!;
    const nextPartStart = k < parts.length - 1 ? parts[k + 1]![0] : -2;
    if (!isClosedSentence(last) && b + 1 !== nextPartStart)
      issues.push({ rule: "end", index: b, sentence: last.text,
        message: `${label === "الشورت" ? "" : `${label}: `}آخره ${quote(last.text)} ولم تتم الجملة.` });
    // الإشارة إلى الخارج
    for (let i = a; i <= b; i++) {
      for (const h of outwardHits(episode[i]!, i === a))
        issues.push({ rule: "outward", index: i, sentence: episode[i]!.text,
          message: `${h.label} في ${quote(episode[i]!.text)}.` });
    }
  });

  // الختام: لا ينتهي بسؤال بلا جواب إلا سؤال التعليقات المقصود
  const lastIdx = parts.at(-1)![1];
  const last = episode[lastIdx]!;
  if (endsWithQuestion(last) && !spec.commentClose && !isCommentCta(last.text))
    issues.push({ rule: "question", index: lastIdx, sentence: last.text,
      message: `${quote(last.text)} جوابه ليس في الشورت. أضف جملة الجواب من الحلقة، أو اجعل الختام سؤال التعليقات المقصود.` });

  // الخطاف: أول جملة سؤال أو علّمها المحرر/المالك خطافًا
  const firstIdx = parts[0]![0];
  const first = episode[firstIdx]!;
  if (!spec.hook && !isQuestion(first))
    issues.push({ rule: "hook", index: firstIdx, sentence: first.text,
      message: `أول جملة ${quote(first.text)} ليست سؤالًا ولم تُعلَّم خطافًا (hook: "line": حقيقة مدهشة أو رقم أو جملة لافتة).` });

  return { ok: issues.length === 0, issues, sentences };
};

export const RULE_LABEL: Record<ShortIdeaRule, string> = {
  empty: "بلا فكرة",
  start: "يبدأ في منتصف الكلام",
  end: "ينتهي في منتصف الكلام",
  outward: "كلمة تشير إلى خارجه",
  question: "سؤال بلا جواب في آخره",
  hook: "بلا خطاف في أوله",
};
