/**
 * ستوري بورد المختبرات (ملحق الأمر 015، استوديو «بالإسلام»): الجزء الخالص المشترك بين الخادم والواجهة
 * (بلا node:fs، فيُستورد في المتصفح). التخزين والكتابة في `labStoryboards.ts`.
 *
 * الصور غير الفيديو: الفيديو في `previews/` خانة واحدة تحل فيها النسخة الجديدة محل القديمة؛ أما صور
 * الستوري بورد ففي `storyboards/` وتبقى كل نسخها للمقارنة، ولكل نسخة رقمها وتاريخها وحالة مراجعتها.
 */

/** القنوات التي فُعّلت لها الميزة: «بالإسلام» وحدها (معزولة عن مختبرات القنوات الأخرى) */
export const LAB_STORYBOARD_CHANNELS: readonly string[] = ["balislam"];
export const labStoryboardsEnabled = (channel: string) => LAB_STORYBOARD_CHANNELS.includes(channel);

/** حالة مراجعة النسخة. الرفع دائمًا «جاهز للمراجعة»؛ «معتمد فنيًا» و«يحتاج تعديلًا» قرار صاحب القناة الصريح وحده */
export type StoryboardStatus = "review" | "approved" | "changes";
export const STORYBOARD_STATUSES: readonly StoryboardStatus[] = ["review", "approved", "changes"];
export const STORYBOARD_STATUS_AR: Record<StoryboardStatus, string> = { review: "جاهز للمراجعة", approved: "معتمد فنيًا", changes: "يحتاج تعديلًا" };

/** قرار صاحب القناة على نسخة: من، ومتى، ونصه */
export type StoryboardDecision = { at: string; by: string; note: string };
export type StoryboardVersion = {
  /** رقم الإصدار داخل الخانة: 1، 2، … لا يُعاد استعماله */
  version: number;
  /** اسم الصورة في storyboards/ (‎<الخانة>-v<الرقم>.png‎) */
  file: string;
  title: string;
  note?: string;
  /** اسم الملف الأصلي الذي حُفظت منه النسخة (للربط بما أُرسل في المحادثة) */
  source?: string;
  uploadedAt: string;
  status: StoryboardStatus;
  decision?: StoryboardDecision;
};
/** خانة: موضوع واحد (مثل «مشهد الشاهدين») بكل نسخه */
export type StoryboardSlot = { title: string; order?: string; versions: StoryboardVersion[] };
export type StoryboardIndex = Record<string, StoryboardSlot>;

/** للعرض: النسخ من الأحدث إلى الأقدم، والأحدث أولًا */
export type StoryboardEntry = { slot: string; title: string; order?: string; latest: StoryboardVersion; versions: StoryboardVersion[]; problems: string[] };

export const IMAGE_EXT = /\.(png|jpe?g|webp)$/i;
export const slotName = (slot: string) => slot.trim().replace(/[^\w-]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase();

/** ما يخالف قاعدة الاعتماد في خانة: «معتمد» أو «يحتاج تعديلًا» بلا قرار مسجل، أو حالة غير معروفة */
export const storyboardProblems = (slot: string, s: StoryboardSlot): string[] => {
  const p: string[] = [];
  if (!s.versions?.length) p.push(`${slot}: لا نسخ`);
  const seen = new Set<number>();
  for (const v of s.versions ?? []) {
    if (!STORYBOARD_STATUSES.includes(v.status)) p.push(`${slot} v${v.version}: حالة غير معروفة ${v.status}`);
    if (v.status !== "review" && !(v.decision?.by?.trim() && v.decision?.note?.trim() && v.decision?.at)) p.push(`${slot} v${v.version}: «${STORYBOARD_STATUS_AR[v.status] ?? v.status}» بلا قرار مسجل`);
    if (seen.has(v.version)) p.push(`${slot}: رقم نسخة مكرر ${v.version}`);
    seen.add(v.version);
    if (!IMAGE_EXT.test(v.file)) p.push(`${slot} v${v.version}: ليست صورة ${v.file}`);
  }
  return p;
};

/** الحالة المعروضة: ما خالف القاعدة يُعرض «جاهز للمراجعة» لا «معتمد»، فلا يظهر اعتماد بلا قرار */
export const shownStatus = (v: StoryboardVersion): StoryboardStatus =>
  v.status !== "review" && !(v.decision?.by?.trim() && v.decision?.note?.trim() && v.decision?.at) ? "review" : v.status;

export const toEntries = (index: StoryboardIndex): StoryboardEntry[] =>
  Object.entries(index)
    .filter(([, s]) => s.versions?.length)
    .map(([slot, s]) => {
      const versions = [...s.versions].sort((a, b) => b.version - a.version);
      return { slot, title: s.title, ...(s.order ? { order: s.order } : {}), latest: versions[0]!, versions, problems: storyboardProblems(slot, s) };
    })
    .sort((a, b) => (b.order ?? "").localeCompare(a.order ?? "") || b.latest.uploadedAt.localeCompare(a.latest.uploadedAt));
