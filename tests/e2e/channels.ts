/**
 * The fixed test episode of each channel (tests/fixtures/e2e/<channel>/) and what its journey must show.
 * Channel rules differ (CLAUDE.md, docs/studio/channel-production-policies.md): «بالإسلام» has a verse whose
 * recitation the owner uploads (here a generated tone, NEVER a real recitation); «زبدة الكتب» has a verse as a
 * silent written citation (D68/D100: no recitation, no D35 wait); «دفاتر الزمن» has its own tone map per scene.
 */
export type ChannelCase = {
  channel: string;
  slug: string;
  title: string;
  domain: string;
  /** Narration scenes, in order (the plan adds the closing card c1-end). */
  scenes: string[];
  /** The verse scene, if any: a recitation uploaded by the owner, or a silent written citation. */
  verse?: { sceneId: string; key: string; mode: "recitation" | "citation" };
  /** The scene that gets «النبرة غير مناسبة» → a note → regenerate → approve. */
  toneScene: string;
  /** The scene whose text is edited after «اعتمد التجهيز» (D76): only it re-opens. */
  edit: { sceneId: string; from: string; to: string };
  /** The episode tone chosen in step ١ (none is a default: D104). */
  episodeTone: string;
};

export const CASES: Record<string, ChannelCase> = {
  balislam: {
    channel: "balislam", slug: "e2e-journey", title: "رحلة الاختبار: السعي", domain: "psychology",
    scenes: ["c1-s1", "c1-s2", "c1-s3"],
    verse: { sceneId: "c1-s2", key: "53:39", mode: "recitation" },
    toneScene: "c1-s1",
    edit: { sceneId: "c1-s3", from: "فَالسَّعْيُ الصَّادِقُ يَصْنَعُ الفَرْقَ مَعَ الأَيَّامِ.", to: "فَالسَّعْيُ الصَّادِقُ يَصْنَعُ الفَرْقَ الكَبِيرَ مَعَ الأَيَّامِ." },
    episodeTone: "calm",
  },
  "dafatir-alzaman": {
    channel: "dafatir-alzaman", slug: "e2e-journey", title: "رحلة الاختبار: سوق المدينة", domain: "world",
    scenes: ["c1-s1", "c1-s2", "c1-s3"],
    toneScene: "c1-s2",
    edit: { sceneId: "c1-s3", from: "وَبَقِيَتِ القَوَافِلُ تَمُرُّ بِهِ قُرُونًا.", to: "وَبَقِيَتِ القَوَافِلُ تَمُرُّ بِهِ قُرُونًا طَوِيلَةً." },
    episodeTone: "documentary",
  },
  "zubdat-alkutub": {
    channel: "zubdat-alkutub", slug: "e2e-journey", title: "رحلة الاختبار: فكرة الكتاب", domain: "self",
    scenes: ["c1-s1", "c1-s2", "c1-s3"],
    verse: { sceneId: "c1-s2", key: "94:5", mode: "citation" },
    toneScene: "c1-s1",
    edit: { sceneId: "c1-s3", from: "فَابْدَأْ بِعَادَةٍ وَاحِدَةٍ صَغِيرَةٍ هَذَا الأُسْبُوعَ.", to: "فَابْدَأْ بِعَادَةٍ وَاحِدَةٍ صَغِيرَةٍ جِدًّا هَذَا الأُسْبُوعَ." },
    episodeTone: "warm",
  },
};

/** BAL_E2E_CHANNELS=all | a,b,c (default: balislam). */
export const selectedChannels = (env = process.env): string[] => {
  const v = (env.BAL_E2E_CHANNELS ?? "").trim();
  if (!v) return ["balislam"];
  if (v === "all") return Object.keys(CASES);
  const list = v.split(",").map((x) => x.trim()).filter(Boolean);
  for (const c of list) if (!CASES[c]) throw new Error(`BAL_E2E_CHANNELS: unknown channel «${c}».`);
  return list;
};
