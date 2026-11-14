import React, { useEffect, useState } from "react";
import { api, type ApiError, type TashkeelCheck, type TashkeelState } from "../api";
import { Hint, More } from "../shell/Screen";
import "../shell/screens-s12.css";
import { OwnerText } from "../ui/OwnerText";
import { PROBLEMS, SENTENCES, WORDS, countAr, sceneName } from "../ui/format";
import { TashkeelBox } from "../workspace/TashkeelBox";

const ar = (n: number) => n.toLocaleString("ar-EG");
/** «التشكيل ٩٩٪» (شارة التبويب ورأس الشريط) */
export const tashkeelBadge = (r: Pick<TashkeelCheck, "report"> & { exists: boolean }): string =>
  !r.exists ? "غير موجود" : `التشكيل ${ar(Math.floor(r.report.coverage * 100))}٪`;
/** سطر الأسبقية: «النطق» المكتوب لجملة يعلو على هذا النص لتلك الجملة وحدها (D131). */
export const SAY_PRECEDENCE = "«النطق» المكتوب تحت جملة في «المشاهد» يعلو على هذا النص لتلك الجملة وحدها.";

/**
 * «النص المشكول» في الخطوة ١ (طلب المالك ١٤ نوفمبر، D132): النسخة المشكولة للصوت وحده، تُحرَّر كالسكريبت (حفظ،
 * Ctrl+S، تراجع المحرر)، وبجوارها التغطية ومشكلات المطابقة مع جمل السكريبت. الحفظ بنسخة الملف التي فُتحت: إن تغيّر
 * الملف بعدها يبقى التعديل في الصفحة ويُعرض الخياران. لا توليد ولا حذف.
 */
