import React, { useRef, useState } from "react";
import { api, type SceneProductionRead } from "../../api";
import type { Plan } from "../../../../src/plan/types";
import { showsDivision } from "../../../../src/script/divisions";
import { arabicCountAr, SCENES } from "../../../../src/i18n/count";
import { sceneSeconds } from "../../../../src/plan/duration";
import { FramePlayer } from "../FramePlayer";
import { clockAr, sceneName, seamName } from "../sceneNames";
import { Icon } from "../../ui/icons";
import { Num, duration as clock } from "../../ui/format";
import { OwnerText } from "../../ui/OwnerText";
import { noop } from "./notes";

/** وصلة في النسخة المجمعة: اسمها بالأرقام، وزر ينقل المشغّل إليها (لا يعلّمها مفحوصة؛ العلامة للمالك). */
export const SeamRow: React.FC<{ label: string; at?: number; checked: boolean; onCheck: (v: boolean) => void; onJump: (t: number) => void }> = ({ label, at, checked, onCheck, onJump }) => (
  <div className="sp-seam">
    <label><input type="checkbox" checked={checked} onChange={(e) => onCheck(e.target.checked)} /> {label}</label>
    {at != null ? <button type="button" className="prep-link" onClick={() => onJump(at)} title="يشغّل من قبل الوصلة بثانيتين">عند {clockAr(at)}</button> : null}
  </div>
);

/**
 * Step ٣ «الوصلات» (direction D): one seam at a time between two scenes of the assembled episode: the last
 * moment of one scene and the first of the next (both frames from the assembled file itself), when it falls,
 * what is said on each side, «استمع للوصلة» (three seconds before and after), and the whole episode as a
 * timeline with a diamond per seam (heard / on screen / not heard) and a dot on each verse for its recitation.
 * «الوصلة سليمة» marks the seam heard and moves on; when every seam is heard, the one filled button approves
 * the assembly after the full 1× viewing, through the same `approve-assembly` decision (seams checked, 1× confirmed).
 * No seam timing can be changed here: there is no API for it; the pause is shown, not edited.
 */
