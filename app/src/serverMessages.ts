/**
 * Server refusals the owner can see, in Arabic. The server's own messages stay English (logs, CLI,
 * tests); the Studio shows the owner the Arabic sentence and what to do next. Unknown messages pass
 * through unchanged.
 */
const EXACT: Record<string, string> = {
  "Owner actions are allowed only from the Studio on this device (127.0.0.1, same page).": "هذا الفعل مسموح من الاستوديو على جهاز المالك فقط (127.0.0.1، من الصفحة نفسها).",
  "Prepare and save a storyboard plan first.": "جهّز خطة الستوري بورد واحفظها أولًا.",
  "Scene approval ledger is invalid; manual recovery required.": "سجل اعتمادات المشاهد تالف؛ يحتاج استعادة يدوية قبل أي اعتماد.",
  "Scene approval ledger signature changed; approvals are blocked.": "توقيع سجل اعتمادات المشاهد تغيّر؛ الاعتماد موقوف حمايةً للسجل.",
  "Scene approval ledger is busy. Never delete another writer lock.": "سجل الاعتمادات مشغول بعملية أخرى الآن؛ انتظر لحظة ثم أعد المحاولة.",
  "Script changed before review.": "تغيّر السكريبت منذ فتحته؛ حُدّثت الحالة، راجعه ثم اعتمد مجددًا.",
  "Review and approve every current storyboard scene with a review note before starting AV production.": "لم يُعتمد التجهيز بعد: افتح «١ التجهيز»، راجع اللوحات، ثم اضغط «اعتمد التجهيز».",
  "Storyboard changed before review.": "تغيّر الستوري بورد منذ فتحته (أو سُجّلت مراجعة اللوحات للتو)؛ حُدّثت الحالة، اعتمد مجددًا.",
  "The assembled video changed.": "تغيّرت النسخة المجمعة منذ عرضها؛ شاهدها من جديد.",
  "Watch the full assembled episode at 1× first.": "شاهد النسخة المجمعة كاملة بسرعة 1× أولًا.",
  "Assembled episode changed after it was recorded; record it again.": "تغيّرت النسخة المجمعة بعد تسجيلها؛ سجّلها من جديد.",
  "Confirm the publish decision explicitly.": "أكّد قرار النشر صراحةً.",
  "The Master file changed.": "تغيّر ملف النسخة النهائية منذ عرضه؛ شاهده من جديد.",
  "Master changed after the owner's final approval.": "تغيّرت النسخة النهائية بعد اعتمادك؛ تحتاج اعتمادًا جديدًا.",
  "Full-episode human 1× review is required.": "شاهد الحلقة كاملة بسرعة 1× قبل الاعتماد.",
  "Assembled episode changed before Master review.": "تغيّرت النسخة المجمعة قبل مراجعة النسخة النهائية؛ أعد التجميع والاعتماد.",
  "Unknown scene.": "مشهد غير معروف.",
  "Narration or the reviewed Quran recording is missing.": "ينقص المشهد صوته أو تسجيل التلاوة المعتمد.",
  "Scene inputs changed.": "تغيّر المشهد منذ عرضه؛ حُدّثت الحالة.",
  "Preview lacks a current trusted render-to-source proof; rerender this scene.": "معاينة المشهد قديمة أو بلا إثبات رندر حالي؛ أنتج المشهد من جديد.",
  "A current scene preview and a correction reason are required.": "اكتب سبب التعديل على معاينة حالية للمشهد.",
  "Please review the complete scene with picture and sound.": "شاهد المشهد كاملًا بالصوت والصورة ثم أكّد.",
  "Preview generation changed; submit it again.": "تغيّرت معاينة المشهد؛ شاهدها من جديد.",
  "The preview changed since it was shown for review.": "تغيّرت معاينة المشهد منذ عرضها؛ شاهدها من جديد.",
  "Source files changed during review; reload before approving.": "تغيّرت ملفات الحلقة أثناء المراجعة؛ حدّث الصفحة ثم اعتمد.",
  "Approve the current script and complete storyboard before producing a scene.": "اعتمد التجهيز (السكريبت والستوري بورد، الخطوة ١) قبل إنتاج أي مشهد.",
  "The scene is not current or its inputs changed.": "تغيّر هذا المشهد منذ عرضه؛ حُدّثت الحالة.",
  "This scene is approved; an edit to it re-opens it for a new production and review.": "هذا المشهد معتمد؛ أي تعديل فيه يعيده وحده للإنتاج والمراجعة.",
  "An approved or submitted scene is never re-rendered as a draft.": "المشهد المعتمد أو المرسل للمراجعة لا يُعاد رندره مسودةً.",
  "The scene narration or human Quran recording is not ready for AV production.": "صوت المشهد أو تسجيل التلاوة غير جاهز بعد؛ ولّد الصوت أو أرفق التلاوة أولًا.",
  "Scene changed before the AV evidence was recorded.": "تغيّر المشهد أثناء الرندر؛ أنتجه من جديد.",
  "Current storyboard review is missing or stale.": "مراجعة اللوحات ناقصة: افتح «١ التجهيز» واعتمد التجهيز.",
  // Step ١ «اعتمد التجهيز» (src/studio/preparation.ts)
  "This scene awaits a change after your correction; producing it again from the same inputs gives the same cut.": "بانتظار التعديل: إنتاجه بالمدخلات نفسها يعطي النسخة نفسها. يُنتج من جديد حين يتغيّر (نبرة، نص، لوحة) أو حين تُجاب ملاحظتك «أُصلحت».",
  "No assembled episode awaits review.": "لا نسخة مجمعة تنتظر المراجعة الآن؛ حُدّثت الحالة.",
  "Unknown seam.": "وصلة غير معروفة في هذه النسخة المجمعة؛ حُدّثت الحالة.",
  "Say how the seam was heard: played, or «سمعتها».": "استمع للوصلة أولًا، أو ضع علامة «سمعتها».",
  "Play the whole seam window first (3 s before and after), or tick «سمعتها».": "استمع للوصلة كاملة أولًا (٣ ث قبلها و٣ بعدها)، أو ضع علامة «سمعتها».",
  "Seam checks are busy.": "حفظ الوصلات مشغول لحظة؛ أعد المحاولة.",
  "Malformed board approval.": "طلب اعتماد اللوحة غير مكتمل؛ حدّث الصفحة ثم اعتمد من جديد.",
  "Confirm that you reviewed this board yourself («راجعته بنفسي»).": "ضع علامة «راجعته بنفسي» بعد مراجعة لوحة هذا المشهد، ثم اعتمد.",
  "Malformed preparation approval.": "طلب اعتماد التجهيز غير مكتمل؛ حدّث الصفحة ثم اعتمد من جديد.",
  "Confirm that you reviewed the script and every board yourself.": "ضع علامة «راجعته بنفسي» بعد مراجعة السكريبت وكل لوحة، ثم اعتمد.",
  "Fix the script errors before approving the preparation.": "صحّح أخطاء السكريبت أولًا (القائمة في «١ التجهيز ← السكريبت»)، ثم اعتمد التجهيز.",
  "No boards changed since the last approval.": "لا لوحات تغيّرت منذ آخر اعتماد؛ حُدّثت الحالة.",
  "Approve the current script first.": "اعتمد السكريبت الحالي أولًا («١ التجهيز»).",
  "The script changed before approval.": "تغيّر السكريبت منذ فتحته؛ حُدّثت الحالة، راجعه ثم اعتمد مجددًا.",
  "The storyboard changed before approval.": "تغيّر الستوري بورد منذ فتحته؛ حُدّثت الحالة، اعتمد مجددًا.",
  "Script already approved; edit explicitly to reopen.": "السكريبت معتمد بالفعل؛ حُدّثت الحالة.",
  "Storyboard already approved; edit explicitly to reopen.": "الستوري بورد معتمد بالفعل؛ حُدّثت الحالة.",
  "Every scene needs a stable, safe, unique identifier.": "كل مشهد يحتاج معرّفًا ثابتًا فريدًا؛ أعد تجهيز الخطة من السكريبت.",
  "A Studio source is not a regular file.": "أحد ملفات الحلقة ليس ملفًا عاديًا (اختصار أو مجلد)؛ أرسل هذه الرسالة إلى Claude.",
  "Scene ledger is not a regular file.": "سجل اعتمادات المشاهد ليس ملفًا عاديًا؛ أرسل هذه الرسالة إلى Claude.",
  "Cannot lock scene approvals.": "تعذّر قفل سجل الاعتمادات الآن؛ أعد المحاولة بعد لحظة.",
  "A real human review identity and time are required.": "القرار يحتاج هوية المراجع ووقته؛ اعتمد من الاستوديو على جهاز المالك.",
  "A channel, episode, and at least one scene are required.": "الحلقة بلا مشاهد بعد؛ جهّز الخطة من السكريبت أولًا.",
  "Scene ids must be unique and non-empty.": "في الخطة مشهدان بالمعرّف نفسه أو مشهد بلا معرّف؛ أعد تجهيز الخطة من السكريبت.",
  "Script and storyboard must be approved first.": "اعتمد التجهيز أولًا (السكريبت والستوري بورد، «١ التجهيز»).",
  "The submitted sound/visual input differs from the current scene.": "تغيّر المشهد منذ إرسال معاينته؛ أنتجه وشاهده من جديد.",
  "Review the scene with its audio and picture.": "شاهد المشهد كاملًا بالصوت والصورة ثم أكّد.",
  "Review the latest rendered audiovisual preview before approving.": "شاهد آخر معاينة مرندرة للمشهد بالصوت والصورة قبل الاعتماد.",
  "Only a submitted AV scene can be returned for correction.": "يُطلب التعديل على مشهد معروض للمراجعة فقط؛ حُدّثت الحالة.",
  "All audiovisual scenes and upstream sources must be approved.": "اعتمد التجهيز وكل المشاهد بالصوت والصورة أولًا.",
  "The full assembled episode must be watched at normal speed.": "شاهد النسخة المجمعة كاملة بسرعة 1× أولًا.",
  "Review the current assembly of all approved scenes.": "شاهد النسخة المجمعة الحالية لكل المشاهد المعتمدة أولًا.",
  "The full Master must be watched at normal speed.": "شاهد النسخة النهائية كاملة بسرعة 1× أولًا.",
  "A current assembly of all approved scenes must be reviewed.": "اعتمد النسخة المجمعة الحالية لكل المشاهد أولًا («٣ النسخة النهائية»).",
  "Approve the assembled episode and its scene transitions before the Master.": "اعتمد النسخة المجمعة ووصلاتها قبل صنع النسخة النهائية.",
  "The exact current Master is not approved.": "النسخة النهائية لم تُعتمد بعد (أو تغيّر ملفها بعد اعتمادها)؛ شاهدها واعتمدها في «٣ النسخة النهائية».",
  "Publishing is blocked: give explicit publish permission for this exact Master.": "النشر موقوف: امنح إذن النشر لهذه النسخة النهائية بعينها في «٤ النشر».",
  "Episode changed while locking.": "تغيّرت ملفات الحلقة أثناء العملية؛ حدّث الصفحة ثم أعد المحاولة.",
  "Invalid scene id.": "معرّف المشهد غير صالح.",
  "Malformed scene review command.": "طلب القرار غير مكتمل؛ حدّث الصفحة ثم أعد المحاولة.",
  "The narration for this scene is missing.": "ينقص المشهد صوته؛ ولّد الصوت أولًا.",
  "The scene narration is not ready for AV production.": "صوت المشهد غير جاهز بعد؛ ولّد الصوت أولًا.",
  "Invalid scene preview request.": "طلب معاينة المشهد غير صالح؛ حدّث الصفحة ثم أعد المحاولة.",
  "A render may never change an approval decision.": "الرندر لا يغيّر قرارات الاعتماد؛ أرسل هذه الرسالة إلى Claude.",
  "All AV scene cuts must use matching video dimensions and audio track structure.": "المشاهد مختلفة الأبعاد أو بنية الصوت؛ أعد إنتاج المختلف منها.",
  "No safe scene cuts are ready for the pre-final preview.": "لا توجد مشاهد جاهزة لمعاينة ما قبل النهائية بعد.",
  "A scene changed while the pre-final preview was assembling; try again.": "تغيّر مشهد أثناء تجميع المعاينة؛ أعد المحاولة.",
  "A scene review preview cannot be used as a Master approval.": "معاينة المراجعة لا تصلح نسخةً نهائية؛ اصنع النسخة النهائية من «٣ النسخة النهائية».",
  "Draft marks (a pending recitation) belong only to a scene review draft, never to a Master.": "لا تُصنع النسخة النهائية وفيها آية بانتظار تلاوتها؛ أرفق التلاوات أولًا.",
  "Invalid preview index": "فهرس المعاينات تالف؛ أرسل هذه الرسالة إلى Claude.",
  "Publishing is blocked.": "النشر موقوف: النسخة النهائية لم تُعتمد أو لم يُمنح إذن النشر بعد.",
  "Watch the assembled episode at 1× and approve it with every scene transition before creating Master.": "شاهد النسخة المجمعة 1× وافحص كل وصلة واعتمدها قبل صنع النسخة النهائية.",
  "Approve and assemble all current audiovisual scenes before creating Master.": "اعتمد كل المشاهد واجمعها قبل صنع النسخة النهائية.",
  "Final assembly changed after approval.": "تغيّرت النسخة المجمعة بعد اعتمادها؛ تحتاج اعتمادًا جديدًا.",
  "No safe, signed scene cuts are ready for assembly.": "لا توجد مشاهد معتمدة جاهزة للتجميع بعد.",
  "All approved AV scenes must use matching video dimensions and audio track structure.": "المشاهد المعتمدة مختلفة الأبعاد أو بنية الصوت؛ أعد إنتاج المختلف منها.",
  "One or more approved AV scenes changed while the episode was assembling.": "تغيّر مشهد معتمد أثناء التجميع؛ أعد التجميع.",
  "AV/Master review requires a playable video with an audio track, valid duration and required resolution.": "الفيديو غير صالح للمراجعة: يلزم مقطع قابل للتشغيل فيه مسار صوت ومدة ودقة صحيحة. أنتجه من جديد.",
};
const PATTERNS: [RegExp, (m: RegExpMatchArray) => string][] = [
  // QA 12 Nov: raw ffmpeg/ffprobe command lines never reach the owner.
  [/Command failed: ffprobe[\s\S]*previews\/episode\.mp4[\s\S]*No such file or directory/, () => "لا نسخة مجمعة للحلقة على هذا الجهاز بعد؛ اجمع المشاهد المعتمدة أولًا في «٣ النسخة النهائية»."],
  [/Command failed: ffmpeg[\s\S]*(?:measured_I|-inf\b|Value -inf)/, () => "الملف صامت أو فارغ: لا صوت مسموع فيه. سجّل التلاوة من جديد وارفعها."],
  [/Command failed: ffprobe[\s\S]*No such file or directory/, () => "الملف المطلوب لم يُصنع بعد على هذا الجهاز؛ أنتجه أولًا ثم أعد المحاولة."],
  [/Command failed: (?:ffmpeg|ffprobe)/, () => "تعذّرت معالجة الملف الصوتي أو المرئي: صيغته غير مدعومة أو هو تالف. ارفعه بصيغة أخرى (MP3 أو WAV أو M4A للصوت)."],
  // D145: the assembly says which scenes are left (any order); the Studio names the ids «المشهد ٣».
  [/^All audiovisual scenes must be approved first; not approved yet: (.+)\.$/, (m) => `التجميع ينتظر اعتماد كل المشاهد؛ لم يُعتمد بعد: ${m[1]!.split(", ").join("، ")}.`],
  [/^Scene (\S+) has changed after audiovisual approval\.$/, (m) => `تغيّر المشهد ${m[1]} بعد اعتماده؛ يحتاج إنتاجًا واعتمادًا جديدين.`],
  // Render-browser download failures that escape the renderer's own wrapper (D36).
  [/(getaddrinfo (ENOTFOUND|EAI_AGAIN)[^\n]*remotion|remotion\.media|download(ing)? (the )?(chrome|browser)|headless shell)/i, () =>
    "تعذّر تجهيز متصفح الرندر (يُنزَّل مرة واحدة عند أول رندر). صِل الجهاز بالإنترنت ثم اضغط الزر نفسه مرة أخرى؛ الاستوديو ما زال يعمل ولم يُحذف شيء."],
];

