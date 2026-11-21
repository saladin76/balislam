/**
 * «فصول يوتيوب» في «٤ النشر ← حزمة الانتشار» (المرحلة ٢ البند ٢): المالك يختار المشهد الذي يبدأ عنده كل فصل ويكتب
 * عنوانه، والوقت يُحسب من حدود المشاهد الحقيقية في الملف المجمَّع (`sceneStarts` من الخادم) ولا يُكتب يدويًا.
 * يصلح للنص المتصل أيضًا («دفاتر الزمن 001»)، وقواعد يوتيوب تظهر تحته (٠:٠٠، ثلاثة فصول، ١٠ ثوانٍ لكل فصل).
 */
import React, { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { arDigits } from "../ui/format";
import { resolveChapters, type ChapterMark, type SceneStarts } from "../../../src/package/chapters";

type SceneOpt = { id: string; narration: string };

export const ChapterMarks: React.FC<{
  episodeId: string;
  value: ChapterMark[] | undefined;
  starts: SceneStarts | undefined;
  onChange: (next: ChapterMark[] | undefined) => void;
}> = ({ episodeId, value, starts, onChange }) => {
  const [scenes, setScenes] = useState<SceneOpt[]>([]);
  useEffect(() => {
    let live = true;
    api.episode(episodeId).then((d) => live && setScenes(d.plan.chapters.flatMap((c) => c.scenes).map((s) => ({ id: s.id, narration: s.narration }))))
      .catch(() => undefined);
    return () => { live = false; };
  }, [episodeId]);
  const marks = value ?? [];
  const r = useMemo(() => (starts && marks.length ? resolveChapters(marks, starts) : null), [marks, starts]);
  const timeOf = (id: string) => {
    const t = starts?.starts[id];
    return t === undefined ? "—" : `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
  };
  const set = (i: number, patch: Partial<ChapterMark>) => onChange(marks.map((m, k) => (k === i ? { ...m, ...patch } : m)));
  const label = (s: SceneOpt) => `${s.id} (${timeOf(s.id)}) — ${s.narration.length > 40 ? `${s.narration.slice(0, 40)}…` : s.narration}`;

  return (
    <div className="kit-field" data-testid="chapter-marks">
      <div className="kit-field-head">
        <b>فصول يوتيوب</b>
        <span className="help">اختر المشهد الذي يبدأ عنده كل فصل؛ الوقت من حدود المشاهد الحقيقية{starts?.estimated ? " (تقديري الآن حتى تُجمَّع المشاهد)" : ""}</span>
      </div>
      {marks.map((m, i) => (
        <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <b style={{ minWidth: 48, direction: "ltr" }}>{timeOf(m.sceneId)}</b>
          <select aria-label={`مشهد بداية الفصل ${arDigits(i + 1)}`} value={m.sceneId} onChange={(e) => set(i, { sceneId: e.target.value })}>
            {scenes.map((s) => <option key={s.id} value={s.id}>{label(s)}</option>)}
          </select>
          <input type="text" aria-label={`عنوان الفصل ${arDigits(i + 1)}`} placeholder="عنوان الفصل" value={m.title} onChange={(e) => set(i, { title: e.target.value })} style={{ flex: 1, minWidth: 160 }} />
          <button type="button" className="btn ghost small" onClick={() => onChange(marks.length > 1 ? marks.filter((_, k) => k !== i) : undefined)}>حذف</button>
        </div>
      ))}
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" className="btn small" disabled={!scenes.length} onClick={() => {
          const used = new Set(marks.map((m) => m.sceneId));
          const next = scenes.find((s, k) => !used.has(s.id) && (marks.length === 0 ? k === 0 : k > scenes.findIndex((x) => x.id === marks.at(-1)!.sceneId)));
          onChange([...marks, { sceneId: next?.id ?? scenes[0]!.id, title: "" }]);
        }}>{marks.length ? "أضف فصلًا" : "أضف الفصل الأول (0:00)"}</button>
      </div>
      {r?.issues.map((x, k) => (
        <span key={k} className="help" style={{ color: x.level === "error" ? "var(--err)" : undefined }}>{x.level === "error" ? "✗" : "!"} {x.message}</span>
      ))}
      {r && !r.issues.some((x) => x.level === "error") ? <span className="help" style={{ color: "var(--ok)" }}>✓ تظهر في يوتيوب: {arDigits(r.lines.length)} فصول</span> : null}
    </div>
  );
};
