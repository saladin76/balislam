/**
 * «سرعة الإلقاء» و«الفاصل بين الجمل» (D140) — مكوّن واحد للقنوات الثلاث:
 * - `SpeedSelect`: بجوار اختيار النبرة أينما يُختار (الجملة، والمشهد، والحلقة): النبرة أولًا ثم السرعة.
 * - `EpisodePace`: في رأس «٢ المشاهد»: سرعة الحلقة والفاصل، والمدة الآن والتقديرية، والمشاهد المتأثرة، و«أعد إنتاج
 *   المشاهد المتأثرة» (مجانًا، بلا توليد صوت)، وسطر «تغيّرت سرعة الحلقة — …» للمشهد المعروض إن تأثر.
 * الحفظ يكتب pace.json وحده؛ لا صوت يتغير ولا اعتماد يسقط حتى «أعد إنتاج المشاهد».
 */
import React, { useEffect, useState } from "react";
import { api } from "../api";
import { SPEEDS, PAUSES, speedIds, pauseIds, type SpeedId, type PauseId } from "../../../src/voice/paceOptions";
import type { PaceStatus } from "../../../src/voice/paceApply";
import { duration as clock } from "./format";
import { OwnerText } from "./OwnerText";

const PACE_EVENT = "bal:pace-changed";
/** أي تغيير في السرعة من أي مكان يعيد قراءة لوحة الإيقاع */
export const paceChanged = () => window.dispatchEvent(new Event(PACE_EVENT));

const ar = (n: number) => n.toLocaleString("ar-EG");
export const speedName = (id: string) => (id in SPEEDS ? SPEEDS[id as SpeedId].nameAr : "");

/** قائمة السرعة بجوار قائمة النبرة: «مثل …» (الموروث) ثم هادئ / متوسط / سريع */
export const SpeedSelect: React.FC<{
  value: string; inherited: string; inheritFrom: string; disabled?: boolean; title?: string; className?: string; id?: string;
  ariaLabel: string; onChange: (speed: SpeedId | null) => void;
}> = ({ value, inherited, inheritFrom, disabled, title, className, id, ariaLabel, onChange }) => (
  <select id={id} className={className ?? "sv-speed"} aria-label={ariaLabel} value={value} disabled={disabled} title={title ?? "السرعة بعد النبرة: تُطبَّق على التسجيل القائم بلا توليد"}
    onChange={(e) => onChange((e.target.value || null) as SpeedId | null)}>
    <option value="">{`${inheritFrom} (${speedName(inherited) || SPEEDS.medium.nameAr})`}</option>
    {speedIds.map((s) => <option key={s} value={s}>{SPEEDS[s].nameAr}</option>)}
  </select>
);

/** سرعة مشهد أو الحلقة، بجوار نبرتها في محرر الحلقة (يقرأ ويحفظ pace.json) */
export const PlanSpeedSelect: React.FC<{ episodeId: string; channelId?: string; sceneId?: string; id?: string; onSaved?: () => void }> = ({ episodeId, channelId, sceneId, id, onSaved }) => {
  const [st, setSt] = useState<PaceStatus | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    let live = true;
    const read = () => api.pace(episodeId, channelId).then((x) => live && setSt(x), () => {});
    void read();
    window.addEventListener(PACE_EVENT, read);
    return () => { live = false; window.removeEventListener(PACE_EVENT, read); };
  }, [episodeId, channelId]);
  if (!st) return null;
  const row = sceneId ? st.scenes.find((x) => x.id === sceneId) : undefined;
  if (sceneId && !row) return null;
  const save = async (speed: SpeedId | null) => {
    setErr("");
    try { setSt(await api.setPace(episodeId, channelId, sceneId ? { action: "scene", sceneId, speed } : { action: "episode", speed })); paceChanged(); onSaved?.(); }
    catch (e) { setErr((e as Error).message); }
  };
  return (
    <>
      <SpeedSelect id={id} className="pace-select" ariaLabel={sceneId ? "سرعة المشهد" : "سرعة الحلقة"}
        value={sceneId ? (st.scenesSet[sceneId] ?? "") : st.episode.speedSet ? st.episode.speed : ""}
        inherited={sceneId ? st.episode.speed : "medium"} inheritFrom={sceneId ? "مثل الحلقة" : "الافتراضي"}
        disabled={Boolean(row?.exempt)} title={row?.exempt ?? undefined} onChange={(v) => void save(v)} />
      {err ? <span className="pace-err" role="alert"><OwnerText text={err} /></span> : null}
    </>
  );
};