/**
 * A job as the owner sees it (P-07): its error and every log line through the same translator, so a refusal
 * thrown inside a long job (render, package, shorts, scene preparation) reads in Arabic like a direct refusal.
 */
export const ownerJob = <T extends { error?: string; log?: string[] } | null | undefined>(job: T): T => {
  if (!job) return job;
  const out = { ...job } as NonNullable<T> & { error?: string; log?: string[]; voice?: { error?: string }; failed?: { error: string }[]; skipped?: { error?: string }[] };
  if (typeof out.error === "string") out.error = ownerMessage(out.error);
  // Log lines are progress, not refusals: translated when known, never wrapped as a failure.
  if (Array.isArray(out.log)) out.log = out.log.map((l) => (typeof l === "string" ? ownerMessage(l, { untranslated: false }) : l));
  if (out.voice && typeof out.voice.error === "string") out.voice = { ...out.voice, error: ownerMessage(out.voice.error) };
  if (Array.isArray(out.failed)) out.failed = out.failed.map((f) => ({ ...f, error: ownerMessage(f.error ?? "") }));
  if (Array.isArray(out.skipped)) out.skipped = out.skipped.map((f) => (typeof f.error === "string" ? { ...f, error: ownerMessage(f.error) } : f));
  return out as T;
};

