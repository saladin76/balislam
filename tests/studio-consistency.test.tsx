import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ELEMENTS, PLACES, TEMPLATES, countAr } from "../src/i18n/count";

// Owner review (Claude in Chrome, 18 Nov): one name per thing, one meaning per label, grammar that agrees.
const src = (f: string) => readFileSync(path.join(import.meta.dirname, "..", f), "utf8");

describe("counts agree with the number", () => {
  it("templates, places and elements of the channel library", () => {
    expect(countAr(8, TEMPLATES)).toBe("٨ قوالب");
    expect(countAr(45, ELEMENTS)).toBe("٤٥ عنصرًا");
    expect(countAr(0, PLACES, "بلا أماكن مرسومة")).toBe("بلا أماكن مرسومة");
    expect(src("app/src/tabs/ChannelIdentity.tsx")).not.toMatch(/<\/b> (?:قالبًا|مكانًا|عنصرًا)/);
  });
  it("the ops room says «٣ حلقات في الإنتاج», not «٣ حلقة»", () => {
    expect(src("app/src/tabs/OpsRoom.tsx")).toContain('all.length >= 3 && all.length <= 10 ? "حلقات" : "حلقة"} في الإنتاج');
  });
});

describe("labels that said the opposite", () => {
  it("the Quran rule never offers fetching (the rule under it says no fetching)", () => {
    const t = src("app/src/tabs/ChannelTab.tsx");
    expect(t).not.toContain("وجلب النصوص");
    expect(t).not.toContain("دون تغيير طريقة الإنتاج");
  });
  it("the player's mute button names its action, never «بلا صوت» beside a recording", () => {
    for (const f of ["app/src/ui/Preview.tsx", "app/src/workspace/FramePlayer.tsx"]) {
      expect(src(f)).toContain('{muted ? "شغّل الصوت" : "اكتم"}');
      expect(src(f)).not.toContain('"بلا صوت" : "الصوت"');
    }
  });
  it("step ٢ produces drafts; «التجهيز» is step ١ alone", () => {
    const t = src("app/src/workspace/PrepareAll.tsx");
    expect(t).toContain('"استأنف إنتاج المسودات"');
    expect(t).not.toContain("استأنف التجهيز");
  });
  it("«اعتمد المشهد» waits when the shown preview is older than the scene's newer take", () => {
    const t = src("app/src/workspace/sceneProduction/SceneDecisionActions.tsx");
    expect(t).toContain('const review = p.stage === "review" && !outdated;');
    expect(t).toContain("«أنتج هذا المشهد» أولًا، ثم اعتمده");
  });
});

describe("every length says what it measures", () => {
  it("the script's estimate is from words; «متتابعة» marks an estimate; home names plan or measured", () => {
    expect(src("app/src/tabs/ScriptTab.tsx")).toContain("(من عدد الكلمات)");
    expect(src("app/src/App.tsx")).toContain('l.source === "voice" ? "" : "≈ "');
    expect(src("app/src/tabs/HomeTab.tsx")).toContain('e.length.source === "voice" ? "مقيسة" : "مدة الخطة"');
  });
  it("clips are scenes with narration, and the rest are counted", () => {
    expect(src("app/src/workspace/VoiceWorkspaceTab.tsx")).toContain("مقطع لكل مشهد فيه كلام؛");
  });
});

describe("the developer's things out of the owner's way", () => {
  it("engineering pages fold under one group in the reference, in all three channels", () => {
    for (const ch of ["balislam", "dafatir-alzaman", "zubdat-alkutub"]) {
      const g = JSON.parse(src(`docs/${ch}/guide.json`)) as { entries: { file: string; audience?: string }[] };
      expect(g.entries.find((e) => e.file === "briefing.md")?.audience, ch).toBe("dev");
      expect(g.entries.find((e) => e.file === "studio-map.md")?.audience, ch).toBe("dev");
      expect(g.entries[0]?.audience, ch).toBeUndefined();
    }
    expect(src("app/src/tabs/GuideTab.tsx")).toContain("صفحات هندسية — للمطور وClaude");
  });
  it("the template's script tag is shown to the owner, the research reads formatted", () => {
    expect(src("app/src/tabs/LibraryGalleries.tsx")).not.toContain("تفاصيل للمطور");
    expect(src("app/src/tabs/ScriptTab.tsx")).toContain('aria-label="عرض ملف البحث"');
  });
});
