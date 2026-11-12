import React, { useEffect, useRef, useState } from "react";
import { OwnerText } from "../ui/OwnerText";
import { pronunciationApi, type PronunciationStatus } from "../pronunciationApi";

/**
 * «فحص النطق» في «الاتصالات والمفاتيح» (العمل ٩): أداة محلية اختيارية.
 * ١) «ثبّت فحص النطق» بضغطة واحدة بعد رؤية الحجم والمساحة الحرة (لا تثبيت آلي أبدًا)،
 * ٢) «قِس الإنذار الكاذب» على جمل القنوات الثلاث المولَّدة على هذا الجهاز،
 * ٣) «فعّل فحص النطق» بعد رؤية المعدل (مطفأ حتى يقبله المالك). الصوت لا يغادر الجهاز.
 */
const n = (x: number) => x.toLocaleString("ar-EG");
const pct = (x: number) => `${(Math.round(x * 1000) / 10).toLocaleString("ar-EG")}٪`;
const CHANNEL_AR: Record<string, string> = { balislam: "بالإسلام", "dafatir-alzaman": "دفاتر الزمن", "zubdat-alkutub": "زبدة الكتب" };

export const PronunciationCheckSettings: React.FC = () => {
  const [st, setSt] = useState<PronunciationStatus | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const refresh = async () => {
    try {
      const s = await pronunciationApi.status();
      setSt(s);
      if (s.install?.status === "running" || s.measure?.status === "running") timer.current = setTimeout(() => void refresh(), 2000);
    } catch (x) { setErr((x as Error).message); }
  };
  useEffect(() => { void refresh(); return () => clearTimeout(timer.current); }, []);
  const act = async (a: Parameters<typeof pronunciationApi.act>[0]) => {
    setBusy(a); setErr("");
    try { setSt(await pronunciationApi.act(a)); clearTimeout(timer.current); timer.current = setTimeout(() => void refresh(), 1500); }
    catch (x) { setErr((x as Error).message); }
    finally { setBusy(""); }
  };
  if (!st) return null;
  const total = st.sizes.packagesMb + st.sizes.modelMb;
  const installing = st.install?.status === "running";
  const measuring = st.measure?.status === "running";
  const m = st.measurement;
  const badge = !st.installed ? "فحص النطق غير مثبّت" : st.enabled ? "مفعّل" : m ? "مقيس — غير مفعّل" : "مثبّت — غير مفعّل";
  const lowSpace = st.freeMb !== null && st.freeMb < st.requiredFreeMb;

  return (
    <details className="group studio-provider pron-check">
      <summary><strong>فحص النطق</strong> <span>تفريغ محلي لكل جملة بعد توليدها، وتنبيه إن بدت كلمة منطوقة خطأ</span> <em>{badge}</em></summary>
      <p className="help">يعمل على هذا الجهاز وحده: الصوت لا يُرفع إلى أي خدمة. التنبيه يظهر تحت الجملة ولا يمنع الاعتماد أبدًا، فأذنك هي الحكم. لا يُفحص صف آية ولا بسملة.</p>

      {!st.installed ? (
        <div className="pron-step">
          <p className="help">يحتاج تنزيلًا واحدًا: برنامج التفريغ (نحو {n(st.sizes.packagesMb)} م.ب) ونموذج «{st.model}» للعربية (نحو {n(st.sizes.modelMb)} م.ب) — المجموع نحو {n(total)} م.ب.
            {st.freeMb !== null ? <> المساحة الحرة الآن: {n(st.freeMb)} م.ب.</> : null}</p>
          {!st.python ? <div className="note err">لا يوجد Python 3.9 أو أحدث على هذا الجهاز. على ماك يأتي مع «أدوات المطوّر» (Command Line Tools).</div> : null}
          {lowSpace ? <div className="note err">المساحة لا تكفي: يلزم نحو {n(st.requiredFreeMb)} م.ب حرة.</div> : null}
          {installing ? (
            <div role="status" className="pron-progress">
              <progress max={100} value={st.install!.pct} aria-label="تقدم التثبيت" /> <span>{st.install!.label} {n(st.install!.pct)}٪</span>
            </div>
          ) : (
            <button type="button" className="btn primary small" disabled={Boolean(busy) || !st.python || lowSpace} onClick={() => void act("install")}>
              {busy === "install" ? "يبدأ…" : `ثبّت فحص النطق (نحو ${n(total)} م.ب)`}
            </button>
          )}
          {st.install?.status === "error" ? <div className="note err"><OwnerText text={`تعذّر التثبيت: ${st.install.error ?? ""}`} /></div> : null}
        </div>
      ) : (
        <div className="pron-step">
          <p className="help">مثبّت: faster-whisper {st.version}، النموذج «{st.model}».</p>
          {measuring ? (
            <div role="status" className="pron-progress"><progress max={Math.max(1, st.measure!.total)} value={st.measure!.done} aria-label="تقدم القياس" /> <span>يقيس… {st.measure!.label}</span></div>
          ) : (
            <button type="button" className="btn small" disabled={Boolean(busy)} onClick={() => void act("measure")}>{m ? "أعد قياس الإنذار الكاذب" : "قِس الإنذار الكاذب"}</button>
          )}
          {st.measure?.status === "error" ? <div className="note err"><OwnerText text={`تعذّر القياس: ${st.measure.error ?? ""}`} /></div> : null}
          {m ? (
            <div className="pron-measure">
              <p><b>الإنذار الكاذب: {pct(m.rate)}</b> — {m.basis === "heard"
                ? <>من {n(m.heard)} جملة علّمتها «سمعتها»، نُبّه على {n(m.heardFlagged)}.</>
                : <>من {n(m.sentences)} جملة مولَّدة، نُبّه على {n(m.flagged)} (حدّ أعلى: بعضها قد يكون خطأً حقيقيًا).</>}</p>
              <ul className="help">
                {Object.entries(m.channels).map(([c, s]) => <li key={c}>{CHANNEL_AR[c] ?? c}: {n(s.sentences)} جملة، تنبيه على {n(s.flagged)}</li>)}
              </ul>
              {m.examples.length ? (
                <details><summary>أمثلة ما نُبّه عليه ({n(m.examples.length)})</summary>
                  <ul className="help">{m.examples.map((e, i) => <li key={i}>{CHANNEL_AR[e.channel] ?? e.channel} {e.episode}: «{e.word}»{e.heard ? <> ← سُمعت «{e.heard}»</> : null}</li>)}</ul>
                </details>
              ) : null}
            </div>
          ) : <p className="help">قبل التفعيل: القياس يفرّغ جمل القنوات الثلاث المولَّدة على هذا الجهاز ويعدّ التنبيهات، لترى كم مرة سينبّه بلا خطأ.</p>}
          <div className="key-row">
            {st.enabled ? (
              <button type="button" className="btn small" disabled={Boolean(busy)} onClick={() => void act("disable")}>أوقف فحص النطق</button>
            ) : (
              <button type="button" className="btn primary small" disabled={Boolean(busy) || !m || measuring} onClick={() => void act("enable")}
                title={!m ? "قِس الإنذار الكاذب أولًا" : ""}>{m ? `قبلت المعدل (${pct(m.rate)}) — فعّل فحص النطق` : "فعّل فحص النطق"}</button>
            )}
            <button type="button" className="btn ghost small" disabled={Boolean(busy) || measuring} onClick={() => {
              if (window.confirm(`أزيل فحص النطق من هذا الجهاز (نحو ${n(total)} م.ب)؟ يمكنك تثبيته من جديد في أي وقت.`)) void act("uninstall");
            }}>أزله من الجهاز</button>
          </div>
        </div>
      )}
      {err ? <div className="note err" role="alert"><OwnerText text={err} /></div> : null}
    </details>
  );
};
