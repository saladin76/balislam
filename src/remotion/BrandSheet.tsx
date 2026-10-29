import React from "react";
import { AbsoluteFill } from "remotion";
import { themes, type ThemeId } from "../../brand/themes";
import { fontFamilies } from "../../brand/fonts";
import { LogoLockup } from "../../brand/logo/Logo";
import { Character, characterNamesAr, characterVariants, type CharacterPose } from "../../characters/Character";
import { useBrandFonts } from "./useBrandFonts";

export type BrandSheetProps = {
  themeId: ThemeId;
  orientation: "landscape" | "portrait";
};

/**
 * لوحة هوية لكل ثيم: الشعار، الألوان، الخطوط، الشخصيات، وشريط الترجمة.
 * تُرندر كصورة ثابتة للتحقق من مطابقة الكود للوحة الهوية (معيار قبول المرحلة 1).
 */
export const BrandSheet: React.FC<BrandSheetProps> = ({ themeId, orientation }) => {
  useBrandFonts();
  const t = themes[themeId];
  const portrait = orientation === "portrait";
  const swatches: [string, string][] = [
    ["الخلفية", t.colors.bg],
    ["البطاقات", t.colors.surface],
    ["النص", t.colors.ink],
    ["الأساسي", t.colors.primary],
    ["الثانوي", t.colors.secondary],
    ["التمييز", t.colors.highlight],
  ];
  const poses: CharacterPose[] = ["stand", "point", "think", "stand", "stand"];

  return (
    <AbsoluteFill
      style={{
        backgroundColor: t.colors.bg,
        color: t.colors.ink,
        direction: "rtl",
        fontFamily: fontFamilies.body,
        padding: portrait ? 72 : 56,
        display: "flex",
        flexDirection: "column",
        gap: portrait ? 56 : 24,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <LogoLockup theme={t} height={portrait ? 96 : 84} />
        <div
          style={{
            border: `2px solid ${t.colors.primary}`,
            borderRadius: 999,
            padding: "10px 26px",
            fontSize: portrait ? 30 : 26,
            fontWeight: 600,
          }}
        >
          {t.nameAr} · {t.domainAr}
        </div>
      </div>

      <div style={{ fontFamily: fontFamilies.heading, fontWeight: 700, fontSize: portrait ? 84 : 68, lineHeight: 1.2 }}>
        لماذا نؤجّل ما نعرف أنه مهم؟
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 18 }}>
        {swatches.map(([name, hex]) => (
          <div key={name} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: portrait ? 132 : 110,
                height: portrait ? 84 : 70,
                borderRadius: 14,
                backgroundColor: hex,
                border: `2px solid ${t.colors.inkSoft}33`,
              }}
            />
            <div style={{ fontSize: 20, fontWeight: 600 }}>{name}</div>
            <div style={{ fontSize: 18, color: t.colors.inkSoft, direction: "ltr" }}>{hex}</div>
          </div>
        ))}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: portrait ? "center" : "flex-end",
          justifyContent: "space-around",
          flexWrap: portrait ? "wrap" : "nowrap",
          rowGap: 24,
          flexGrow: 1,
        }}
      >
        {characterVariants.map((v, i) => (
          <div key={v} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
            <Character theme={t} variant={v} pose={poses[i] ?? "stand"} height={portrait ? 380 : 250} />
            <div style={{ fontSize: 22, fontWeight: 600 }}>{characterNamesAr[v]}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: portrait ? "column" : "row", alignItems: "center", justifyContent: "center", gap: 18 }}>
        <div
          style={{
            backgroundColor: t.colors.surface,
            border: `2px solid ${t.colors.primary}`,
            borderRadius: 18,
            padding: "14px 28px",
            fontFamily: fontFamilies.scripture,
            fontSize: portrait ? 40 : 30,
          }}
        >
          نموذج خط البطاقات الشرعية: Amiri
        </div>
        <div
          style={{
            backgroundColor: t.colors.captionBg,
            color: t.colors.captionInk,
            borderRadius: 14,
            padding: "12px 30px",
            fontSize: portrait ? 38 : 30,
            fontWeight: 600,
          }}
        >
          أحيانًا التأجيل{" "}
          <span style={{ backgroundColor: t.colors.highlight, color: t.colors.onHighlight, borderRadius: 8, padding: "0 10px" }}>
            هروبٌ
          </span>{" "}
          من شعور
        </div>
      </div>
    </AbsoluteFill>
  );
};
