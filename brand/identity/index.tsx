import React, { createContext, useContext, useMemo } from "react";
import identityJson from "../../channels/balislam/identity.json";
import { buildThemes, themeIds, type Theme, type ThemeId } from "../themes";
import { buildPalette, type StoredPalette } from "../elements/palette";
import type { ElementPalette } from "../elements/types";

export type Orientation = "landscape" | "portrait";

/**
 * عناصر الشاشة التي يمكن إظهارها أو إخفاؤها.
 * تُحدَّد للقناة كلها (الهوية)، ثم تُعدَّل للحلقة، ثم للمشهد؛ الأخص يغلب.
 */
export type Overlays = {
  /** الترجمة السفلية للتعليق الصوتي */
  captions: boolean;
  /** عنوان الفصل أعلى المشهد */
  chapterLabel: boolean;
  /** زخرفة الخلفية (الخطوط، الدوائر، النجوم، الأقواس) */
  motif: boolean;
  /** شعار القناة صغيرًا في زاوية الشاشة */
  watermark: boolean;
};
export type OverlayKey = keyof Overlays;
export const overlayKeys: OverlayKey[] = ["captions", "chapterLabel", "motif", "watermark"];
export const overlayNamesAr: Record<OverlayKey, string> = {
  captions: "الترجمة السفلية",
  chapterLabel: "عنوان الفصل في الأعلى",
  motif: "زخرفة الخلفية",
  watermark: "شعار القناة في الزاوية",
};
export const defaultOverlays: Overlays = { captions: true, chapterLabel: true, motif: true, watermark: false };

/** القيمة النهائية: افتراضي ← القناة ← الحلقة ← المشهد (أي طبقة تكتب true/false تغلب ما قبلها). */
export const resolveOverlays = (...layers: (Partial<Overlays> | undefined | null)[]): Overlays => {
  const out = { ...defaultOverlays };
  for (const layer of layers) {
    if (!layer) continue;
    for (const k of overlayKeys) if (typeof layer[k] === "boolean") out[k] = layer[k]!;
  }
  return out;
};
export type SizePair = { landscape: number; portrait: number };

/** كل ما يمكن تعديله في الهوية من الاستوديو. يُحفظ في channels/<القناة>/identity.json. */
export type Identity = {
  version: number;
  themes: Record<ThemeId, Omit<Theme, "id">>;
  palettes: Record<ThemeId, StoredPalette>;
  typography: {
    question: SizePair;
    bubble: SizePair;
    verse: SizePair;
    reference: SizePair;
    caption: SizePair;
    eyebrow: SizePair;
  };
  motion: {
    /** مضاعف سرعة كل الحركات (1 = الطبيعي) */
    speed: number;
    /** إطارات بين ظهور كلمة والتي بعدها */
    wordInterval: number;
    /** عدد كلمات سطر الترجمة */
    captionWords: number;
    /** اهتزاز الحبر في الثيم الخطي */
    boil: boolean;
    boilAmount: number;
    /** مضاعف طفو العناصر */
    float: number;
  };
  /** عناصر الشاشة الافتراضية للقناة (يمكن تغييرها لكل حلقة ولكل مشهد) */
  overlays?: Partial<Overlays>;
  /** خطوط هوية القناة: العناوين والنصوص والشعار (أسماء عائلات محمّلة في brand/fonts.ts) */
  fonts?: { heading?: string; body?: string; wordmark?: string };
};

export const defaultIdentity = identityJson as unknown as Identity;

type Resolved = {
  identity: Identity;
  themes: Record<ThemeId, Theme>;
  palettes: Record<ThemeId, ElementPalette>;
};

const resolve = (identity: Identity): Resolved => {
  const themes = buildThemes(identity.themes);
  const palettes = Object.fromEntries(themeIds.map((id) => [id, buildPalette(id, identity.palettes[id], themes[id].colors)])) as Record<ThemeId, ElementPalette>;
  return { identity, themes, palettes };
};

const defaultResolved = resolve(defaultIdentity);
const Ctx = createContext<Resolved>(defaultResolved);

/** يلفّ المعاينة بهوية معدّلة (من الاستوديو) قبل حفظها. بدونه تُستخدم الهوية المحفوظة. */
export const IdentityProvider: React.FC<{ identity: Identity; children: React.ReactNode }> = ({ identity, children }) => {
  const value = useMemo(() => resolve(identity), [identity]);
  // خطوط القناة تمر كمتغيرات CSS، فتأخذها كل القوالب عبر fontFamilies بلا تعديل فيها
  const f = identity.fonts ?? {};
  const vars = { display: "contents", ...(f.heading ? { "--bal-heading": `'${f.heading}'` } : {}), ...(f.body ? { "--bal-body": `'${f.body}'` } : {}), ...(f.wordmark ? { "--bal-wordmark": `'${f.wordmark}'` } : {}) } as React.CSSProperties;
  return (
    <Ctx.Provider value={value}>
      <div style={vars}>{children}</div>
    </Ctx.Provider>
  );
};

export const useTheme = (id: ThemeId): Theme => useContext(Ctx).themes[id];
export const usePalette = (id: ThemeId): ElementPalette => useContext(Ctx).palettes[id];
export const useSize = (key: keyof Identity["typography"], orientation: Orientation) => useContext(Ctx).identity.typography[key][orientation];
export const useMotionSettings = () => useContext(Ctx).identity.motion;
/** عناصر الشاشة على مستوى القناة. */
export const useChannelOverlays = () => useContext(Ctx).identity.overlays;
