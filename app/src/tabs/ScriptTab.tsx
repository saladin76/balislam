import React, { useEffect, useImperativeHandle, useRef, useState, forwardRef } from "react";
import { api, type CheckResult } from "../api";
import config from "../../../config.json";
import { ReviewPanel } from "./ReviewPanel";

export type ScriptTabHandle = { goToLine: (line: number) => void; hasUnsavedResearch: () => boolean };
export type ResearchDraft = { text: string; saved: string; label: string; exists: boolean };

const fmt = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, "0")}`;

/** محرر السكريبت مع فحص مباشر أثناء الكتابة. الحفظ يحدّث المشاهد تلقائيًا مع إبقاء تعديلاتك. */
export const ScriptTab = forwardRef<ScriptTabHandle, {
  episodeId: string;
  channelId?: string;
  initialDoc?: "script" | "research";
  workspaceMode?: boolean;
  onOpenScriptLine?: (line: number) => void;
  onResearchDirtyChange?: (dirty: boolean) => void;
  /** In-memory draft handed back by the parent after navigation. Never silently discard it. */
  researchDraft?: ResearchDraft | null;
  onResearchDraftChange?: (draft: ResearchDraft) => void;
  text: string;
  savedText: string;
  check: CheckResult;
  onChange: (text: string) => void;
  onSave: () => Promise<void>;
}> (({ episodeId, channelId, initialDoc = "script", workspaceMode = false, onOpenScriptLine, onResearchDirtyChange, researchDraft, onResearchDraftChange, text, savedText, check: initialCheck, onChange, onSave }, ref) => {
  const area = useRef<HTMLTextAreaElement>(null);
  const [check, setCheck] = useState<CheckResult>(initialCheck);
  const [saving, setSaving] = useState(false);
  const dirty = text !== savedText;
  // ملف البحث / دراسة الكتاب: للتحضير والمراجعة، لا يُقرأ ولا يُنشر
  const [doc, setDoc] = useState<"script" | "research">(initialDoc);
  const [research, setResearch] = useState<ResearchDraft | null>(researchDraft ?? null);
  const [researchError, setResearchError] = useState("");
  const [researchSaving, setResearchSaving] = useState(false);
  useEffect(() => {
    let active = true;
    if (researchDraft) { setResearch(researchDraft); setResearchError(""); return () => { active = false; }; }
    setResearch(null);
    setResearchError("");
    if (episodeId) api.research(episodeId, channelId).then((r) => {
      if (active) setResearch({ text: r.text, saved: r.exists ? r.text : "", label: r.label, exists: r.exists });
    }).catch((error) => { if (active) setResearchError("تعذر تحميل ملف البحث: " + (error as Error).message); });
    return () => { active = false; };
    // Only reload when the actual episode identity changes, not on a parent callback render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [episodeId, channelId]);
  const researchDirty = research ? research.text !== research.saved : false;
  useEffect(() => {
    onResearchDirtyChange?.(researchDirty);
    if (research) onResearchDraftChange?.(research);
    // The parent retains the draft when this editor unmounts. Never reset dirty on cleanup.
  }, [research, researchDirty, onResearchDirtyChange, onResearchDraftChange]);
  const saveResearch = async () => {
    if (!research || researchSaving) return;
    const snapshot = research.text;
    setResearchError("");
    setResearchSaving(true);
    try {
      await api.saveResearch(episodeId, snapshot, channelId);
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

  return (
    <div className="work script-grid">
      <div className="editor">
        <div className="toolbar">
          {workspaceMode ? (
            <strong className="ew-document-label">{doc === "research" ? (research?.label ?? "البحث") : "تحرير السكريبت"}</strong>
          ) : (
            <div className="seg" role="group" aria-label="الملف">
              <button aria-pressed={doc === "script"} onClick={() => setDoc("script")}>السكريبت</button>
              {research ? <button aria-pressed={doc === "research"} onClick={() => setDoc("research")}>{research.label}{research.exists ? "" : " (جديد)"}</button> : null}
            </div>
          )}
          {doc === "script" ? (
            <>
              <span className="help">العلامات: [مشهد: …] [آية: النجم 39] [حديث: …] [صوت: page-turn] · bridge: …</span>
              <span className="spacer" />
              <span className="status"><i className={`dot ${dirty ? "dirty" : ""}`} />{dirty ? "تعديلات غير محفوظة" : "محفوظ"}</span>
              <button className="btn primary" disabled={!dirty || saving} onClick={save}>{saving ? "جارٍ الحفظ…" : "حفظ (Ctrl+S)"}</button>
            </>
          ) : (
            <>
              <span className="help">للتحضير والمراجعة فقط، لا يُقرأ ولا يُنشر. كل معلومة في السكريبت تُربط هنا بمصدرها.</span>
              <span className="spacer" />
              <span className="status"><i className={`dot ${researchDirty ? "dirty" : ""}`} />{researchDirty ? "تعديلات غير محفوظة" : research?.exists ? "محفوظ" : "لم يُحفظ بعد"}</span>
              <button className="btn primary" disabled={!researchDirty || researchSaving} onClick={() => void saveResearch()}>{researchSaving ? "جارٍ الحفظ…" : "حفظ (Ctrl+S)"}</button>
            </>
          )}
        </div>
        {doc === "research" && researchError ? <div className="ew-research-error" role="alert">{researchError}</div> : null}
        {doc === "script" ? (
          <textarea id="script-editor" ref={area} value={text} onChange={(e) => onChange(e.target.value)} spellCheck={false} dir="rtl" />
        ) : (
          <textarea id="research-editor" value={research?.text ?? ""} disabled={!research} aria-busy={!research && !researchError}
            placeholder={!research ? "جارٍ تحميل ملف البحث…" : ""}
            onChange={(e) => research && setResearch({ ...research, text: e.target.value })} spellCheck={false} dir="rtl" />
        )}
      </div>
      {doc === "research" ? (
        <aside className="col side ew-research-panel">
          <div className="col-head"><h2>ملف البحث</h2></div>
          <p>هذا الملف للتحضير والمراجعة فقط، ولا يدخل في التعليق الصوتي أو النشر.</p>
          <p>اربط المعلومات والملاحظات بالمصادر التي استندت إليها قبل كتابة السكريبت.</p>
          <div className="ew-research-state" role="status">
            {researchSaving ? "جارٍ حفظ ملف البحث…" : researchDirty ? "هناك تعديلات لم تُحفظ" : research?.exists ? "ملف البحث محفوظ" : "ملف البحث لم يُحفظ بعد"}
          </div>
          {researchError ? <p role="alert">{researchError}</p> : null}
        </aside>
      ) : (
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
        <ReviewPanel episodeId={episodeId} savedText={savedText} onGoTo={goToLine} />
      </div>
      )}
    </div>
  );
});
