/**
 * «أعد نطق الكلمة» (D63/D66): the word popover anchored to its chip, the «why» popover when the word can't be cut
 * now, and the line under the sentence after a fix. Display only; the panel sends every command.
 */
import React, { useEffect, useMemo, useRef } from "react";
import type { SentenceRow } from "../../api";
import { dropsShadda, isNoopSay, phoneticVariants } from "../../../../src/voice/pronunciationRules";
import { useScrollLock } from "../../ui/scrollLock";
import { Icon } from "../../ui/icons";
import { Num } from "../../ui/format";
import { fixNeighbours, neighbourHint, sendPreview, sourceLabel, type WordFixDraft, type WordFixResult } from "./format";

/**
 * «أعد نطق الكلمة» (direction D): anchored to its chip with an arrow over a dimmed page (a bottom sheet on a phone):
 * the word big and where it is («الكلمة ٢ من ٩ في الجملة ٣»)، ▶ الكلمة، the sentence with the word highlighted and the
 * neighbours that are re-said with it underlined, the field, «احفظ هذا النطق للقناة», and under «المزيد» two
 * neighbours on each side; «أعد نطق الكلمة» first, «ولّد الجملة كاملة بهذا النطق» as the fallback.
 */
export const WordFixPopover: React.FC<{
  words: SentenceRow["words"]; rowNo: number; draft: WordFixDraft;
  busy: "fix" | "gen" | "other" | null; noKey: boolean; playing: boolean;
  pos?: { top: number; left: number; arrow: number; sheet: boolean } | null;
  popRef?: React.Ref<HTMLDivElement>;
  onDraft: (d: WordFixDraft) => void; onClose: () => void; onPlay: () => void; onFix: () => void; onWhole: () => void; onOpenSettings?: () => void;
  /** «ارجع للنطق الأصلي»: removes the owner's correction of this word in this sentence (no generation) */
  onUnfix?: () => void;
}> = ({ words, rowNo, draft: f, busy, noKey, playing, pos, popRef, onDraft, onClose, onPlay, onFix, onWhole, onOpenSettings, onUnfix }) => {
  const w = words[f.index]!;
  const nb = fixNeighbours(words.length, f.index, f.wide);
  const noop = isNoopSay(w.say, f.say);
  const variants = useMemo(() => phoneticVariants(w.say), [w.say]);
  const id = `fx-${rowNo}-${f.index}`;
  const box = useRef<HTMLDivElement | null>(null);
  const field = useRef<HTMLInputElement | null>(null);
  const placed = Boolean(pos);
  useScrollLock();
  // Keyboard (D52): the popover is measured hidden first, so `autoFocus` alone lands nowhere; once it is placed
  // the focus goes to the field, and the chip that opened it gets it back on close (the panel's onClose/Escape).
  useEffect(() => { if (placed) field.current?.focus({ preventScroll: true }); }, [placed, f.row, f.index]);
  const setBox = (el: HTMLDivElement | null) => {
    box.current = el;
    if (typeof popRef === "function") popRef(el); else if (popRef) (popRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
  };
  // aria-modal: Tab and Shift+Tab stay inside the popover
  const trap = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Tab" || !box.current) return;
    const all = [...box.current.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), summary, [tabindex]:not([tabindex='-1'])")].filter((x) => x.offsetParent !== null);
    if (!all.length) return;
    const first = all[0]!, last = all[all.length - 1]!;
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  return (
    <>
      <div className="ms-scrim" aria-hidden="true" onClick={onClose} />
      <div ref={setBox} className={`ms-pop sv-fix${pos?.sheet ? " is-sheet" : ""}`} role="dialog" aria-modal="true" aria-labelledby={id} onKeyDown={trap}
        style={pos && !pos.sheet ? { top: pos.top, left: pos.left, ["--ax" as string]: `${pos.arrow}px` } : pos ? undefined : { visibility: "hidden" }}>
        <div className="ms-pop-top">
          <strong className="ms-pop-big sv-fix-word" id={id}>{w.word}</strong>
          <span className="ms-pop-lbl"><b>الكلمة <Num>{`${f.index + 1} من ${words.length}`}</Num></b>في الجملة <Num>{rowNo}</Num></span>
          <button type="button" className="ms-pop-pw sv-play" disabled={w.start === null} onClick={onPlay}
            aria-label={playing ? "أوقف" : "اسمع الكلمة في التسجيل"}><Icon name={playing ? "stop" : "play"} />الكلمة</button>
          <button type="button" className="ms-pop-x sv-fix-x" aria-label="أغلق" onClick={onClose}><Icon name="x" /></button>
        </div>
        <p className="ms-pop-ctx" aria-label="الجملة">
          {words.map((x, i) => (
            <React.Fragment key={i}>{i ? " " : null}<span className={i === f.index ? "me" : nb.includes(i) ? "nb" : undefined}>{x.word}</span></React.Fragment>
          ))}
        </p>
        <label className="ms-pop-fl sv-fix-say">
          <span>اكتبها كما يجب أن تُنطق{" "}<small>يغيّر ما يُرسل إلى الصوت وحده؛ نص السكريبت والترجمة كما هما</small></span>
          <span className="ms-pop-inp">
            <input ref={field} dir="rtl" value={f.say} maxLength={80} autoFocus disabled={Boolean(busy)} onChange={(e) => onDraft({ ...f, say: e.target.value })} />
          </span>
          {/* D146: under the field, not inside its row (a long line there squeezed the input to nothing) */}
          {w.sent !== w.say ? <small className="sv-fix-now">النطق المستعمل حتى الآن «{w.sent}» — من: {sourceLabel(w.source)}</small> : null}
        </label>
        {w.correction !== null && onUnfix ? (
          <p className="ms-pop-hint sv-fix-unfix"><Icon name="undo" /><span>تصحيحك «{w.correction}» محفوظ لهذه الجملة.{" "}
            <button type="button" className="prep-link" disabled={Boolean(busy)} onClick={onUnfix}>ارجع للنطق الأصلي «{w.auto ?? w.sent}»</button>
            {" "}<small>(يُزال التصحيح بلا توليد؛ التسجيل الحالي كما هو)</small></span></p>
        ) : null}
        <p className="ms-pop-hint sv-fix-send" aria-live="polite"><Icon name="info" /><span>عند «أعد نطق الكلمة» يُرسل: «{noop ? sendPreview(w.word, w.auto ?? w.sent) : sendPreview(w.word, f.say)}»{noop ? " — النطق الأصلي للكلمة (يُزال أي تصحيح سابق لها)" : ""}</span></p>
        {variants.length ? (
          <div className="sv-fix-variants" role="group" aria-label="جرّب صيغة أخرى">
            <span>جرّب صيغة أخرى:</span>
            {variants.map((v) => (
              <button key={v} type="button" className="sv-t" disabled={Boolean(busy)} aria-pressed={f.say.trim() === v}
                onClick={() => onDraft({ ...f, say: v })}>{v}</button>
            ))}
          </div>
        ) : null}
        <p className="ms-pop-hint"><Icon name="info" /><span>{neighbourHint(words.map((x) => x.word), f.index, f.wide)}</span></p>
        <label className="ms-pop-chk sv-fix-check">
          <input type="checkbox" checked={f.save && !noop} disabled={Boolean(busy) || noop} onChange={(e) => onDraft({ ...f, save: e.target.checked })} />
          <span>احفظ هذا النطق للقناة{" "}<small>{noop ? "لا يُحفظ نطق مثل الكلمة تمامًا" : "يُستعمل في كل حلقة، للكلمة بتشكيلها هذا"}</small></span>
        </label>
        {f.save && !noop && dropsShadda(w.say, f.say) ? <p className="ms-pop-hint is-warn"><Icon name="warn" /><span>النطق يحذف الشدّة التي في «{w.say}»؛ تأكد أن هذا مقصود قبل حفظه للقناة.</span></p> : null}
        <details className="ms-pop-more" open={f.wide || undefined}>
          <summary>المزيد</summary>
          <label className="ms-pop-chk">
            <input type="checkbox" checked={f.wide} disabled={Boolean(busy)} onChange={(e) => onDraft({ ...f, wide: e.target.checked })} />
            <span>أعدها مع كلمتين من كل جانب{" "}<small>لوصل أنعم حين لا تكفي الجارتان؛ والتسجيل الحالي يبقى في «ارجع إلى التسجيل السابق».</small></span>
          </label>
        </details>
        {noKey ? <p className="ms-pop-hint is-warn"><Icon name="warn" /><span>إعادة النطق تحتاج مفتاح الصوت{onOpenSettings ? <> من <button type="button" className="prep-link" onClick={onOpenSettings}>الاتصالات والمفاتيح</button></> : " من الإعدادات"}.</span></p> : null}
        <div className="ms-pop-acts">
          <button type="button" className="ms-pop-go" disabled={Boolean(busy) || noKey || !f.say.trim()} title={noKey ? "يتطلب مفتاح الصوت من «الاتصالات والمفاتيح»" : ""} onClick={onFix}>
            <Icon name="regen" />{busy === "fix" ? "جارٍ إعادة النطق…" : "أعد نطق الكلمة"}
          </button>
          <button type="button" className="ms-pop-alt" disabled={Boolean(busy) || noKey || !f.say.trim()} onClick={onWhole}>{busy === "gen" ? "جارٍ التوليد…" : "ولّد الجملة كاملة بهذا النطق"}</button>
        </div>
      </div>
    </>
  );
};

/**
 * The word can't be cut now (D63): the word, one line why («لا توجد أوقات دقيقة لكلمات هذا المشهد»), the primary
 * «ولّد هذه الجملة ثم صحّح الكلمة» (the fix popover then opens on the same word by itself), and «إلغاء».
 */
export const WordWhyPopover: React.FC<{
  word: string; index: number; count: number; rowNo: number; reason: string; blocked: string | null;
  busy: "gen" | "other" | null; pos?: { top: number; left: number; arrow: number; sheet: boolean } | null;
  popRef?: React.Ref<HTMLDivElement>; onClose: () => void; onGenerate: () => void; onOpenSettings?: () => void;
  /** D146: the owner's correction of this word in this sentence, removable here too (no take needs cutting for it) */
  correction?: { say: string; auto: string } | null; onUnfix?: () => void;
}> = ({ word, index, count, rowNo, reason, blocked, busy, pos, popRef, onClose, onGenerate, onOpenSettings, correction, onUnfix }) => {
  const id = `fw-${rowNo}-${index}`;
  const go = useRef<HTMLButtonElement | null>(null);
  const cancel = useRef<HTMLButtonElement | null>(null);
  const placed = Boolean(pos);
  useScrollLock();
  useEffect(() => { if (placed) (go.current && !go.current.disabled ? go.current : cancel.current)?.focus({ preventScroll: true }); }, [placed, rowNo, index]);
  return (
    <>
      <div className="ms-scrim" aria-hidden="true" onClick={onClose} />
      <div ref={popRef} className={`ms-pop sv-fix sv-why-pop${pos?.sheet ? " is-sheet" : ""}`} role="dialog" aria-modal="true" aria-labelledby={id}
        style={pos && !pos.sheet ? { top: pos.top, left: pos.left, ["--ax" as string]: `${pos.arrow}px` } : pos ? undefined : { visibility: "hidden" }}>
        <div className="ms-pop-top">
          <strong className="ms-pop-big sv-fix-word" id={id}>{word}</strong>
          <span className="ms-pop-lbl"><b>الكلمة <Num>{`${index + 1} من ${count}`}</Num></b>في الجملة <Num>{rowNo}</Num></span>
          <button type="button" className="ms-pop-x sv-fix-x" aria-label="أغلق" onClick={onClose}><Icon name="x" /></button>
        </div>
        <p className="ms-pop-hint is-warn sv-why-line"><Icon name="info" /><span>{reason}</span></p>
        {correction && onUnfix ? (
          <p className="ms-pop-hint sv-fix-unfix"><Icon name="undo" /><span>تصحيحك «{correction.say}» محفوظ لهذه الجملة.{" "}
            <button type="button" className="prep-link" disabled={Boolean(busy)} onClick={onUnfix}>ارجع للنطق الأصلي «{correction.auto}»</button>
            {" "}<small>(يُزال التصحيح بلا توليد)</small></span></p>
        ) : null}
        {blocked ? <p className="ms-pop-hint"><Icon name="warn" /><span>{blocked}{onOpenSettings ? <> — <button type="button" className="prep-link" onClick={onOpenSettings}>الاتصالات والمفاتيح</button></> : null}</span></p> : null}
        <div className="ms-pop-acts">
          <button ref={go} type="button" className="ms-pop-go" disabled={Boolean(busy) || Boolean(blocked)} onClick={onGenerate}>
            <Icon name="regen" />{busy === "gen" ? "جارٍ توليد الجملة…" : "ولّد هذه الجملة ثم صحّح الكلمة"}
          </button>
          <button ref={cancel} type="button" className="ms-pop-alt" disabled={busy === "gen"} onClick={onClose}>إلغاء</button>
        </div>
      </div>
    </>
  );
};

/** The line under the sentence after a word fix: success («مُصحَّحة» with listen and undo) or failure (what to try). */
export const WordFixLine: React.FC<{
  fixed: WordFixResult; busy: "restore" | "gen" | "other" | null; noKey: boolean; canListen: boolean; canUndo: boolean;
  onListen: () => void; onUndo: () => void; onRetry: () => void; onWhole: () => void;
}> = ({ fixed, busy, noKey, canListen, canUndo, onListen, onUndo, onRetry, onWhole }) => fixed.result.ok ? (
  <div className="sv-fixln" role="status">
    <b className="sv-okl">مُصحَّحة</b>
    <span>نُطقت:</span>
    <span className="sv-wd"><s>{fixed.before}</s> <span aria-hidden="true">←</span> {fixed.say}</span>
    {canListen ? <button type="button" className="sv-t" onClick={onListen}><Icon name="play" />استمع للجملة</button> : null}
    {canUndo ? <button type="button" className="sv-t" disabled={Boolean(busy)} onClick={onUndo}><Icon name="undo" />{busy === "restore" ? "جارٍ…" : "تراجع"}</button> : null}
    {fixed.save ? <span className="sv-sv">حُفظ النطق للقناة</span> : null}
  </div>
) : (
  <div className="sv-fixln is-bad sv-fix-fail" role="alert">
    <span className="sv-ic"><Icon name="warn" /></span>
    <div>
      <b>لم يندمج بشكل طبيعي — جرّب نطقًا آخر أو ولّد الجملة</b>
      {fixed.result.reasons.length ? <ul>{fixed.result.reasons.map((x) => <li key={x}>{x}</li>)}</ul> : null}
    </div>
    <button type="button" className="sv-t" disabled={Boolean(busy)} onClick={onRetry}>جرّب نطقًا آخر</button>
    <button type="button" className="sv-t" disabled={Boolean(busy) || noKey} onClick={onWhole}><Icon name="regen" />{busy === "gen" ? "جارٍ التوليد…" : "ولّد الجملة"}</button>
  </div>
);