export const ownerMessage = (message: string, opts: { untranslated?: boolean } = {}): string => {
  const text = message.trim();
  const exact = EXACT[text] ?? EXACT[text.replace(/^Error:\s*/, "")];
  if (exact) return exact;
  // Already the renderer's own Arabic explanation (with what to do): keep it whole.
  if (text.includes("تعذّر تجهيز متصفح الرندر")) return message;
  for (const [re, fn] of PATTERNS) {
    const m = text.match(re);
    if (m) return fn(m);
  }
  // Per-scene failure lists ("c6-end: <message>") keep their prefix.
  const prefixed = text.match(/^([a-z0-9-]+): (.+)$/s);
  if (prefixed && EXACT[prefixed[2]!.trim()]) return `${prefixed[1]}: ${EXACT[prefixed[2]!.trim()]}`;
  // QA 12 Nov: a refusal still in English reads in Arabic first; the server's own words follow as the details.
  // KI-009 (owner, 12 Nov): the screen shows the Arabic lead; OwnerText folds these details under «تفاصيل».
  if (opts.untranslated !== false && text && !/[\u0600-\u06FF]/.test(text) && /[A-Za-z]{3}/.test(text)) return `${UNTRANSLATED} (التفاصيل: ${text.slice(0, DETAILS_MAX)})`;
  return message;
};
/** The Arabic lead of a server refusal that has no translation yet (the English text follows as its details). */
export const UNTRANSLATED = "تعذّر تنفيذ الطلب؛ إن تكرر فأرسل هذه الرسالة إلى Claude.";
/** The server's own words are kept whole enough to diagnose (they are folded away, not shown). */
const DETAILS_MAX = 1200;
const DETAILED = /^([\s\S]*?) \(التفاصيل: ([\s\S]*)\)$/;

/**
 * Splits an owner message into the Arabic sentence the owner reads and the technical text that only
 * goes under «تفاصيل» (KI-009). Only the untranslated-refusal form is split; any other text is the lead.
 */
export const splitOwnerDetails = (text: string): { lead: string; details: string | null } => {
  const m = text.match(DETAILED);
  if (!m || !m[1]!.endsWith(UNTRANSLATED)) return { lead: text, details: null };
  return { lead: m[1]!, details: m[2]! };
};
