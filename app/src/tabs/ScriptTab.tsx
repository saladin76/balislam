import React, { useEffect, useImperativeHandle, useRef, useState, forwardRef } from "react";
import { api, type CheckResult } from "../api";
import config from "../../../config.json";

export type ScriptTabHandle = { goToLine: (line: number) => void };

const fmt = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, "0")}`;

/** محرر السكريبت مع فحص مباشر أثناء الكتابة. الحفظ يحدّث المشاهد تلقائيًا مع إبقاء تعديلاتك. */
export const ScriptTab = forwardRef<ScriptTabHandle, {
  text: string;
  savedText: string;
  check: CheckResult;
  onChange: (text: string) => void;
  onSave: () => Promise<void>;
}>(({ text, savedText, check: initialCheck, onChange, onSave }, ref) => {
  const area = useRef<HTMLTextAreaElement>(null);
  const [check, setCheck] = useState<CheckResult>(initialCheck);
  const [saving, setSaving] = useState(false);
  const dirty = text !== savedText;

  const goToLine = (line: number) => {
    const el = area.current;
    if (!el) return;
    const lines = el.value.split("\n");
    const start = lines.slice(0, Math.max(0, line - 1)).reduce((n, l) => n + l.length + 1, 0);
    const end = start + (lines[line - 1]?.length ?? 0);
    el.focus();
    el.setSelectionRange(start, end);
    const lh = parseFloat(getComputedStyle(el).lineHeight) || 32;
    el.scrollTop = Math.max(0, (line - 4) * lh);
  };
  useImperativeHandle(ref, () => ({ goToLine }));

  useEffect(() => setCheck(initialCheck), [initialCheck]);
  useEffect(() => {
    const t = setTimeout(() => api.check(text).then(setCheck).catch(() => {}), 500);
    return () => clearTimeout(t);
  }, [text]);

  const save = async () => {
    setSaving(true);
    try {
      await onSave();
    } finally {
      setSaving(false);
    }
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (dirty) void save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const errors = check.issues.filter((i) => i.level === "error").length;
  const warnings = check.issues.length - errors;
  const { min, max } = config.episode.chapterSeconds;

  return (
    <div className="work script-grid">
      <div className="editor">
        <div className="toolbar">
          <b style={{ fontFamily: "var(--f-head)", fontSize: 18 }}>السكريبت</b>
          <span className="help">العلامات: [مشهد: …] [آية: النجم 39] [حديث: …] [صوت: page-turn] · bridge: …</span>
          <span className="spacer" />
          <span className="status"><i className={`dot ${dirty ? "dirty" : ""}`} />{dirty ? "تعديلات غير محفوظة" : "محفوظ"}</span>
          <button className="btn primary" disabled={!dirty || saving} onClick={save}>{saving ? "جارٍ الحفظ…" : "حفظ (Ctrl+S)"}</button>
        </div>
        <textarea id="script-editor" ref={area} value={text} onChange={(e) => onChange(e.target.value)} spellCheck={false} dir="rtl" />
      </div>
      <div className="col side">
        <div className="col-head"><h2>الفحص</h2><span className="spacer" /><span className="help">يتحدث أثناء الكتابة</span></div>
        <div className={`verdict ${check.ok ? "ok" : "bad"}`}>
          {check.ok ? `صالح للمرحلة التالية${warnings ? ` · ${warnings} تنبيه` : ""}` : `غير صالح: ${errors} خطأ${warnings ? ` و${warnings} تنبيه` : ""}`}
        </div>
        <table className="stats">
          <thead><tr><th>الفصل</th><th>الكلمات</th><th>المدة التقديرية</th></tr></thead>
          <tbody>
            {check.stats.chapters.map((c) => (
              <tr key={c.number}>
                <td>{c.number}</td>
                <td>{c.words}</td>
                <td className={c.seconds < min || c.seconds > max ? "bad" : ""}>{fmt(c.seconds)}</td>
              </tr>
            ))}
            <tr><th>الإجمالي</th><th>{check.stats.totalWords}</th><th>{fmt(check.stats.totalSeconds)}</th></tr>
          </tbody>
        </table>
        <div className="issues">
          {check.issues.length === 0 ? <p className="help">لا ملاحظات.</p> : null}
          {[...check.issues].sort((a, b) => (a.level === b.level ? 0 : a.level === "error" ? -1 : 1)).map((i, k) => (
            <button key={k} className={`issue ${i.level}`} onClick={() => i.line && goToLine(i.line)}>
              <span className="lv">{i.level === "error" ? "خطأ" : "تنبيه"}</span>
              <span>{i.message}</span>
              {i.line ? <span className="ln">سطر {i.line}</span> : null}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
});