export const EpisodePace: React.FC<{ episodeId: string; channelId: string; shownId?: string; onApplied?: () => void }> = ({ episodeId, channelId, shownId, onApplied }) => {
  const [st, setSt] = useState<PaceStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const read = () => api.pace(episodeId, channelId).then(setSt, () => {});
  useEffect(() => {
    void read();
    window.addEventListener(PACE_EVENT, read);
    return () => window.removeEventListener(PACE_EVENT, read);
  }, [episodeId, channelId]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!st) return null;
  const save = async (body: { speed?: SpeedId | null; pause?: PauseId | null }) => {
    setBusy(true); setMsg("");
    try { setSt(await api.setPace(episodeId, channelId, { action: "episode", ...body })); paceChanged(); }
    catch (e) { setMsg((e as Error).message); }
    finally { setBusy(false); }
  };
  const apply = async () => {
    setBusy(true); setMsg("");
    try {
      const r = await api.applyPace(episodeId, channelId);
      const n = r.pace?.applied.length ?? 0, f = r.pace?.failed.length ?? 0;
      setMsg(`${n ? `طُبّقت السرعة على ${ar(n)} مشهد من تسجيلاتها القائمة، وتُنتج مسوداتها الآن.` : "لا مشهد يحتاج نسخة جديدة؛ تُنتج المسودات الآن."}${f ? ` تعذّر ${ar(f)}: ${r.pace!.failed[0]!.error}` : ""}`);
      paceChanged(); onApplied?.();
    } catch (e) { setMsg((e as Error).message); }
    finally { setBusy(false); void read(); }
  };
  const n = st.affected.length;
  const shown = shownId ? st.scenes.find((x) => x.id === shownId) : undefined;
  const diff = st.seconds.next - st.seconds.now;
  return (
    <div className="pace">
      {shown?.affected ? <p className="pace-scene" role="status">تغيّرت سرعة الحلقة — أعد إنتاج المشاهد لترى الإيقاع الجديد</p> : null}
      <details className="pace-box">
        <summary>
          <b>الإيقاع</b> {SPEEDS[st.episode.speed].nameAr}، الفاصل {PAUSES[st.episode.pause].nameAr}، المدة <span className="clk">{clock(st.seconds.now)}</span>
          {n ? <span className="pace-badge">{ar(n)} مشهد تحتاج إعادة إنتاج</span> : null}
        </summary>
        <div className="pace-body">
          <div className="pace-row" role="radiogroup" aria-label="سرعة الإلقاء في الحلقة">
            <span className="pace-lb">سرعة الإلقاء</span>
            {speedIds.map((s) => (
              <button key={s} type="button" role="radio" aria-checked={st.episode.speed === s} className={`btn${st.episode.speed === s ? "" : " ghost"}`} disabled={busy}
                title={SPEEDS[s].hintAr} onClick={() => void save({ speed: s === "medium" ? null : s })}>{SPEEDS[s].nameAr}</button>
            ))}
          </div>
          <div className="pace-row" role="radiogroup" aria-label="الفاصل بين الجمل والمشاهد">
            <span className="pace-lb">الفاصل بين الجمل والمشاهد</span>
            {pauseIds.map((p) => (
              <button key={p} type="button" role="radio" aria-checked={st.episode.pause === p} className={`btn${st.episode.pause === p ? "" : " ghost"}`} disabled={busy}
                onClick={() => void save({ pause: p === "normal" ? null : p })}>{PAUSES[p].nameAr}</button>
            ))}
          </div>
          <p className="sp-hint">السرعة لكل نبرة كما هي: «متوسط» سرعة النبرة نفسها، و«هادئ» أبطأ قليلًا، و«سريع» أسرع. تختار السرعة أيضًا لكل مشهد أو جملة بجوار نبرتها. تُطبَّق على التسجيلات القائمة بلا توليد ولا رصيد؛ التلاوة والبسملة ومشهد الآية وتمهيدها كما هي.</p>
          <p className="pace-est">
            المدة الآن <b className="clk">{clock(st.seconds.now)}</b>
            {n ? <> ← بعد إعادة الإنتاج نحو <b className="clk">{clock(st.seconds.next)}</b> {Math.abs(diff) < 0.5
              ? "(المدة نفسها تقريبًا: المشاهد المتأثرة قصيرة أو يمسكها زمن قراءة نصها على الشاشة)"
              : <>({diff < 0 ? "أقصر" : "أطول"} بنحو <span className="clk">{clock(Math.abs(diff))}</span>)</>}</> : null}
          </p>
          {n ? (
            <div className="pace-apply">
              <button type="button" className="btn" disabled={busy} onClick={() => void apply()}>
                {busy ? "جارٍ التطبيق…" : `أعد إنتاج المشاهد المتأثرة (${ar(n)}) — مجانًا`}
              </button>
              <span className="sp-hint">بلا توليد صوت. {st.reopens.length ? `${ar(st.reopens.length)} منها معتمد أو مُرسل ويعود للمراجعة، ` : ""}ويُلغى التجميع والنسخة النهائية والإذن إن وُجدت.</span>
            </div>
          ) : <p className="sp-hint">كل المشاهد بالإيقاع المختار.</p>}
          {msg ? <p className="pace-msg" role="status"><OwnerText text={msg} /></p> : null}
        </div>
      </details>
    </div>
  );
};

/** سرعة الجملة في «الجمل» (بجوار نبرتها) */
export const SentenceSpeed: React.FC<{ episodeId: string; channelId: string; sceneId: string; text: string; speed: string; inherited: string;
  exempt: string | null; disabled?: boolean; onSaved: () => void }> = ({ episodeId, channelId, sceneId, text, speed, inherited, exempt, disabled, onSaved }) => exempt
  ? <span className="sv-speed-note" title={exempt}>السرعة كما هي</span>
  : (
  <SpeedSelect ariaLabel="سرعة الجملة" value={speed} inherited={inherited} inheritFrom="مثل المشهد" disabled={disabled}
    onChange={(v) => void api.setPace(episodeId, channelId, { action: "sentence", sceneId, text, speed: v }).then(() => { paceChanged(); onSaved(); }, () => {})} />
);