export const SeamReview: React.FC<{
  episodeId: string; data: SceneProductionRead; order: string[]; plan?: Plan; thumb?: (id: string) => React.ReactNode;
  at: number; onAt: (i: number) => void; heard: Record<string, boolean>;
  onHeard: (seam: string, v: boolean, how?: "played" | "confirmed", playedSec?: number) => void;
  reviewed: boolean; onReviewed: (v: boolean) => void; pending: boolean; error: string; onApprove: () => void;
  /** «أعد الدمج»: a new assembly from the same approved cuts (cancels this one's review through the ledger). */
  onReassemble?: () => void;
}> = ({ episodeId, data, order, plan, thumb, at, onAt, heard, onHeard, reviewed, onReviewed, pending, error, onApprove, onReassemble }) => {
  const player = useRef<HTMLVideoElement>(null);
  const stopAt = useRef<number | null>(null);
  const [needs, setNeeds] = useState("");
  // M6: «الوصلة سليمة» only after this seam's audio was played across its whole window (or «سمعتها»).
  const [played, setPlayed] = useState<Record<string, number>>({});
  const listenFrom = useRef<{ seam: string; from: number } | null>(null);
  const seams = data.seams;
  const seam = seams[at] ?? "";
  const [a, b] = seam.split(">");
  const times = data.seamTimes ?? {};
  const tAt = times[seam];
  const src = api.previewUrl(episodeId, "episode.mp4");
  const heardCount = seams.filter((x) => heard[x]).length;
  const allHeard = heardCount === seams.length;
  const scenesOf = new Map((plan?.chapters ?? []).flatMap((c) => c.scenes.map((x) => [x.id, { scene: x, chapter: c }] as const)));
  const words = (t: string | undefined, take: number, end: boolean) => {
    const w = (t ?? "").trim().split(/\s+/).filter(Boolean);
    if (!w.length) return "";
    return end ? `…${w.slice(-take).join(" ")}` : `${w.slice(0, take).join(" ")}…`;
  };
  // Each scene's length in the assembled file, from the seam times (the ruler and the timeline widths).
  const starts = [0, ...seams.map((x) => times[x] ?? NaN)];
  const known = starts.every((x) => Number.isFinite(x));
  const lastScene = scenesOf.get(order[order.length - 1] ?? "")?.scene;
  const total = known && seams.length ? starts[starts.length - 1]! + Math.max(2, lastScene ? sceneSeconds(lastScene) : 4) : 0;
  const len = (i: number) => (known && total ? (i + 1 < starts.length ? starts[i + 1]! - starts[i]! : total - starts[i]!) : 1);
  const listen = () => {
    const v = player.current;
    if (!v || tAt === undefined) return;
    v.currentTime = Math.max(0, tAt - 3);
    stopAt.current = tAt + 3;
    listenFrom.current = { seam, from: Math.max(0, tAt - 3) };
    void v.play().catch(noop);
  };
  const playedHere = played[seam] ?? 0;
  const canMark = Boolean(heard[seam]) || playedHere >= SEAM_WINDOW - 0.5;
  const ok = () => {
    if (!allHeard) {
      if (!canMark) { setNeeds("استمع للوصلة كاملة أولًا («استمع للوصلة»: ٣ ث قبلها و٣ بعدها)، أو ضع علامة «سمعتها»."); return; }
      setNeeds("");
      if (!heard[seam]) onHeard(seam, true, "played", playedHere);
      const nextIdx = seams.findIndex((x, i) => i > at && !heard[x]);
      if (nextIdx >= 0) onAt(nextIdx);
      return;
    }
    if (!reviewed) { setNeeds("ضع علامة «شاهدت الحلقة كاملة ١×» بعد مشاهدتها كاملة، ثم اضغط الزر."); return; }
    setNeeds("");
    onApprove();
  };
  const verse = (id: string) => scenesOf.get(id)?.scene.template === "verse-card";
  const pendingRec = new Set(data.progress.recitationPending ?? []);
  const chapterOf = (id: string) => scenesOf.get(id)?.chapter;
  const report = data.seamReport;
  const rowOf = new Map((report?.rows ?? []).map((r) => [r.seam, r]));
  const longSeams = (report?.rows ?? []).filter((r) => r.over);
  return (
    <section className="ms-final" aria-label="الوصلات بين المشاهد">
      <header className="ms-final-head">
        <div><h1 className="ms-title">النسخة النهائية</h1><p className="ms-sub">استمع لكل وصلة بين مشهدين؛ بعدها تُصنع النسخة الأساسية 4K.</p></div>
        <dl className="ms-stats">
          <div><dt>مشهدًا معتمدًا</dt><dd><Num>{data.progress.approvedScenes}</Num></dd></div>
          <div><dt>وصلة مسموعة</dt><dd><Num>{`${heardCount} من ${seams.length}`}</Num></dd></div>
        </dl>
      </header>
      {error ? <p className="scene-first-error" role="alert"><OwnerText text={error} /></p> : null}
      {report ? <SeamReport report={report} order={order} long={longSeams} pending={pending} onReassemble={onReassemble} onAt={(s) => { const i = seams.indexOf(s); if (i >= 0) onAt(i); }} /> : null}
      {seam ? (
        <>
          <div className="ms-seam">
            <figure className="ms-seam-f">
              {tAt !== undefined ? <video src={`${src}#t=${Math.max(0, tAt - 0.12).toFixed(2)}`} preload="metadata" muted playsInline aria-label={`آخر لحظة من ${sceneName(order, a)}`} /> : <div className="sp-empty">بلا توقيت</div>}
              <figcaption>آخر {sceneName(order, a)}</figcaption>
            </figure>
            <div className="ms-seam-mid">
              <span>الوصلة <Num>{`${sceneNoOr(order, a)} ← ${sceneNoOr(order, b)}`}</Num></span>
              <b>{tAt !== undefined ? <Num className="clk">{clockAr(tAt)}</Num> : "—"}</b>
              <span>موضعها في الحلقة</span>
              {rowOf.get(seam) ? <SeamGap row={rowOf.get(seam)!} tolerance={report!.tolerance} /> : null}
            </div>
            <figure className="ms-seam-f">
              {tAt !== undefined ? <video src={`${src}#t=${(tAt + 0.12).toFixed(2)}`} preload="metadata" muted playsInline aria-label={`أول لحظة من ${sceneName(order, b)}`} /> : <div className="sp-empty">بلا توقيت</div>}
              <figcaption className="is-start">أول {sceneName(order, b)}</figcaption>
            </figure>
          </div>
          {plan ? (
            <div className="ms-said">
              <span><em>آخر ما يُقال</em>{words(scenesOf.get(a!)?.scene.narration, 4, true) || (verse(a!) ? "آية" : "—")}</span>
              <span />
              <span><em>أول ما يُقال</em>{words(scenesOf.get(b!)?.scene.narration, 4, false) || (verse(b!) ? "آية" : "—")}</span>
            </div>
          ) : null}
          <div className="ms-seamtools">
            <button type="button" className="ms-listen" onClick={listen} disabled={tAt === undefined}><Icon name="play" />استمع للوصلة<small>٣ ث قبلها و٣ بعدها</small></button>
            <label className="sp-confirm"><input type="checkbox" checked={Boolean(heard[seam])} onChange={(e) => onHeard(seam, e.target.checked, "confirmed")} /> سمعتها</label>
            {chapterOf(a!) && showsDivision(plan?.chapters ?? [], chapterOf(a!)!) ? <span className="ms-seam-where">داخل الفصل <Num>{String(chapterOf(a!)!.number)}</Num> «{chapterOf(a!)!.title}»</span> : null}
          </div>
        </>
      ) : null}
      <section className="ms-tl" aria-label="الحلقة كاملة">
        <div className="ms-tl-head">
          <b>الحلقة كاملة</b>
          <span><Num>{arabicCountAr(order.length, SCENES)}</Num>{total ? <>، <Num className="clk">{clockAr(total)}</Num></> : null}</span>
          <span className="s3-legend" aria-hidden="true"><span><i className="d is-on" />الوصلة الحالية</span><span><i className="d is-ok" />مسموعة</span><span><i className="d" />لم تُسمع</span><span><i className="is-verse" />آية، سكون مقصود</span><span><i className="r is-ok" />تلاوة مرفقة</span><span><i className="r" />تنتظر التلاوة</span></span>
        </div>
        <ol className="ms-tl-strip">
          {order.map((id, i) => (
            <React.Fragment key={id}>
              <li className={`ms-tl-clip${verse(id) ? " is-verse" : ""}`} style={{ flex: len(i) }} title={sceneName(order, id)}>
                {verse(id) ? <><span className={`r${pendingRec.has(id) ? "" : " is-ok"}`} aria-label={pendingRec.has(id) ? "تنتظر التلاوة" : "تلاوة مرفقة"} /><b>آية</b></>
                  : <>{thumb && Math.abs(i - at) <= 6 ? thumb(id) : <span className="s3-dot-ph" aria-hidden="true" />}<span className="s3-dot-n">{arNumOf(i + 1)}</span></>}
              </li>
              {i < order.length - 1 ? (
                <li className={`ms-tl-sm${i === at ? " is-on" : heard[seams[i]!] ? " is-ok" : ""}`}>
                  <button type="button" onClick={() => onAt(i)} aria-current={i === at ? "true" : undefined}
                    aria-label={`${seamName(order, seams[i]!)}${heard[seams[i]!] ? " (مسموعة)" : ""}`}><i /></button>
                </li>
              ) : null}
            </React.Fragment>
          ))}
        </ol>
        {known && total ? (
          <div className="ms-ruler" aria-hidden="true">
            {Array.from({ length: Math.floor(total / 60) + 1 }, (_, m) => <span key={m} style={{ insetInlineStart: `${(100 * m * 60) / total}%` }}><Num className="clk">{clock(m * 60)}</Num></span>)}
          </div>
        ) : null}
      </section>
      <details className="more ms-full" open={allHeard}>
        <summary>شاهد الحلقة كاملة ١×</summary>
        <div className="more-body">
          <FramePlayer ref={player} src={src} label="الحلقة المجمعة"
            onTimeUpdate={(e) => {
              const t = e.currentTarget.currentTime;
              const l = listenFrom.current;
              if (l) setPlayed((m) => ({ ...m, [l.seam]: Math.max(m[l.seam] ?? 0, t - l.from) }));
              if (stopAt.current !== null && t >= stopAt.current) { e.currentTarget.pause(); stopAt.current = null; listenFrom.current = null; }
            }} />
          <fieldset className="scene-first-seams">
            <legend>كل الوصلات: <Num>{`${heardCount} من ${seams.length}`}</Num></legend>
            {seams.map((x) => (
              <SeamRow key={x} label={seamName(order, x)} at={times[x]} checked={Boolean(heard[x])} onCheck={(v) => onHeard(x, v)}
                onJump={(t) => { const v = player.current; if (!v) return; v.currentTime = Math.max(0, t - 2); void v.play().catch(noop); }} />
            ))}
          </fieldset>
        </div>
      </details>
      <div className="ms-dock" role="group" aria-label="قرار الوصلة">
        {needs ? <p className="ms-float spine-needs" role="alert">{needs}</p> : null}
        <div className="ms-dock-in">
          <button type="button" className="ms-nv" disabled={at <= 0} onClick={() => onAt(at - 1)} aria-label="الوصلة السابقة"><Icon name="chevR" /></button>
          {allHeard ? <label className="ms-cb"><input type="checkbox" checked={reviewed} onChange={(e) => { onReviewed(e.target.checked); setNeeds(""); }} /> شاهدت الحلقة كاملة ١×</label> : null}
          <button type="button" className="btn primary" disabled={pending} aria-disabled={!allHeard && !canMark ? true : undefined} onClick={ok}
            title={!allHeard && !canMark ? "استمع للوصلة كاملة أولًا، أو ضع علامة «سمعتها»" : undefined}>
            <Icon name="check" />{allHeard ? (pending ? "جارٍ الاعتماد…" : "اعتمد الوصلات") : "الوصلة سليمة"}
          </button>
          {/* D223 (قرار المالك ٢٥ نوفمبر): الاعتماد بضغطة واحدة، والوصلات فحص اختياري */}
          <button type="button" className="btn" disabled={pending} onClick={onApprove}>{pending ? "جارٍ الاعتماد…" : "اعتمد التجميع"}</button>
          <span className="ms-dv" aria-hidden="true" />
          <span className="ms-ct"><b><Num>{heardCount}</Num></b> من <Num>{seams.length}</Num> وصلة مسموعة</span>
          <button type="button" className="ms-nv" disabled={at >= seams.length - 1} onClick={() => onAt(at + 1)} aria-label="الوصلة التالية"><Icon name="chev" /></button>
        </div>
      </div>
    </section>
  );
};
export const arNumOf = (n: number) => n.toLocaleString("ar-EG");
const secAr = (x: number) => `${x.toLocaleString("ar-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ث`;

