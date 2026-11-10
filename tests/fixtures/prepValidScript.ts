/**
 * Chapters 2–6, the citations and the practical step that make a one-chapter test script pass the script
 * checker, so a fixture can go through the preparation checks (H6: the direct «approve-script» /
 * «approve-storyboard» routes refuse a script with errors, exactly like «اعتمد التجهيز»).
 */
export const prepValidTail = (extraCitations: string[] = []) =>
  ["الواقع", "الجذر", "بعين الإسلام", "في حياتك", "الخلاصة"].map((t, i) =>
    `\n## الفصل ${i + 2} · ${t}\nجملة قصيرة في هذا الفصل.\n`).join("") +
  `\n## الاستشهادات\n\n- مصدر | كتاب الصبر، المؤلف، ص ١٢ | فكرة الصبر\n${extraCitations.map((c) => `${c}\n`).join("")}` +
  "\n## الخطوة العملية\n\nاصبر اليوم على أمر واحد صغير، ثم اكتب ما تعلمته.\n";
export const PREP_VALID_TAIL = prepValidTail();
