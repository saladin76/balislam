import React, { useEffect, useState } from "react";
import { api, type SceneProductionRead } from "../api";
import type { WorkspaceStage } from "./EpisodeWorkspaceBar";
import "./scene-production.css";

type Props = {
  episodeId: string; channelId: string; title: string;
  stage: WorkspaceStage; onStage: (stage: WorkspaceStage) => void;
  unsaved: boolean;
  refreshKey?: number;
  saveState: "saved" | "dirty" | "saving" | "error";
};

const STEPS: { title: string; tab: WorkspaceStage }[] = [
  { title: "إعداد الحلقة", tab: "script" },
  { title: "Storyboard", tab: "storyboard" },
  { title: "إنتاج المشاهد", tab: "episode" },
  { title: "مراجعة الحلقة", tab: "review" },
  { title: "Master والنشر", tab: "publish" },
];

/** A simple user journey; real approval values always come from the server. */
export const EpisodeJourneyBar: React.FC<Props> = ({
  episodeId, channelId, title, stage, onStage, unsaved, saveState, refreshKey,
}) => {
  const [workflow, setWorkflow] = useState<SceneProductionRead | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let active = true;
    setWorkflow(null);
    setUnavailable(false);
    void api.sceneProduction(episodeId, channelId).then(
      data => { if (active) setWorkflow(data); },
      () => { if (active) setUnavailable(true); },
    );
    return () => { active = false; };
  }, [episodeId, channelId, stage, refreshKey]);

  const done = [
    Boolean(workflow?.script.approved),
    Boolean(workflow?.storyboard.approved),
    Boolean(workflow?.progress.canAssemble),
    Boolean(workflow?.assembly),
    Boolean(workflow?.master?.approved),
  ];

  return (
    <section className="scene-journey" aria-label="رحلة إنتاج الحلقة في خمس خطوات">
      <header className="scene-journey-title">
        <div>
          <small>الحلقة <span dir="ltr">{episodeId}</span></small>
          <h1>{title}</h1>
        </div>
        <span role="status" className={saveState === "error" ? "scene-first-error" : ""}>
          {saveState === "error" ? "تعذّر حفظ التعديلات" :
            saveState === "saving" ? "جارٍ الحفظ…" :
            unsaved || saveState === "dirty" ? "تعديلات غير محفوظة" :
            "محفوظ"}
        </span>
      </header>
      <nav className="scene-journey-steps" aria-label="خطوات الحلقة">
        {STEPS.map((item, i) => {
          const selected = stage === item.tab ||
            (stage === "research" && item.tab === "script") ||
            (stage === "voice" && item.tab === "episode");
          return <button key={item.tab} className={selected ? "is-active" : ""}
            type="button" aria-current={selected ? "step" : undefined}
            onClick={() => onStage(item.tab)}>
            <span>{done[i] ? "✓" : i + 1}</span>
            <strong>{item.title}</strong>
          </button>;
        })}
      </nav>
      {unavailable ? (
        <p className="scene-journey-warning" role="status">
          حالة الاعتمادات غير متاحة حاليًا؛ لا يمكن تأكيد اكتمال أي مرحلة.
        </p>
      ) : null}
      <button type="button" className="scene-journey-research" onClick={() => onStage("research")}>
        البحث والمصادر
      </button>
    </section>
  );
};
