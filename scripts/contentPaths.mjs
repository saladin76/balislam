import { spawnSync } from "node:child_process";

/**
 * تصنيف الملفات التي يكتبها الاستوديو على جهاز المالك (D101): «محتوى المالك» يُحفظ في main آليًا،
 * وكل ما عداه محلي للجهاز ولا يُرفع أبدًا.
 *
 * يستعمله:
 *   - app/server/contentSync.ts: لا يُدرج في commit الحفظ الآلي إلا مسار يطابق CONTENT_PATH_RES.
 *   - scripts/gate.mjs وخطاف pre-push: دفعٌ كل ملفاته محتوى مالك (وليست كودًا) يمر على «بوابة المحتوى»
 *     (فحوص البيانات نفسها)، وأي ملف آخر في الدفع يُعيده إلى البوابة الكاملة. القرار بالفرق (diff) لا بالرسالة.
 *
 * ما ليس هنا عمدًا (محلي للجهاز، أكثره في .gitignore): سجل الاعتماد الموقَّع وأقفاله، script-approved،
 * storyboard.json (سجل مراجعة اللوحات)، قفل كتابة الخطة plan.json.write.lock والنسخ plan.backup-*.json (D110)، voice/ وكل الصوت والفيديو، previews/*.mp4، notes/inbox.json
 * (يُرفع وحده إلى studio-notes)، notes/resolved.json (يكتبه Claude لا الاستوديو)، .env، out/ وrenders/.
 */

/** @type {RegExp[]} */
export const CONTENT_PATH_RES = [
  // ملفات الحلقة التي يحرّرها المالك في الاستوديو
  /^channels\/[a-z0-9-]+\/episodes\/[^/]+\/(script\.md|plan\.json|research\.md|publish\.json|series\.json|tashkeel\.md|tone-map\.json|review\.json|sentence-pronunciations\.json|pace\.json|scenes\.md|publish\.draft\.json)$/,
  // نسخ خريطة النبرة السابقة (tone-map.v1.9.json) التي يشير إليها `previous` في tone-map.json (KI-050، D113)
  /^channels\/[a-z0-9-]+\/episodes\/[^/]+\/tone-map\.v[0-9]+(\.[0-9]+)*\.json$/,
  // فهرس المعاينات وحده (العنوان والبصمة ورابط Drive)، لا الفيديو
  /^channels\/[a-z0-9-]+\/episodes\/[^/]+\/previews\/index\.json$/,
  // فهرس لوحات المختبرات وقراراتها
  /^channels\/[a-z0-9-]+\/episodes\/[^/]+\/storyboards\/index\.json$/,
  // ملفات القناة: النطق، الأفكار، التقويم، إعدادات القناة وأدوات المحرك، الهوية
  /^channels\/[a-z0-9-]+\/(pronunciations\.json|pronunciation\.json|ideas\.json|calendar\.json|channel\.json|identity\.json)$/,
  // السلاسل والتصنيفات (D71)
  /^channels\/[a-z0-9-]+\/series\/[^/]+\/series\.json$/,
  // سجل العلماء وسجل الكتب (D206): «زبدة الكتب» صاحبتهما، و«دفاتر الزمن» تقرؤهما
  /^channels\/zubdat-alkutub\/library\/(scholars|books)\.json$/,
  // مواسم السنة الهجرية لكل قناة (عمود «بالإسلام»، عاشرًا/٦)
  /^channels\/[a-z0-9-]+\/seasons\.json$/,
  // D234: سجل مرور محرر المحتوى لكل حلقة (بصمات الجمل، ومن راجع ومتى)؛ يسجّله المنسّق بعد رد المحرر
  /^channels\/[a-z0-9-]+\/episodes\/[^/]+\/editor-review\.json$/,
  // ترتيب النشر وبناء المخزون (D213): الأسابيع والدفعات وتجميد القناة (D211)
  /^channels\/[a-z0-9-]+\/stock\.json$/,
  // إعدادات الاستوديو العامة (الأسرار في .env لا هنا)
  /^config\.json$/,
  // D228: سجل اعتماد القوالب (حالة كل قالب: مقترح ← معتمد من المالك، ومن ومتى وأي نموذج)
  /^templates\/approvals\.json$/,
];

/** أسماء لا تُرفع أبدًا ولو طابقت نمطًا بخطأ مستقبلي (دفاع إضافي). */
const NEVER_RES = [
  /(^|\/)\.env($|\.)/,
  // حالة الاستوديو المحلية وسجل الأخطاء (.studio/errors.jsonl، D112)
  /(^|\/)\.studio\//,
  /scene-production\.v1\.json/, /scene-workflow\.v2\.json/, /script-approved\.v1\.json/, /script-approval\.local\.json/, /workflow-approvals\.json/,
  /voice-review\.json/, /(^|\/)storyboard\.json$/, /seam-checks\.local\.json/, /notes\/inbox\.json$/,
  /(^|\/)voice\//, /\.(mp3|mp4|wav|m4a|aac|mov|webm|png|jpe?g|pdf|zip|tar)$/i, /\.tmp$/, /\.lock(\/|$)/, /\.write\.lock$/,
];

/** هل المسار (نسبيًا لجذر المستودع، بشرطات /) محتوى مالك يُحفظ في main؟ */
export const isOwnerContentPath = (file) =>
  typeof file === "string" && !file.startsWith("/") && !file.includes("..") &&
  CONTENT_PATH_RES.some((re) => re.test(file)) && !NEVER_RES.some((re) => re.test(file));

/** حد حجم ملف المحتوى الواحد في الحفظ الآلي (ملفات نصية؛ ما فوقه يُترك ويُذكر للمالك). */
export const CONTENT_MAX_BYTES = 4 * 1024 * 1024;

/**
 * هل الدفع from..to محتوى مالك فقط؟ يعيد قائمة الملفات، أو null (⇒ البوابة الكاملة). يفحص كل commit في المدى
 * (لا الفرق النهائي وحده: كود أُضيف ثم أُزيل في المدى نفسه يُعيده إلى البوابة الكاملة)، ويشترط أن from سلف لـ to.
 */
export const contentOnlyFiles = (root, from, to, env = process.env) => {
  if (!from || !to) return null;
  const git = (args) => spawnSync("git", args, { cwd: root, encoding: "utf8", env, maxBuffer: 64 * 1024 * 1024 });
  if (git(["merge-base", "--is-ancestor", from, to]).status !== 0) return null;
  const log = git(["log", "--format=", "--name-only", "--no-renames", "-m", `${from}..${to}`]);
  const diff = git(["diff", "--name-only", "--no-renames", from, to]);
  if (log.status !== 0 || diff.status !== 0) return null;
  const files = [...new Set(`${log.stdout}\n${diff.stdout}`.split("\n").map((x) => x.trim()).filter(Boolean))];
  if (!files.length || !files.every(isOwnerContentPath)) return null;
  return files.sort();
};
