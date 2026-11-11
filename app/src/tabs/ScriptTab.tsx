import React, { useEffect, useImperativeHandle, useRef, useState, forwardRef } from "react";
import { api, type CheckResult } from "../api";
import config from "../../../config.json";
import { ReviewPanel } from "./ReviewPanel";
import { Hint, More } from "../shell/Screen";
import "../shell/screens-s12.css";

export type ScriptTabHandle = { goToLine: (line: number) => void; hasUnsavedResearch: () => boolean };

const fmt = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, "0")}`;
const ar = (n: number) => n.toLocaleString("ar-EG");
const fmtAr = (sec: number) => `${ar(Math.floor(sec / 60))}:${ar(Math.round(sec % 60)).padStart(2, "٠")}`;

/** محرر السكريبت مع فحص مباشر أثناء الكتابة. الحفظ يحدّث المشاهد تلقائيًا مع إبقاء تعديلاتك. */
export const ScriptTab = forwardRef<ScriptTabHandle, {
  episodeId: string;
  initialDoc?: "script" | "research";
  workspaceMode?: boolean;
  onOpenScriptLine?: (line: number) => void;
  onResearchDirtyChange?: (dirty: boolean) => void;
  text: string;
  savedText: string;
  check: CheckResult;
  onChange: (text: string) => void;
  onSave: () => Promise<void>;
}> (({ episodeId, initialDoc = "script", workspaceMode = false, onOpenScriptLine, onResearchDirtyChange, text, savedText, check: initialCheck, onChange, onSave }, ref) => {
  const area = useRef<HTMLTextAreaElement>(null);
  const [check, setCheck] = useState<CheckResult>(initialCheck);
  const [saving, setSaving] = useState(false);
  const dirty = text !== savedText;
  // ملف البحث / دراسة الكتاب: للتحضير والمراجعة، لا يُقرأ ولا يُنشر
  const [doc, setDoc] = useState<"script" | "research">(initialDoc);
  const [research, setResearch] = useState<{ text: string; saved: string; label: string; exists: boolean } | null>(null);
  useEffect(() => {
    setResearch(null);
    if (episodeId) api.research(episodeId).then((r) => setResearch({ text: r.text, saved: r.exists ? r.text : "", label: r.label, exists: r.exists })).catch(() => {});
  }, [episodeId]);
  const researchDirty = research ? research.text !== research.saved : false;
  const [researchError, setResearchError] = useState("");
  const [researchSaving, setResearchSaving] = useState(false);
  useEffect(() => {
    onResearchDirtyChange?.(researchDirty);
    return () => onResearchDirtyChange?.(false);
  }, [researchDirty, onResearchDirtyChange]);
  const saveResearch = async () => {
    if (!research || researchSaving) return;
    const snapshot = research.text;
    setResearchError("");
    setResearchSaving(true);
    try {
      await api.saveResearch(episodeId, snapshot);
      // لا تستبدل نصًا تغيّر أثناء انتظار الشبكة بنسخة أقدم.
      setResearch((current) => current ? { ...current, saved: snapshot, exists: true } : null);
    } catch (error) {
      setResearchError(`تعذر حفظ ملف البحث: ${(error as Error).message}`);
    } finally {
      setResearchSaving(false);
    }
  };

  const pendingLine = useRef<number | null>(null);
  const jumpToLine = (line: number) => {
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
  const goToLine = (line: number) => {
    if (workspaceMode && initialDoc === "research" && onOpenScriptLine) {
      onOpenScriptLine(line);
      return;
    }
    if (doc !== "script") {
      pendingLine.current = line;
      setDoc("script");
    } else jumpToLine(line);
  };
  useEffect(() => {
    if (doc === "script" && pendingLine.current !== null) {
      const line = pendingLine.current;
      pendingLine.current = null;
      jumpToLine(line);
    }
  }, [doc]);
  useImperativeHandle(ref, () => ({ goToLine, hasUnsavedResearch: () => researchDirty }));

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
        if (doc === "research") void saveResearch();
        else if (dirty) void save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const errors = check.issues.filter((i) => i.level === "error").length;
  const warnings = check.issues.length - errors;
  const { min, max } = config.episode.chapterSeconds;
  const sortedIssues = [...check.issues].sort((a, b) => (a.level === b.level ? 0 : a.level === "error" ? -1 : 1));

  const saveButton = (isDirty: boolean, busy: boolean, onClick: () => void) => (
    <button className={`btn s12-save${isDirty ? " is-dirty" : ""}`} disabled={!isDirty || busy} onClick={onClick} title="Ctrl+S">
      {busy ? "جارٍ الحفظ…" : "حفظ"}
    </button>
  );

  // شاشة واحدة: المحرر يملأ الشاشة، وبجواره شريط فحص نحيل؛ كل التفاصيل في «أدوات وتفاصيل».
  return (
    <div className={`work script-grid s12-script${doc === "research" ? " s12-research" : ""}`}>
      <div className="editor s12-editor">
        <div className="toolbar s12-bar">
          {workspaceMode ? (
            doc === "research" ? <Hint>{research?.label ?? "البحث"} — للتحضير فقط، لا يُقرأ ولا يُنشر.</Hint> : null
          ) : (
            <div className="seg" role="group" aria-label="الملف">
              <button aria-pressed={doc === "script"} onClick={() => setDoc("script")}>السكريبت</button>
              {research ? <button aria-pressed={doc === "research"} onClick={() => setDoc("research")}>{research.label}{research.exists ? "" : " (جديد)"}</button> : null}
            </div>
          )}
          <span className="spacer" />
          {doc === "script" ? (
            <>
              <span className="s12-status" role="status"><i className={`dot ${dirty ? "dirty" : ""}`} />{dirty ? "غير محفوظ" : "محفوظ"}</span>
              {saveButton(dirty, saving, () => void save())}
            </>
          ) : (
            <>
              <span className="s12-status" role="status"><i className={`dot ${researchDirty ? "dirty" : ""}`} />
                {researchSaving ? "جارٍ حفظ ملف البحث…" : researchDirty ? "غير محفوظ" : research?.exists ? "محفوظ" : "لم يُحفظ بعد"}
              </span>
              {saveButton(researchDirty, researchSaving, () => void saveResearch())}
            </>
          )}
        </div>
        {doc === "research" && researchError ? <p className="s12-alert" role="alert">{researchError}</p> : null}
        {doc === "script" ? (
          <textarea id="script-editor" aria-label="نص السكريبت" ref={area} value={text} onChange={(e) => onChange(e.target.value)} spellCheck={false} dir="rtl" />
        ) : (
          <textarea id="research-editor" aria-label={research?.label ?? "ملف البحث"} value={research?.text ?? ""} onChange={(e) => research && setResearch({ ...research, text: e.target.value })} spellCheck={false} dir="rtl" />
        )}
      </div>
      {doc === "script" ? (
        <aside className="col side s12-rail" aria-label="الفحص">
          <header className="s12-rail-head">
            <span className={`s12-verdict ${check.ok ? "ok" : "bad"}`}>
              <i aria-hidden />
              {check.ok ? "صالح" : `${ar(errors)} ${errors === 1 ? "خطأ" : "أخطاء"}`}
              {warnings ? <span className="s12-soft"> — {ar(warnings)} تنبيه</span> : null}
            </span>
            <span className="s12-num">{ar(check.stats.totalWords)} كلمة — {fmtAr(check.stats.totalSeconds)}</span>
          </header>
          {sortedIssues.length ? (
            <ul className="s12-issues">
              {sortedIssues.map((i, k) => (
                <li key={k}>
                  <button className={`s12-issue ${i.level}`} onClick={() => i.line && goToLine(i.line)} disabled={!i.line}>
                    <span className="s12-msg"><i className="s12-lv" aria-label={i.level === "error" ? "خطأ" : "تنبيه"} />{i.message}</span>
                    {i.line ? <span className="s12-ln">سطر {ar(i.line)}</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : <p className="s12-soft s12-empty">لا ملاحظات.</p>}
          <More>
            {/* نص متصل بلا أقسام (D87): سرد واحد، فلا جدول «الفصول» ولا حد طول للفصل */}
            {!check.stats.divisions ? (
            <section aria-label="الطول">
              <h3 className="s12-h">الطول</h3>
              <p className="s12-soft">سرد واحد متصل: {check.stats.totalWords} كلمة، نحو {fmt(check.stats.totalSeconds)}.</p>
            </section>
            ) : (
            <section aria-label="الفصول">
              <h3 className="s12-h">الفصول</h3>
              <table className="stats s12-stats">
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
            </section>
            )}
            <ReviewPanel episodeId={episodeId} savedText={savedText} onGoTo={goToLine} />
            <section aria-label="العلامات">
              <h3 className="s12-h">العلامات</h3>
              <p className="s12-soft s12-code">[مشهد: …] [آية: النجم 39 | نص الآية بالتشكيل] [حديث: …] [صوت: page-turn] — bridge: …</p>
            </section>
            <section aria-label="اعتماد السكريبت">
              <h3 className="s12-h">اعتماد السكريبت</h3>
              <p className="s12-soft">{dirty ? "احفظ السكريبت أولًا؛ الاعتماد يكون على النسخة المحفوظة." : "يُعتمد من عمود الحلقة أعلاه."}</p>
            </section>
          </More>
        </aside>
      ) : null}
    </div>
  );
});