/** The silence of one seam: «الصمت ٠٫٢٢ ث (المختار ٠٫٢١)», a warning above the chosen gap, or why it is a deliberate pause. */
export const SeamGap: React.FC<{ row: NonNullable<SceneProductionRead["seamReport"]>["rows"][number]; tolerance: number }> = ({ row }) => (
  <span className={`ms-seam-gap${row.over ? " is-over" : ""}`} data-seam-gap={row.seam}>
    {row.gap === null ? (row.kept ?? "وقفة مقصودة")
      : row.kept ? <>الصمت <Num>{secAr(row.gap)}</Num>، وقفة مقصودة: {row.kept}</>
      : <>الصمت <Num>{secAr(row.gap)}</Num>{row.target !== null ? <> (المختار <Num>{secAr(row.target)}</Num>)</> : null}{row.over ? <>، أطول من المختار: {row.over}</> : null}</>}
  </span>
);

/** Step ٣ seam report (owner, 16 Nov): before watching, how long the narration stops at each seam. */
export const SeamReport: React.FC<{ report: NonNullable<SceneProductionRead["seamReport"]>; order: string[]; long: { seam: string; gap: number | null; over?: string }[];
  pending: boolean; onReassemble?: () => void; onAt: (seam: string) => void }> = ({ report, order, long, pending, onReassemble, onAt }) => {
  const joined = report.rows.filter((r) => !r.kept && r.gap !== null);
  const max = joined.reduce((m, r) => Math.max(m, r.gap!), 0);
  return (
    <div className={`ms-seam-report${long.length ? " is-warn" : ""}`} role={long.length ? "alert" : undefined} data-seam-report={report.source}>
      <p>
        {report.source === "legacy"
          ? <>هذه النسخة جُمعت قبل وصل السرد: الكلام يتوقف عند الوصلات أطول من الفاصل بين الجمل. اضغط «أعد الدمج» لتُجمع المشاهد المعتمدة نفسها متصلة.</>
          : <>الفاصل بين الجمل والمشاهد: «{report.pause.nameAr}». أطول صمت عند وصلة متصلة <Num>{secAr(max)}</Num>{long.length ? <>، و<Num>{arNumOf(long.length)}</Num> وصلة أطول من المختار</> : <>، وكل الوصلات في حدّ المختار</>}.</>}
      </p>
      {long.length ? (
        <ul>{long.slice(0, 12).map((r) => (
          <li key={r.seam}><button type="button" className="prep-link" onClick={() => onAt(r.seam)}>{seamName(order, r.seam)}</button>: {r.gap !== null ? <Num>{secAr(r.gap)}</Num> : null} — {r.over}</li>
        ))}</ul>
      ) : null}
      {onReassemble ? <button type="button" className={report.source === "legacy" ? "btn primary" : "btn"} disabled={pending} onClick={onReassemble}>{pending ? "جارٍ الدمج…" : "أعد الدمج"}</button> : null}
    </div>
  );
};
/** Mirrors SEAM_WINDOW_SEC (src/studio/seamChecks.ts): 3 s before and after the seam. */
const SEAM_WINDOW = 6;
const sceneNoOr = (order: string[], id?: string) => { const i = id ? order.indexOf(id) : -1; return i >= 0 ? String(i + 1) : "؟"; };
