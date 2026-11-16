/**
 * D136 — النبرة في «الجمل» عملية وواضحة (بلاغ المالك ١٤ نوفمبر: «لما بعمل توليد مش بيغير الصوت»)، في القنوات الثلاث:
 * - تحت كل جملة: نبرة التسجيل الحالي بجوار نبرة التوليد القادم، و«النبرة تغيّرت — اضغط ولّد لتسمع الجديد» حين تختلفان.
 * - «قارن: القديم / الجديد» بعد التوليد، ولكل تسجيل «استعمل هذا التسجيل» (التسجيلات محفوظة لا تُحذف، D50).
 * - نبرة المشهد كله أو الحلقة كلها: العدد والرصيد قبل أي توليد، ثم «ولّد الجمل» بضغطة المالك. لا يُولَّد شيء وحده.
 */
import React, { useRef, useState } from "react";
import { PlanSpeedSelect } from "../../ui/Pace";
import { api, type SentenceRow, type SentenceScene, type ToneImpact } from "../../api";
import { tones, toneIds } from "../../../../src/voice/tones";
import type { SentencesModel } from "./useSentences";
import type { SentencesPanelProps } from "../SentencesPanel";
import { ar, countAr, toneName } from "./format";

const q = (t: string | null | undefined) => (t && toneName(t) ? `«${toneName(t)}»` : "غير معروفة");
export const TONE_CHANGED = "النبرة تغيّرت — اضغط ولّد لتسمع الجديد";

/** Under a sentence with a take: the take's tone, the next generation's, and «قارن: القديم / الجديد». */
export const ToneLine: React.FC<{ m: SentencesModel; r: SentenceRow }> = ({ m, r }) => {
  if (r.kind !== "narration" || !r.audio || r.status === "old") return null;
  const { busy, run, ref, playClips, urlOf } = m;
  const anyBusy = Boolean(busy);
  const play = (key: string, file: string) => playClips(`cmp:${key}:${r.id}`, [{ id: r.id, url: urlOf(file, "sentences") }]);
  const use = (file: string) => void run(`use:${r.id}`, { ...ref(r), action: "use-take", file });
  return (
    <div className="sv-tonebox" data-tone-changed={r.toneChanged || undefined}>
      <p className="sp-hint sv-tones">
        <span>التسجيل الحالي بنبرة {q(r.takeTone)}</span>
        <span>، والتوليد القادم بنبرة {q(r.nextTone)}</span>
        {r.chosen ? <span>، واخترته بنفسك</span> : null}
      </p>
      {r.toneChanged ? <p className="sv-tone-changed" role="status"><b>{TONE_CHANGED}</b></p> : null}
      {r.previous ? (
        <div className="sv-compare" role="group" aria-label="قارن: القديم / الجديد">
          <span className="sv-lb">قارن:</span>
          <span className="sv-cmp-take">
            <button type="button" className="sv-t" onClick={() => play("old", r.previous!.file)}>▶ القديم ({q(r.previous.tone)})</button>
            <button type="button" className="sv-t" disabled={anyBusy} onClick={() => use(r.previous!.file)}>استعمل هذا التسجيل</button>
          </span>
          <span className="sv-cmp-take is-current">
            <button type="button" className="sv-t" onClick={() => play("new", r.audio!.file)}>▶ الجديد ({q(r.takeTone)})</button>
            {r.chosen ? <span className="sv-cmp-used">المستعمل الآن</span>
              : <button type="button" className="sv-t" disabled={anyBusy} onClick={() => use(r.audio!.file)}>استعمل هذا التسجيل</button>}
          </span>
        </div>
      ) : null}
    </div>
  );
};

/**
 * The tone of the whole scene, or of the whole episode: choose it, see how many sentences it changes and what
 * generating them spends, apply it (the plan's tone only), then «ولّد الجمل» — the owner's click, with its cost.
 * A tone-map episode (دفاتر الزمن) sets tones sentence by sentence in the map: not shown there.
 */
