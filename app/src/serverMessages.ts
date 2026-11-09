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
  "Review and approve every current storyboard scene with a review note before starting AV production.": "سجّل مراجعة اللوحات أولًا: في الستوري بورد ← «أدوات وتفاصيل» ← «سجل مراجعة اللوحات»، ثم اعتمد.",
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
  "Approve the current script and complete storyboard before producing a scene.": "اعتمد السكريبت والستوري بورد (الخطوتان ١ و٢) قبل إنتاج أي مشهد.",
  "The scene is not current or its inputs changed.": "هذا ليس المشهد الحالي أو تغيّر منذ عرضه؛ حُدّثت الحالة.",
  "Only the current or a later unapproved scene can be prepared, with its current inputs.": "يُجهَّز المشهد الحالي وما بعده فقط، بمدخلاته الحالية.",
  "An approved or submitted scene is never re-rendered as a draft.": "المشهد المعتمد أو المرسل للمراجعة لا يُعاد رندره مسودةً.",
  "The scene narration or human Quran recording is not ready for AV production.": "صوت المشهد أو تسجيل التلاوة غير جاهز بعد؛ ولّد الصوت أو أرفق التلاوة أولًا.",
  "Scene changed before the AV evidence was recorded.": "تغيّر المشهد أثناء الرندر؛ أنتجه من جديد.",
  "Current storyboard review is missing or stale.": "مراجعة الستوري بورد ناقصة أو قديمة؛ سجّلها واعتمده من جديد.",
  "Watch the assembled episode at 1× and approve it with every scene transition before creating Master.": "شاهد النسخة المجمعة 1× وافحص كل وصلة واعتمدها قبل صنع النسخة النهائية.",
  "Approve and assemble all current audiovisual scenes before creating Master.": "اعتمد كل المشاهد واجمعها قبل صنع النسخة النهائية.",
  "Final assembly changed after approval.": "تغيّرت النسخة المجمعة بعد اعتمادها؛ تحتاج اعتمادًا جديدًا.",
  "No safe, signed scene cuts are ready for assembly.": "لا توجد مشاهد معتمدة جاهزة للتجميع بعد.",
  "All approved AV scenes must use matching video dimensions and audio track structure.": "المشاهد المعتمدة مختلفة الأبعاد أو بنية الصوت؛ أعد إنتاج المختلف منها.",
  "One or more approved AV scenes changed while the episode was assembling.": "تغيّر مشهد معتمد أثناء التجميع؛ أعد التجميع.",
  "AV/Master review requires a playable video with an audio track, valid duration and required resolution.": "الفيديو غير صالح للمراجعة: يلزم مقطع قابل للتشغيل فيه مسار صوت ومدة ودقة صحيحة. أنتجه من جديد.",
};
const PATTERNS: [RegExp, (m: RegExpMatchArray) => string][] = [
  [/^Scene (\S+) has changed after audiovisual approval\.$/, (m) => `تغيّر المشهد ${m[1]} بعد اعتماده؛ يحتاج إنتاجًا واعتمادًا جديدين.`],
  // Render-browser download failures that escape the renderer's own wrapper (D36).
  [/(getaddrinfo (ENOTFOUND|EAI_AGAIN)[^\n]*remotion|remotion\.media|download(ing)? (the )?(chrome|browser)|headless shell)/i, () =>
    "تعذّر تجهيز متصفح الرندر (يُنزَّل مرة واحدة عند أول رندر). صِل الجهاز بالإنترنت ثم اضغط الزر نفسه مرة أخرى؛ الاستوديو ما زال يعمل ولم يُحذف شيء."],
];

export const ownerMessage = (message: string): string => {
  const text = message.trim();
  const exact = EXACT[text];
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
  return message;
};
