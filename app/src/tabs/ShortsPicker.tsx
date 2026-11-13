/**
 * مقاطع الشورتس (D83): صاحب القناة يحدد كل شورت بنفسه — من مشهد إلى مشهد (ولو عبر الأقسام)، بعنوان اختياري
 * للنشر وحده، ويضيف ويحذف ويرتّب، ويرى المدة التقريبية ونص المقطع قبل الحفظ. الحفظ يكتب `plan.shorts` وحدها
 * (لا يمس مشهدًا ولا اعتمادًا). الاختيار مسموح قبل اعتماد النسخة الأساسية؛ الصناعة نفسها تبقى بعده (القاعدة الرابعة).
 * مكانه: «٤ النشر ← الشورتس والريلز»، داخل الصف المطوي نفسه، بلا زر مملوء (الفعل الواحد للشاشة في لوحة القرار).
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { notifyPlanServerFields } from "../planServerFields";
import { api, type ShortsRead } from "../api";
import type { PlanShort } from "../../../src/plan/types";
import { shortRange, type ShortsScene } from "../../../src/plan/shorts";
import { arNum, clockAr } from "../workspace/sceneNames";
import "./shorts.css";
import { OwnerText } from "../ui/OwnerText";

type Row = PlanShort & { key: number };

const sameList = (a: PlanShort[], b: PlanShort[]) =>
  a.length === b.length && a.every((x, i) => x.from === b[i]!.from && x.to === b[i]!.to && (x.title ?? "").trim() === (b[i]!.title ?? "").trim());

/** ملخص مقطع: مشاهده ومدته وأقسامه ونصه (للمعاينة قبل الحفظ) */
export const describeShort = (scenes: readonly ShortsScene[], s: PlanShort) => {
  const picked = shortRange(scenes, s.from, s.to) as ShortsScene[];
  const seconds = picked.reduce((n, x) => n + x.seconds, 0);
  const divisions = [...new Set(picked.map((x) => x.division))];
  const text = picked.map((x) => x.text).join(" ");
  return { picked, seconds, divisions, text, valid: picked.length > 0 };
};

const sceneLabel = (s: ShortsScene) => {
  const t = s.text.length > 46 ? `${s.text.slice(0, 46)}…` : s.text;
  return `${arNum(s.n)} — ${t}`;
};

