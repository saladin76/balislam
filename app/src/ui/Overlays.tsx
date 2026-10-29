import React from "react";
import { overlayKeys, overlayNamesAr, type OverlayKey, type Overlays } from "../../../brand/identity/index";

const help: Record<OverlayKey, string> = {
  captions: "سطر الكلام أسفل الشاشة أثناء التعليق الصوتي. ملف الترجمة (srt) ليوتيوب يُصنع دائمًا.",
  chapterLabel: "الشارة الصغيرة أعلى المشهد: «الفصل ٢ · …».",
  motif: "الخطوط أو الدوائر أو النجوم أو الأقواس الخفيفة خلف المحتوى.",
  watermark: "رمز القناة صغيرًا في الزاوية المقابلة لعنوان الفصل (لا يظهر في شاشة النهاية).",
};

/**
 * إظهار/إخفاء عناصر الشاشة بثلاث حالات: «تلقائي» يتبع المستوى الأعلى، أو «إظهار»، أو «إخفاء».
 * inherited: القيمة التي ستُستخدم لو بقي «تلقائي».
 */
export const OverlayToggles: React.FC<{
  value?: Partial<Overlays>;
  inherited: Overlays;
  inheritLabel: string;
  onChange: (v: Partial<Overlays> | undefined) => void;
  idPrefix: string;
  compact?: boolean;
}> = ({ value, inherited, inheritLabel, onChange, idPrefix, compact }) => {
  const set = (k: OverlayKey, v: boolean | undefined) => {
    const next = { ...(value ?? {}) };
    if (v === undefined) delete next[k];
    else next[k] = v;
    onChange(Object.keys(next).length ? next : undefined);
  };
  return (
    <div className="overlay-list">
      {overlayKeys.map((k) => {
        const cur = value?.[k];
        const effective = cur ?? inherited[k];
        return (
          <div key={k} className="overlay-row">
            <div className="overlay-name">
              <span className={`dot ${effective ? "on" : ""}`} aria-hidden />
              <b>{overlayNamesAr[k]}</b>
              {!compact ? <span className="help">{help[k]}</span> : null}
            </div>
            <div className="seg" role="group" aria-label={overlayNamesAr[k]} id={`${idPrefix}-${k}`}>
              <button aria-pressed={cur === undefined} onClick={() => set(k, undefined)} title={`يتبع ${inheritLabel}`}>
                {inheritLabel}: {inherited[k] ? "ظاهر" : "مخفي"}
              </button>
              <button aria-pressed={cur === true} onClick={() => set(k, true)}>إظهار</button>
              <button aria-pressed={cur === false} onClick={() => set(k, false)}>إخفاء</button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

/** نسخة القناة: مفتاح تشغيل بسيط لكل عنصر (لا يوجد مستوى أعلى). */
export const OverlaySwitches: React.FC<{ value: Overlays; onChange: (v: Overlays) => void }> = ({ value, onChange }) => (
  <div className="overlay-list">
    {overlayKeys.map((k) => (
      <label key={k} className="check overlay-row">
        <input type="checkbox" id={`ov-${k}`} checked={value[k]} onChange={(e) => onChange({ ...value, [k]: e.target.checked })} />
        <span>
          <b>{overlayNamesAr[k]}</b> <span className="help">{help[k]}</span>
        </span>
      </label>
    ))}
  </div>
);
