import React from "react";
import { useVideoConfig } from "remotion";
import { useTheme } from "../../../brand/identity/index";
import { fontFamilies } from "../../../brand/fonts";
import { templateById } from "../../plan/templates";
import { SceneShell } from "./SceneShell";
import { T } from "../../i18n/context";
import { enter, useSceneFrame } from "./motion";
import type { SceneBase } from "./types";

/** مكان مؤقت لقالب لم يُبنَ بعد: يظهر اسم القالب ونص المشهد حتى تكتمل الحلقة للمعاينة. */
export const Placeholder: React.FC<SceneBase & { template: string; text?: string }> = (props) => {
  const { themeId, orientation, template, text, narration } = props;
  const frame = useSceneFrame();
  const { durationInFrames } = useVideoConfig();
  const t = useTheme(themeId);
  const a = enter(frame, 0);
  const def = templateById(template);
  const portrait = orientation === "portrait";
  return (
    <SceneShell {...props} durationInFrames={durationInFrames}>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 28, padding: portrait ? "0 80px 360px" : "0 200px 80px", opacity: a }}>
        <div style={{ border: `3px dashed ${t.colors.primary}`, borderRadius: 999, padding: "8px 28px", fontSize: portrait ? 34 : 30, fontWeight: 600, color: t.colors.primary }}>
          «{def?.nameAr ?? template}» <T k="templateWip" />
        </div>
        <div style={{ fontFamily: fontFamilies.heading, fontWeight: 700, fontSize: portrait ? 64 : 60, lineHeight: 1.5, textAlign: "center", color: t.colors.ink, maxWidth: portrait ? 920 : 1400 }}>
          {text || narration || "…"}
        </div>
      </div>
    </SceneShell>
  );
};