export const SceneToneBar: React.FC<{ m: SentencesModel; p: SentencesPanelProps; s: SentenceScene }> = ({ m, p, s }) => {
  const { read, busy, send, setRead, setError, setMsg } = m;
  const [scope, setScope] = useState<"scene" | "episode">("scene");
  const [pick, setPick] = useState<string | null>(null);
  const [impact, setImpact] = useState<ToneImpact | null>(null);
  const [working, setWorking] = useState<string>("");
  const stop = useRef(false);
  if (read?.toneMap || !p.sceneId || !s.rows.some((r) => r.kind === "narration")) return null;
  const changed = s.rows.filter((r) => r.kind === "narration" && r.toneChanged && !r.tone);
  const chars = changed.reduce((n, r) => n + r.chars, 0);
  const anyBusy = Boolean(busy) || Boolean(working);
  const ask = async (tone: string, sc: "scene" | "episode") => {
    setPick(tone); setImpact(null); setError("");
    try { setImpact(await api.toneImpact(p.episodeId, p.channelId, tone || null, sc === "scene" ? s.id : null)); }
    catch (e) { setError((e as Error).message); }
  };
  const apply = async () => {
    if (pick === null) return;
    setWorking("apply");
    try {
      await p.onBeforeEdit?.();
      const r = await api.toneScope(p.episodeId, p.channelId, { sceneId: scope === "scene" ? s.id : null, tone: pick || null });
      setRead(r.read);
      if (r.plan) p.onPlanReplaced?.(r.plan);
      if (r.media) p.onMediaChange?.(r.media);
      setMsg(r.planChanged ? `اختيرت النبرة ${pick ? `«${toneName(pick)}»` : "الموروثة"} ${scope === "scene" ? "لهذا المشهد" : "للحلقة"}؛ لم يُولَّد شيء. الجمل التي تغيّرت نبرتها عليها «${TONE_CHANGED}».` : "النبرة كما هي؛ لم يتغير شيء.");
      setPick(null); setImpact(null);
      if (r.planChanged) p.onChanged?.();
    } catch (e) { setError((e as Error).message); } finally { setWorking(""); }
  };
  const generateChanged = async () => {
    if (!changed.length) return;
    if (!window.confirm(`ولّد ${countAr(changed.length)} بنبرتها الجديدة؟ يصرف نحو ${ar(chars)} حرفًا من رصيد الصوت. التسجيلات الحالية تبقى محفوظة، و«قارن» يعرض القديم والجديد.`)) return;
    stop.current = false;
    let done = 0;
    for (const r of changed) {
      if (stop.current) break;
      setWorking(`gen ${done + 1}/${changed.length}`);
      const res = await send(`gen:${r.id}`, { action: "generate", id: r.id });
      if (!res) break;
      done++;
    }
    setWorking("");
    setMsg(`وُلّدت ${countAr(done)} بنبرتها الجديدة من ${ar(changed.length)}؛ اسمع «قارن: القديم / الجديد» تحت كل جملة.`);
  };
  const regen = impact?.regenerate;
  return (
    <div className="sv-tonebar" role="group" aria-label="نبرة المشهد أو الحلقة">
      <label className="sv-sel"><span>غيّر النبرة لـ</span>
        <select value={scope} disabled={anyBusy} onChange={(e) => { const sc = e.target.value as "scene" | "episode"; setScope(sc); if (pick !== null) void ask(pick, sc); }}>
          <option value="scene">هذا المشهد كله</option>
          <option value="episode">الحلقة كلها</option>
        </select>
      </label>
      <label className="sv-sel"><span className="ms-vh">النبرة</span>
        <select value={pick ?? "-"} disabled={anyBusy} onChange={(e) => { if (e.target.value !== "-") void ask(e.target.value, scope); else { setPick(null); setImpact(null); } }}>
          <option value="-">اختر نبرة…</option>
          <option value="">{scope === "scene" ? "مثل الحلقة" : "بلا نبرة للحلقة"}</option>
          {toneIds.map((t) => <option key={t} value={t}>{tones[t].nameAr}</option>)}
        </select>
      </label>
      {/* D140: السرعة بعد النبرة، للنطاق نفسه (المشهد كله أو الحلقة كلها)؛ بلا توليد */}
      <label className="sv-sel"><span className="ms-vh">{scope === "scene" ? "سرعة المشهد" : "سرعة الحلقة"}</span>
        <PlanSpeedSelect key={scope} episodeId={p.episodeId} channelId={p.channelId} sceneId={scope === "scene" ? s.id : undefined} onSaved={() => void m.load()} />
      </label>
      {pick !== null && impact && regen ? (
        <p className="sv-tone-impact" role="status">
          {regen.ids.length
            ? <>تُسمع {countAr(regen.ids.length)} بالنبرة الجديدة بعد توليدها — نحو {ar(regen.credits)} من رصيد الصوت ({ar(regen.chars)} حرفًا).</>
            : <>لا تسجيل قائم تتغيّر نبرته.</>}
          {regen.missing ? <> و{countAr(regen.missing)} بلا تسجيل بعد.</> : null} لا يُولَّد شيء الآن.{" "}
          <button type="button" className="btn ghost" disabled={anyBusy} onClick={() => void apply()}>{working === "apply" ? "جارٍ…" : "طبّق النبرة"}</button>
          <button type="button" className="btn ghost" disabled={anyBusy} onClick={() => { setPick(null); setImpact(null); }}>تراجع</button>
        </p>
      ) : null}
      {changed.length ? (
        <p className="sv-tone-impact" role="status">{countAr(changed.length)} في هذا المشهد تغيّرت نبرتها ولم تُولَّد بعد (نحو {ar(chars)} حرفًا).{" "}
          <button type="button" className="btn ghost" disabled={anyBusy || m.noKey} title={m.noKey ? "يتطلب مفتاح الصوت" : "يطلب تأكيدك بالعدد والرصيد أولًا"} onClick={() => void generateChanged()}>
            {working.startsWith("gen") ? `جارٍ التوليد ${working.slice(4).replace(/\d+/g, (d) => ar(Number(d)))}…` : `ولّد الجمل (${ar(changed.length)})`}</button>
          {working.startsWith("gen") ? <button type="button" className="btn ghost" onClick={() => { stop.current = true; }}>أوقف بعد الجملة الحالية</button> : null}
        </p>
      ) : null}
    </div>
  );
};
