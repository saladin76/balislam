/**
 * «الأغلفة الثلاثة» في «٤ النشر» (قرار المالك ٢١ نوفمبر ٢٠٢٦): عنوان، مشهد، سؤال — ثلاث صور مختلفة الفكرة لـ«Test & Compare».
 * لكل غلاف كلماته (≤ ٣، عدّاد ظاهر)، ولغلاف المشهد اختيار المشهد ولحظة اللقطة. الفحص نفسه الذي يمنع الحزمة
 * (`thumbnailIssues`) يظهر تحت كل غلاف. يُحفظ في publish.json مع «حزمة الانتشار» (`long.thumbnails`)؛ الرسم
 * بضغطة «اصنع الأغلفة» وحدها (صور ثابتة، بلا صوت ولا فيديو).
 */
import React, { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { arDigits } from "../ui/format";
import {
  THUMB_KIND_LABEL, THUMB_KINDS, THUMB_MAX_WORDS, conceptOrder, thumbHoldFor, isSacredScene, suggestThumbnails, thumbnailIssues, thumbnailWords,
  type ThumbKind, type ThumbnailConcept,
} from "../../../src/package/thumbnails";

type SceneOpt = { id: string; narration: string; sacred: boolean };

const HINT: Record<ThumbKind, string> = {
  title: "كلمة الغلاف بخط القناة وعنصرها: فكرة لا يقولها العنوان",
  scene: "لقطة حقيقية من مشهد معتمد؛ الكلمات اختيارية",
  question: "سؤال الحلقة بلا إجابة، ينتهي بـ«؟»",
};

export const ThumbnailConcepts: React.FC<{
  episodeId: string;
  value: ThumbnailConcept[] | undefined;
  titles: string[];
  onChange: (next: ThumbnailConcept[]) => void;
}> = ({ episodeId, value, titles, onChange }) => {
  const [scenes, setScenes] = useState<SceneOpt[] | null>(null);
  const [title, setTitle] = useState("");
  // D196: أسلوب مصغّرة القناة المعتمد اتجاهه («دفتر الأفق») لا إيقاف لغلافيه
  const [thumbStyle, setThumbStyle] = useState<string | undefined>(undefined);
  useEffect(() => {
    let live = true;
    api.episode(episodeId).then((d) => {
      if (!live) return;
      setTitle(d.plan.title);
      setThumbStyle(d.channel?.brand?.thumbnail);
      setScenes(d.plan.chapters.flatMap((c) => c.scenes).map((s) => ({ id: s.id, narration: s.narration, sacred: isSacredScene(s) })));
    }).catch(() => live && setScenes([]));
    return () => { live = false; };
  }, [episodeId]);

  const allTitles = useMemo(() => [title, ...titles].filter(Boolean), [title, titles]);
  const issues = useMemo(() => thumbnailIssues(value, { titles: allTitles, scenes: scenes ?? undefined }), [value, allTitles, scenes]);

  if (!value) {
    return (
      <div className="kit-field" data-testid="thumb-concepts">
        <div className="kit-field-head"><b>الأغلفة الثلاثة</b><span className="help">عنوان، مشهد، سؤال — ثلاث كلمات على الأكثر لكل صورة</span></div>
        <span className="help">الصور الحالية تكتب العنوان نفسه. اكتب ثلاثة أغلفة مختلفة الفكرة لاختبار «Test & Compare» في يوتيوب.</span>
        <button type="button" className="btn small" disabled={!scenes} onClick={() => onChange(suggestThumbnails({ titles: allTitles, scenes: scenes ?? [] }))}>
          اكتب الأغلفة الثلاثة
        </button>
      </div>
    );
  }

  const rows = conceptOrder(value);
  const set = (kind: ThumbKind, patch: Partial<ThumbnailConcept>) =>
    onChange(THUMB_KINDS.map((k) => {
      const c = rows.find((x) => x.kind === k) ?? { kind: k, text: "" };
      return k === kind ? { ...c, ...patch } : c;
    }));

  return (
    <div className="kit-field" data-testid="thumb-concepts">
      <div className="kit-field-head"><b>الأغلفة الثلاثة</b><span className="help">ترتيب الملفات ثابت: ١ عنوان، ٢ مشهد، ٣ سؤال</span></div>
      {rows.map((c, i) => {
        const n = thumbnailWords(c.text).length;
        const mine = issues.filter((x) => x.where.includes(`«${THUMB_KIND_LABEL[c.kind]}»`));
        return (
          <div key={c.kind} className="thumb-concept" style={{ display: "flex", flexDirection: "column", gap: 4, padding: "6px 0", borderTop: i ? "1px solid var(--line)" : undefined }}>
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <b>{arDigits(i + 1)}. {THUMB_KIND_LABEL[c.kind]}</b>
              <span className="help">{HINT[c.kind]}</span>
              <span className="spacer" />
              <span className="help" style={{ color: n > THUMB_MAX_WORDS ? "var(--err)" : undefined }}>{arDigits(n)}/{arDigits(THUMB_MAX_WORDS)} كلمات</span>
            </label>
            {thumbHoldFor(thumbStyle)[c.kind] ? <span className="help" data-testid={`thumb-hold-${c.kind}`}>⏸ {thumbHoldFor(thumbStyle)[c.kind]}: اكتب كلماته الآن، ويُرسم بعد اختيار الاتجاه.</span> : null}
            <input type="text" aria-label={`كلمات غلاف ${THUMB_KIND_LABEL[c.kind]}`} value={c.text} onChange={(e) => set(c.kind, { text: e.target.value })} />
            {c.kind === "scene" ? (
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <select aria-label="مشهد اللقطة" value={c.sceneId ?? ""} onChange={(e) => set("scene", { sceneId: e.target.value || undefined })}>
                  <option value="">اختر المشهد…</option>
                  {(scenes ?? []).filter((s) => !s.sacred).map((s) => (
                    <option key={s.id} value={s.id}>{s.id} — {s.narration.length > 44 ? `${s.narration.slice(0, 44)}…` : s.narration}</option>
                  ))}
                </select>
                <label className="help">
                  لحظة اللقطة (ث){" "}
                  <input type="number" min={0} step={0.1} style={{ width: 80 }} aria-label="لحظة اللقطة بالثواني" value={c.atSeconds ?? ""} placeholder="آليًا"
                    onChange={(e) => set("scene", { atSeconds: e.target.value === "" ? undefined : Number(e.target.value) })} />
                </label>
              </div>
            ) : null}
            {mine.map((x, k) => (
              <span key={k} className="help" style={{ color: x.level === "error" ? "var(--err)" : undefined }}>
                {x.level === "error" ? "✗" : "!"} {x.message}{x.suggestion ? <> — اقتراح: «{x.suggestion}»</> : null}
              </span>
            ))}
          </div>
        );
      })}
      {issues.filter((x) => x.where === "الأغلفة الثلاثة").map((x, k) => <span key={k} className="help" style={{ color: "var(--err)" }}>✗ {x.message}</span>)}
    </div>
  );
};
