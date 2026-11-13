/**
 * The citations and the practical step that make a one-chapter test script pass the script
 * checker, so a fixture can go through the preparation checks (H6: the direct «approve-script» /
 * «approve-storyboard» routes refuse a script with errors, exactly like «اعتمد التجهيز»).
 */
// 12 Nov (QA balislam 2): no narration here that the fixtures' plans do not say — a script line no scene says now
// refuses the preparation approval. Sections are optional since D87, so the one-chapter script passes as it is.
export const prepValidTail = (extraCitations: string[] = []) =>
  `\n## الاستشهادات\n\n- مصدر | كتاب الصبر، المؤلف، ص ١٢ | فكرة الصبر\n${extraCitations.map((c) => `${c}\n`).join("")}` +
  "\n## الخطوة العملية\n\nاصبر اليوم على أمر واحد صغير، ثم اكتب ما تعلمته.\n";
export const PREP_VALID_TAIL = prepValidTail();
