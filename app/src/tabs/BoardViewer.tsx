import React, { useEffect } from "react";
import type { PlanScene } from "../../../src/plan/types";
import type { ReviewItem } from "../api";
import { Dialog } from "../ui/Dialog";
import { duration, num, sceneName, verseRef } from "../ui/format";

export type BoardShot = { s: PlanScene; chapter: { number: number; title: string }; from: number; d: number };

const CITATION: Record<ReviewItem["status"], string> = { pending: "بانتظار التوثيق", changed: "تغيّر بعد التوثيق", verified: "موثّق", rejected: "مرفوض" };

/**
 * One storyboard board, read inside step ١ (UX review 9 Nov, D52): its image, the narration, what is on
 * screen, its citations and notes. ← / → (and the buttons) move between boards, Esc closes. «تحرير المشهد»
 * is secondary and stays in step ١: it opens the scene's own line in the script, never the scene editor
 * of step ٢ (the scenes do not exist before «اعتمد التجهيز»).
 */
export const BoardViewer: React.FC<{
  shots: BoardShot[];
  index: number;
  order: string[];
  fps: number;
  citations: ReviewItem[] | null;
  /** The scene's line range in the script, to match its citations. */
  lineEnd: (i: number) => number;
  onIndex: (i: number) => void;
  onClose: () => void;
  onEdit: (line: number, sceneId: string) => void;
  frame: (shot: BoardShot) => React.ReactNode;
  onScreen: (s: PlanScene) => string;
  elements: (s: PlanScene) => string[];
  state?: "approved" | "changed" | string;
}> = ({ shots, index, order, fps, citations, lineEnd, onIndex, onClose, onEdit, frame, onScreen, elements, state }) => {
  const shot = shots[index]!;
  const { s } = shot;
  const prev = index > 0 ? index - 1 : null;
  const next = index < shots.length - 1 ? index + 1 : null;
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      // RTL: ← is forward (the next board), → is back.
      if (e.key === "ArrowLeft" && next !== null) { e.preventDefault(); onIndex(next); }
      if (e.key === "ArrowRight" && prev !== null) { e.preventDefault(); onIndex(prev); }
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [prev, next, onIndex]);
  const mine = (citations ?? []).filter((c) => c.line >= s.line && c.line < lineEnd(index));
  const text = onScreen(s);
  const els = elements(s);
  return (
    <Dialog labelledBy="board-title" onClose={onClose} width={1080}>
      <div className="bv">
        <header className="bv-head">
          <div>
            <p className="bv-eyebrow">الفصل {num(shot.chapter.number)} · {shot.chapter.title}</p>
            <h3 id="board-title" title={s.id}>{sceneName(order, s.id)} <span className="bv-of">من {num(shots.length)}</span></h3>
          </div>
          <span className="bv-time">{duration(shot.from / fps)} · {num(shot.d / fps, 1)} ث</span>
          {state === "approved" ? <span className="s12-mark ok">معتمد</span> : state === "changed" ? <span className="s12-mark warn">تغيّر بعد الاعتماد</span> : null}
          <button type="button" className="bv-close" aria-label="إغلاق" onClick={onClose}>×</button>
        </header>
        <div className="bv-body">
          <div className="bv-frame">{frame(shot)}</div>
          <div className="bv-side">
            <section>
              <h4>التعليق</h4>
              <p className="bv-said">{s.narration || (s.template === "verse-card" ? "آية بلا تعليق: تُتلى بصوت القارئ." : "بلا تعليق صوتي")}</p>
            </section>
            {s.template === "verse-card" && (s.ayahKey || s.props.reference) ? (
              <section><h4>الآية</h4><p>{verseRef(s.ayahKey ?? s.props.reference)}</p></section>
            ) : null}
            {text ? <section><h4>على الشاشة</h4><p>{text}</p></section> : null}
            {els.length ? <section><h4>العناصر</h4><p>{els.join("، ")}</p></section> : null}
            <section>
              <h4>التوثيق والملاحظات</h4>
              {citations === null ? <p className="bv-soft">جارٍ التحميل…</p> : mine.length ? (
                <ul className="bv-cites">
                  {mine.map((c) => (
                    <li key={c.key}><b>{c.kind === "ayah" ? verseRef(c.ref) : `${c.label} ${c.ref}`}</b> <span className={`bv-cite is-${c.status}`}>{CITATION[c.status]}</span>{c.note ? <span className="bv-soft"> — {c.note}</span> : null}</li>
                  ))}
                </ul>
              ) : <p className="bv-soft">لا استشهاد في هذا المشهد.</p>}
            </section>
          </div>
        </div>
        <footer className="bv-foot">
          <button type="button" className="btn" disabled={prev === null} onClick={() => prev !== null && onIndex(prev)}>→ السابق</button>
          <button type="button" className="btn" disabled={next === null} onClick={() => next !== null && onIndex(next)}>التالي ←</button>
          <span className="spacer" />
          <button type="button" className="btn ghost" title="يفتح سطر المشهد في السكريبت (الخطوة ١)" onClick={() => onEdit(s.line, s.id)}>تحرير المشهد</button>
        </footer>
      </div>
    </Dialog>
  );
};