/** `initial`: قراءة جاهزة (للعرض الأول والاختبار)؛ وإلا تُقرأ من الخادم */
export const ShortsPicker: React.FC<{ episodeId: string; approved: boolean; initial?: ShortsRead }> = ({ episodeId, approved, initial }) => {
  const [data, setData] = useState<ShortsRead | null>(initial ?? null);
  const [rows, setRows] = useState<Row[]>(() => (initial ? (initial.saved ?? initial.suggested).map((x, i) => ({ ...x, key: i + 1 })) : []));
  const [err, setErr] = useState("");
  const [notes, setNotes] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  const [seq, setSeq] = useState(() => (initial ? (initial.saved ?? initial.suggested).length + 1 : 1));

  const adopt = useCallback((r: ShortsRead, warnings: string[] = []) => {
    setData(r);
    const base = r.saved ?? r.suggested;
    setRows(base.map((x, i) => ({ ...x, key: i + 1 })));
    setSeq(base.length + 1);
    setNotes(warnings);
  }, []);
  const reload = useCallback(() => {
    setErr("");
    api.shorts(episodeId).then((r) => adopt(r)).catch((e) => setErr((e as Error).message));
  }, [episodeId, adopt]);
  useEffect(() => { if (!initial) reload(); }, [reload, initial]);

  const scenes = data?.scenes ?? [];
  // اقتراح لم يُحفظ يُحفظ ولو كما هو (فيصير اختيارًا صريحًا)؛ والمحفوظ لا يُحفظ إلا إن تغيّر
  const dirty = !data ? false : data.saved === null ? rows.length > 0 || data.suggested.length > 0 : !sameList(rows, data.saved);
  const unsavedSuggestion = Boolean(data && data.saved === null);
  const max = data?.max ?? 6;
  const summary = useMemo(() => rows.map((r) => describeShort(scenes, r)), [rows, scenes]);

  const patch = (key: number, p: Partial<PlanShort>) => setRows((rs) => rs.map((r) => {
    if (r.key !== key) return r;
    const next = { ...r, ...p };
    // البداية بعد النهاية: تتبعها النهاية (لا مقطع مقلوب)
    const a = scenes.findIndex((s) => s.id === next.from);
    const b = scenes.findIndex((s) => s.id === next.to);
    if (p.from && a > b) next.to = next.from;
    if (p.to && b < a) next.from = next.to;
    return next;
  }));
  const add = () => {
    if (!scenes.length || rows.length >= max) return;
    // يبدأ الجديد بعد آخر مقطع إن أمكن
    const last = rows.at(-1);
    const after = last ? scenes.findIndex((s) => s.id === last.to) + 1 : 0;
    const start = scenes[Math.min(after, scenes.length - 1)]!;
    const end = scenes[Math.min(scenes.findIndex((s) => s.id === start.id) + 3, scenes.length - 1)]!;
    setRows((rs) => [...rs, { key: seq, from: start.id, to: end.id }]);
    setOpen(seq);
    setSeq((n) => n + 1);
  };
  const move = (i: number, d: -1 | 1) => setRows((rs) => {
    const j = i + d;
    if (j < 0 || j >= rs.length) return rs;
    const c = [...rs];
    [c[i], c[j]] = [c[j]!, c[i]!];
    return c;
  });
  const remove = (key: number) => setRows((rs) => rs.filter((r) => r.key !== key));

  const save = async () => {
    setErr(""); setSaving(true);
    try {
      const r = await api.saveShorts(episodeId, rows.map(({ from, to, title }) => ({ from, to, ...(title?.trim() ? { title: title.trim() } : {}) })));
      adopt(r, r.warnings ?? []);
      notifyPlanServerFields([episodeId]);
    } catch (e) {
      setErr((e as Error).message);
    } finally { setSaving(false); }
  };
  const reset = async () => {
    if (!window.confirm(data && data.divisions >= 2
      ? "حذف الاختيار المحفوظ؟ تعود الشورتس شورتًا لكل قسم كما كانت."
      : "حذف الاختيار المحفوظ؟ الحلقة نص متصل، فلا تُصنع شورتس حتى تختار مقاطعها من جديد.")) return;
    setErr(""); setSaving(true);
    try { adopt(await api.resetShorts(episodeId)); notifyPlanServerFields([episodeId]); } catch (e) { setErr((e as Error).message); } finally { setSaving(false); }
  };

  if (!data) return err ? <p className="s45-alert" role="alert"><OwnerText text={err} /></p> : <p className="s45-note">جارٍ تحميل المشاهد…</p>;

  return (
    <section className="shp" aria-label="مقاطع الشورتس">
      <div className="shp-head">
        <h3>مقاطع الشورتس</h3>
        <span className="s45-note">{arNum(rows.length)} من {arNum(max)}</span>
      </div>
      <p className="s45-note">
        {unsavedSuggestion
          ? (data.suggested.length ? "مقترحة من الأقسام كما تُصنع اليوم (بلا عناوين). عدّلها أو احفظها كما هي." : "الحلقة نص متصل: أضف كل شورت من مشهد البداية إلى مشهد النهاية.")
          : "اختيارك محفوظ في خطة الحلقة."}
        {" "}{approved ? "تُصنع بزر «اصنع الشورتس والريلز» بعد الحفظ." : "الاختيار مسموح الآن، والصناعة بعد اعتماد النسخة الأساسية."}
      </p>

      {rows.length ? (
        <ol className="shp-list">
          {rows.map((r, i) => {
            const d = summary[i]!;
            const expanded = open === r.key;
            return (
              <li key={r.key} className={`shp-row${d.valid ? "" : " is-bad"}`}>
                <div className="shp-n" aria-hidden="true">{arNum(i + 1)}</div>
                <div className="shp-body">
                  <div className="shp-pick">
                    <label>
                      <span className="s45-label">من</span>
                      <select value={r.from} onChange={(e) => patch(r.key, { from: e.target.value })} aria-label={`بداية الشورت ${arNum(i + 1)}`}>
                        {scenes.map((s) => <option key={s.id} value={s.id}>{sceneLabel(s)}</option>)}
                      </select>
                    </label>
                    <label>
                      <span className="s45-label">إلى</span>
                      <select value={r.to} onChange={(e) => patch(r.key, { to: e.target.value })} aria-label={`نهاية الشورت ${arNum(i + 1)}`}>
                        {scenes.map((s) => <option key={s.id} value={s.id}>{sceneLabel(s)}</option>)}
                      </select>
                    </label>
                    <label className="shp-title">
                      <span className="s45-label">العنوان</span>
                      <input type="text" value={r.title ?? ""} maxLength={data.titleMax} placeholder="اختياري — للنشر وحده، لا يظهر على الشاشة"
                        onChange={(e) => patch(r.key, { title: e.target.value })} aria-label={`عنوان الشورت ${arNum(i + 1)}`} />
                    </label>
                  </div>
                  <div className="shp-meta">
                    {d.valid ? (
                      <>
                        <span>≈ {clockAr(d.seconds)}</span>
                        <span>{arNum(d.picked.length)} {d.picked.length === 1 ? "مشهد" : "مشاهد"}</span>
                        {data.divisions >= 2 && d.divisions.length > 1 ? <span>يعبر {arNum(d.divisions.length)} أقسام</span> : null}
                        {d.seconds > 180 ? <span className="shp-warn">أطول من ٣ دقائق</span> : d.seconds > 60 ? <span className="shp-warn">أطول من دقيقة</span> : null}
                      </>
                    ) : <span className="shp-warn">اختر بداية ونهاية صحيحتين</span>}
                    <button type="button" className="btn ghost small" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : r.key)}>{expanded ? "أخفِ النص" : "النص"}</button>
                  </div>
                  {expanded && d.valid ? <p className="shp-text" dir="auto">{d.text}</p> : null}
                </div>
                <div className="shp-tools">
                  <button type="button" className="btn ghost small" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`انقل الشورت ${arNum(i + 1)} للأعلى`}>↑</button>
                  <button type="button" className="btn ghost small" disabled={i === rows.length - 1} onClick={() => move(i, 1)} aria-label={`انقل الشورت ${arNum(i + 1)} للأسفل`}>↓</button>
                  <button type="button" className="btn ghost small" onClick={() => remove(r.key)} aria-label={`احذف الشورت ${arNum(i + 1)}`}>حذف</button>
                </div>
              </li>
            );
          })}
        </ol>
      ) : null}

      {err ? <p className="s45-alert" role="alert"><OwnerText text={err} /></p> : null}
      {notes.length ? <ul className="shp-notes">{notes.map((n) => <li key={n}>{n}</li>)}</ul> : null}

      <div className="s45-actions">
        <button type="button" className="btn" disabled={saving || rows.length >= max || !scenes.length} onClick={add}>أضف شورتًا</button>
        <button type="button" className="btn" disabled={saving || !dirty || summary.some((d) => !d.valid)} onClick={() => void save()}>{saving ? "جارٍ الحفظ…" : "احفظ المقاطع"}</button>
        {data.saved !== null ? <button type="button" className="btn ghost" disabled={saving} onClick={() => void reset()}>احذف الاختيار</button> : null}
      </div>
      {approved && dirty ? <p className="s45-note">احفظ قبل الصناعة؛ الشورتس المصنوعة قبلها تبقى بمقاطعها القديمة حتى تُعاد صناعتها.</p> : null}
    </section>
  );
};
