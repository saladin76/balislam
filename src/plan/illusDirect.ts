import { sentenceGroups } from "./beats";
import { cuesFor, cuesToText, cueKindOf, isSacredSentence, type CueKind } from "./sceneCues";
import type { PlanChapter } from "./types";

/**
 * «الإخراج» الآلي لقوالب «بالإسلام» المصوَّرة (حكايات الحارة، الطريق، ظل ونور):
 * - المزاج يتبع قوس الحلقة: سؤال في الليل، وتأثر في الغروب، وثقل في الليل الأعمق، ثم فهم قبيل الفجر، وخلاصة في الفجر.
 *   آخر مشهد في كل فصل يتحول نحو مزاج الفصل التالي، فتنتقل الحلقة بلا قطع.
 * - المكان يتبدل بين الفصول ويختلف ترتيبه من حلقة لأخرى (المبدأ الثاني: التنوع).
 * - حركة البطل لكل جملة من معنى كلماتها المراجَعة (sceneCues)، وإلا بتناوب هادئ.
 * - الجملة التي فيها ذكر الله أو دعاء أو آية: البطل ساكن هادئ، بلا أحداث ولا رموز.
 * كل ما هنا اقتراح يظهر في ستوري بورد الحلقة، وتعديل صاحب القناة لأي مشهد يُحفظ.
 */
export const ILLUS_TEMPLATES = ["alley-tale", "road-journey", "light-stage"] as const;
export const isIllus = (t: string) => (ILLUS_TEMPLATES as readonly string[]).includes(t);

const ARC = ["night", "dusk", "deep", "predawn", "dusk", "dawn"] as const;
const PLACES = ["alley", "market", "home"] as const;
const BIOMES = ["city", "fields", "desert", "hill"] as const;
const CAMERAS = ["push", "track", "rise", "drift"] as const;

/** مزاج الفصل i من n: يُوزَّع القوس على عدد الفصول، والأخير فجر دائمًا */
export const chapterMood = (i: number, n: number) => (i >= n - 1 ? "dawn" : ARC[Math.min(ARC.length - 2, Math.floor((i / Math.max(1, n - 1)) * (ARC.length - 1)))]!);

const SIT = new Set(["sit", "sit-low", "head-down", "look-up"]);

/** حركة البطل لكل جملة في المشهد */
export const posesFor = (narration: string, sceneIndex: number): string => {
  const groups = sentenceGroups(narration, 3);
  const kinds: (CueKind | "sacred")[][] = groups.map((g) => (isSacredSentence(g) ? ["sacred"] : g.split(/\s+/).map(cueKindOf).filter((k): k is CueKind => k !== null)));
  const all = kinds.flat();
  if (all.includes("walk")) return groups.map((_, i) => (kinds[i]!.includes("walk") || i === 0 ? "walk" : "stand")).join(",");
  // الجلوس للثقل والتأمل فقط؛ ومن يكلّم غيره أو يعمل أو يتعالى يقف
  const standing = ["companion", "harsh", "proud", "apologize", "listen", "debate", "spread", "money", "evidence", "work", "success", "witnesses", "verify", "measure"] as const;
  const sit = !standing.some((k) => all.includes(k)) && (all.includes("pain") || sceneIndex % 4 === 1);
  const rest = sit ? ["sit", "sit-low", "sit"] : ["stand", "think", "nod"];
  return groups
    .map((_, i) => {
      const k = kinds[i]!;
      if (k.includes("sacred")) return sit ? "sit" : "stand";
      if (sit) {
        if (k.includes("pain") || k.includes("wrong")) return "head-down";
        if (k.includes("truth") || k.includes("heart")) return "look-up";
        return rest[i % rest.length]!;
      }
      if (k.includes("proud")) return "proud";
      if (k.includes("apologize")) return "apologize";
      if (k.includes("listen")) return "listen";
      if (k.includes("debate") || k.includes("harsh")) return "talk";
      if (k.includes("news") || k.includes("spread") || k.includes("money") || k.includes("evidence") || k.includes("verify")) return "hold";
      if (k.includes("think")) return "think";
      if (k.includes("decide") || k.includes("pain")) return "cross";
      if (k.includes("door")) return "turn-away";
      if (k.includes("truth") || k.includes("heart")) return "look-up";
      return rest[i % rest.length]!;
    })
    .map((p, i, a) => (i > 0 && p === a[i - 1] && SIT.has(p) === false && p !== "stand" ? "stand" : p))
    .join(",");
};

/** الحقول المستقلة عن موضع المشهد (من التعليق وحده) */
export const illusDefaults = (template: string, narration: string): Record<string, string> => {
  const cues = cuesToText(cuesFor(narration));
  switch (template) {
    case "alley-tale":
      return { place: "", mood: "", moodTo: "", camera: "", poses: "", look: "hero", cast: "", cues };
    case "road-journey":
      return { biome: "", mood: "", moodTo: "", poses: "", look: "hero", cues };
    case "light-stage":
      return { mood: "", poses: "", look: "hero", cues };
    default:
      return {};
  }
};

/** يملأ الحقول المتروكة فارغة بحسب موضع المشهد في الحلقة (المزاج والمكان والكاميرا وحركة البطل) */
export const directIllus = (chapters: PlanChapter[], episode: string) => {
  const n = chapters.length;
  const seed = parseInt(episode, 10) || 0;
  chapters.forEach((ch, ci) => {
    const mood = chapterMood(ci, n);
    const next = chapterMood(ci + 1, n);
    const illus = ch.scenes.filter((s) => isIllus(s.template));
    illus.forEach((s, si) => {
      const p = s.props;
      const last = si === illus.length - 1;
      if (!p.mood) p.mood = mood;
      if (p.moodTo === "" && last && next !== mood && ci < n - 1) p.moodTo = next;
      if (s.template === "alley-tale") {
        if (!p.place) p.place = PLACES[(ci + seed) % PLACES.length]!;
        if (!p.camera) p.camera = p.cameraMode === "directed" ? "still" : CAMERAS[(si + ci) % CAMERAS.length]!;
      }
      if (s.template === "road-journey" && !p.biome) p.biome = BIOMES[Math.min(BIOMES.length - 1, Math.floor((ci / Math.max(1, n - 1)) * (BIOMES.length - 1) + (ci === n - 1 ? 1 : 0)))]!;
      // «الأول يراه ظلمًا، والثاني عدلًا» بعد مشهد الشاهدين: يبقى الشاهدان في المشهد
      const prev = illus[si - 1];
      if (p.cast === "" && prev && /witnesses/.test(prev.props.cues ?? "") && /wrong/.test(p.cues ?? "") && /just/.test(p.cues ?? "")) p.cast = "witnesses";
      if (!p.poses) p.poses = s.template === "alley-tale" && p.cameraMode === "directed" ? "stand" : s.template === "road-journey" ? "walk" : posesFor(s.narration, si + ci);
      // مع الشاهدين أو شخص أمامه: البطل واقف
      if (p.cast && p.cast !== "solo" && /sit|head-down/.test(p.poses)) p.poses = p.poses.replace(/sit-low|head-down|sit/g, "stand");
    });
  });
};