export const TashkeelTab: React.FC<{
  episodeId: string;
  order: string[];
  onDirtyChange?: (dirty: boolean) => void;
  onSaved?: (s: TashkeelState) => void;
}> = ({ episodeId, order, onDirtyChange, onSaved }) => {
  const [state, setState] = useState<TashkeelState | null>(null);
  const [text, setText] = useState("");
  const [check, setCheck] = useState<TashkeelCheck | null>(null);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState(false);
  const dirty = state ? text !== state.text : false;

  const load = async () => {
    const s = await api.tashkeel(episodeId);
    setState(s); setText(s.text); setCheck(s); setConflict(false);
    return s;
  };
  useEffect(() => {
    setState(null); setError(""); setMsg(""); setConflict(false);
    load().catch((e) => setError((e as Error).message));
  }, [episodeId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);
  // the report follows what is typed (nothing is saved)
  useEffect(() => {
    if (!state?.exists || !dirty) { if (state) setCheck(state); return; }
    const t = setTimeout(() => api.checkTashkeel(episodeId, text).then(setCheck).catch(() => {}), 600);
    return () => clearTimeout(t);
  }, [text, state, dirty, episodeId]);

  const saved = (s: TashkeelState & { changedSentences: number; staleTakes: number }, created = false) => {
    setState(s); setText(s.text); setCheck(s); setConflict(false); setError("");
    onSaved?.(s);
    setMsg(created
      ? "أُنشئت النسخة المشكولة من السكريبت كما هو. شكِّل كلماتها هنا ثم احفظ؛ التغطية منخفضة حتى تُشكَّل، والتوليد متوقف تحت ٩٨٪."
      : `حُفظت النسخة المشكولة. ${s.changedSentences ? `تغيّر ما يُرسل إلى الصوت في ${countAr(s.changedSentences, SENTENCES)}` : "لم يتغير ما يُرسل إلى الصوت في أي جملة"}${s.staleTakes ? `، و${countAr(s.staleTakes, SENTENCES)} صار تسجيلها «تحتاج توليدًا» في «المشاهد»` : ""}. لا يُولَّد شيء وحده، ونص الجمل والترجمة كما هما.`);
  };
  const save = async (revision = state?.revision) => {
    if (!state || busy || revision === undefined) return;
    setBusy(true); setError(""); setMsg("");
    try { saved(await api.saveTashkeel(episodeId, { text, expectedRevision: revision })); }
    catch (e) {
      if ((e as ApiError).status === 409) setConflict(true);
      else setError(`تعذّر حفظ النسخة المشكولة: ${(e as Error).message}`);
    } finally { setBusy(false); }
  };
  const create = async () => {
    if (!state || busy) return;
    setBusy(true); setError(""); setMsg("");
    try { saved(await api.saveTashkeel(episodeId, { fromScript: true, expectedRevision: state.revision }), true); }
    catch (e) {
      if ((e as ApiError).status === 409) { await load().catch(() => {}); setError("وُجدت نسخة مشكولة على هذا الجهاز الآن؛ فُتحت هنا."); }
      else setError(`تعذّر إنشاء النسخة المشكولة: ${(e as Error).message}`);
    } finally { setBusy(false); }
  };
  // «احفظ تعديلي فوقها»: the page's text over the file as it is now (its current revision, read again)
  const overwrite = async () => {
    try { const now = await api.tashkeel(episodeId); await save(now.revision); }
    catch (e) { setError((e as Error).message); }
  };
  const openSaved = async () => {
    if (dirty && !window.confirm("سيُستبدل تعديلك بالنسخة المحفوظة على الجهاز. هل تريد المتابعة؟")) return;
    await load().catch((e) => setError((e as Error).message));
    setMsg("فُتحت النسخة المحفوظة.");
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); if (dirty) void save(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return <TashkeelView state={state} text={text} check={check} order={order} dirty={dirty} busy={busy} conflict={conflict} error={error} msg={msg}
    onText={setText} onSave={() => void save()} onCreate={() => void create()} onOverwrite={() => void overwrite()} onOpenSaved={() => void openSaved()} />;
};

export type TashkeelViewProps = {
  state: TashkeelState | null; text: string; check: TashkeelCheck | null; order: string[];
  dirty: boolean; busy: boolean; conflict: boolean; error: string; msg: string;
  onText: (t: string) => void; onSave: () => void; onCreate: () => void; onOverwrite: () => void; onOpenSaved: () => void;
};
/** The tab as drawn (no requests): the editor, the save state, the conflict choices, and the check rail. */
export const TashkeelView: React.FC<TashkeelViewProps> = ({ state, text, check, order, dirty, busy, conflict, error, msg, onText, onSave, onCreate, onOverwrite, onOpenSaved }) => {
  if (!state) return error ? <p className="s12-alert" role="alert"><OwnerText text={error} /></p> : <div className="empty-state"><h2>جارٍ فتح النسخة المشكولة…</h2></div>;

  const r = check ?? state;
  const problems = r.alignment;
  return (
    <div className="work script-grid s12-script s12-tashkeel">
      <div className="editor s12-editor">
        <div className="toolbar s12-bar">
          <Hint>للصوت وحده: نص الجمل والترجمة على الشاشة من السكريبت كما هما.</Hint>
          <span className="spacer" />
          {state.exists ? (
            <>
              <span className="s12-status" role="status"><i className={`dot ${dirty ? "dirty" : ""}`} />{busy ? "جارٍ الحفظ…" : dirty ? "غير محفوظ" : "محفوظ"}</span>
              <button className={`btn s12-save${dirty ? " is-dirty" : ""}`} disabled={!dirty || busy} onClick={onSave} title="Ctrl+S">{busy ? "جارٍ الحفظ…" : "حفظ"}</button>
            </>
          ) : null}
        </div>
        <p className="s12-soft s12-precedence">{SAY_PRECEDENCE}</p>
        {conflict ? (
          <div className="s12-alert" role="alert">
            <p>تغيّرت النسخة المشكولة على هذا الجهاز بعد أن فتحتها (حفظ آخر أو تحديث). تعديلك باقٍ هنا؛ اختر:</p>
            <div className="s12-actions">
              <button className="btn" onClick={onOverwrite} disabled={busy}>احفظ تعديلي فوقها</button>
              <button className="btn ghost" onClick={onOpenSaved} disabled={busy}>افتح النسخة المحفوظة</button>
            </div>
          </div>
        ) : null}
        {error ? <p className="s12-alert" role="alert"><OwnerText text={error} /></p> : null}
        {msg ? <p className="s12-soft" role="status"><OwnerText text={msg} /></p> : null}
        {state.exists ? (
          <textarea id="tashkeel-editor" aria-label="النص المشكول" value={text} onChange={(e) => onText(e.target.value)} spellCheck={false} dir="rtl" />
        ) : (
          <div className="s12-empty-doc">
            <h3 className="s12-h">لا توجد نسخة مشكولة لهذه الحلقة بعد</h3>
            <p className="s12-soft">توليد الصوت متوقف حتى تُضاف. تبدأ النسخة من السكريبت كما هو، فتغطية التشكيل تبقى منخفضة حتى تُشكَّل كلماتها هنا؛ والتوليد متوقف تحت ٩٨٪ كما هو.</p>
            <button className="btn primary" onClick={onCreate} disabled={busy}>{busy ? "جارٍ الإنشاء…" : "أنشئ النسخة المشكولة من السكريبت"}</button>
          </div>
        )}
      </div>
      {state.exists ? (
        <aside className="col side s12-rail" aria-label="فحص التشكيل">
          <header className="s12-rail-head">
            <span className={`s12-verdict ${r.report.ok && !problems.length ? "ok" : "bad"}`}>
              <i aria-hidden />{tashkeelBadge({ exists: true, report: r.report })}
              {problems.length ? <span className="s12-soft"> — {countAr(problems.length, PROBLEMS)} في المطابقة</span> : null}
            </span>
            <span className="s12-num">الحد {ar(Math.round(r.report.min * 100))}٪{dirty ? " — قبل الحفظ" : ""}</span>
          </header>
          {r.toneMapStale ? <p className="s12-alert">خريطة النبرة بُنيت على نسخة مشكولة سابقة: توليد المشهد كاملًا متوقف حتى تُحدَّث، والجمل تُولَّد كالمعتاد.</p> : null}
          {problems.length ? (
            <ul className="s12-issues" aria-label="مشكلات المطابقة">
              {problems.map((p, k) => (
                <li key={k}>
                  <div className="s12-issue error">
                    <span className="s12-msg"><i className="s12-lv" aria-label="مطابقة" />
                      <b>{sceneName(order, p.sceneId)}</b>: «{p.sentence}» —{" "}
                      {p.problem === "missing" ? "لا جملة مقابلة لها في النسخة المشكولة" : `تختلف عن السكريبت بعد حذف التشكيل: ${p.words.join("، ")}`}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : <p className="s12-soft s12-empty">كل جمل الراوي لها نظير في النسخة المشكولة.</p>}
          <TashkeelBox t={r.report} order={order} />
          {r.saySentences ? <p className="s12-soft">{countAr(r.saySentences, SENTENCES)} لها «النطق» مكتوبًا؛ يُرسل كما كُتب ولا تدخل هذا الفحص.</p> : null}
          <More>
            <section aria-label="عن النص المشكول">
              <h3 className="s12-h">عن النص المشكول</h3>
              <p className="s12-soft">كل كلمة يقولها الراوي تُرسل إلى الصوت بنظيرتها المشكولة هنا، والمطابقة كلمةً بكلمة بعد حذف التشكيل؛ فلا يلزم أن يطابق السكريبت سطرًا بسطر.</p>
              <p className="s12-soft">الآيات والبسملة لا تُرسل إلى الصوت أبدًا ولو كُتبت هنا؛ تلاوتها تسجيلك البشري.</p>
              <p className="s12-soft">الحفظ لا يولّد شيئًا ولا يحذف تسجيلًا ولا يطلب اعتمادًا جديدًا للتجهيز: الجمل التي تغيّر نطقها تصير «تحتاج توليدًا» في «المشاهد»، ويعود مشهدها للمراجعة حين تولّدها.</p>
              <p className="s12-soft">{countAr(r.report.words, WORDS)} مفحوصة في جمل الراوي.</p>
            </section>
          </More>
        </aside>
      ) : null}
    </div>
  );
};
