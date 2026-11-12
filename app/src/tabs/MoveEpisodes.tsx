import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, type EpisodeMoveResult, type MoveEpisodesResult, type SeriesRead } from "../api";
import { EPISODES, arabicCountAr } from "../../../src/i18n/count";
import { SERIES_KIND_AR } from "../../../src/channel/series";
import { arDigits } from "../ui/format";
import { Dialog } from "../ui/Dialog";
import { Icon } from "../ui/icons";
import { moveTargetRows, selectionLabel } from "./seriesView";
import { OwnerText } from "../ui/OwnerText";

/**
 * Moving existing episodes between series and categories (owner request, 11 Nov, D77): one dialog (a tree of
 * the channel's series with their swatches, the current one marked, a search), one server call for one or
 * many episodes, and a toast with «تراجع». A move writes the episode's series file and plan stamp only:
 * script.md, its scenes and its approvals are never touched (D71).
 */

const epNo = (id: string) => arDigits(id.replace(/^0+(?=\d)/, ""));

/** «نُقلت ٣ حلقات إلى «…»» (with what could not move, by number and reason). */
export const movedLine = (r: Pick<MoveEpisodesResult, "results" | "to">): string => {
  const moved = r.results.filter((x) => x.ok && !x.unchanged).length;
  const failed = r.results.filter((x) => !x.ok);
  const head = moved ? `نُقلت ${arabicCountAr(moved, EPISODES)} إلى «${r.to.name}»` : failed.length ? "لم تُنقل أي حلقة" : `الحلقات في «${r.to.name}» من قبل`;
  const tail = failed.map((x) => `الحلقة ${epNo(x.episode)}: ${x.error ?? "تعذّر نقلها"}`).join("؛ ");
  return tail ? `${head}. ${tail}` : `${head}.`;
};

/** «أُعيدت ٣ حلقات إلى سلاسلها السابقة» after «تراجع». */
export const undoneLine = (results: EpisodeMoveResult[]): string => {
  const ok = results.filter((x) => x.ok).length;
  const notes = results.filter((x) => !x.ok || x.note).map((x) => `الحلقة ${epNo(x.episode)}: ${x.error ?? x.note}`).join("؛ ");
  const head = ok ? `أُعيدت ${arabicCountAr(ok, EPISODES)} إلى ${ok === 1 ? "سلسلتها السابقة" : "سلاسلها السابقة"}` : "لم يُتراجع عن شيء";
  return notes ? `${head}. ${notes}` : `${head}.`;
};

export const MoveEpisodesDialog: React.FC<{
  episodes: string[];
  /** The series all of them share, marked «الحالية» (none when they differ). */
  current?: string;
  data: SeriesRead;
  onClose: () => void;
  onPick: (to: string) => Promise<void> | void;
  /** Start with this search (tests and the «عام» card's shortcut). */
  initialQuery?: string;
}> = ({ episodes, current, data, onClose, onPick, initialQuery = "" }) => {
  const [q, setQ] = useState(initialQuery);
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const rows = useMemo(() => moveTargetRows(data.series, q, current), [data.series, q, current]);
  const list = useRef<HTMLDivElement>(null);
  const title = episodes.length === 1 ? `انقل الحلقة ${epNo(episodes[0]!)}` : `انقل ${arabicCountAr(episodes.length, EPISODES)}`;
  const choose = (i: number) => {
    const r = rows[Math.max(0, Math.min(rows.length - 1, i))];
    if (!r) return;
    setTo(r.id);
    list.current?.querySelector<HTMLButtonElement>(`[data-target="${r.id}"]`)?.focus();
  };
  return (
    <Dialog as="form" labelledBy="mv-eps-h" width={520} onClose={() => { if (!busy) onClose(); }} onSubmit={async (e) => {
      e.preventDefault();
      if (busy || !to || to === current) return;
      setBusy(true); setErr("");
      try { await onPick(to); } catch (x) { setErr((x as Error).message); setBusy(false); }
    }}>
      <div className="modal-head"><h3 id="mv-eps-h">{title} إلى…</h3></div>
      <div className="modal-body sr-form mv-form">
        <input type="search" className="mv-search" aria-label="ابحث عن سلسلة أو تصنيف" placeholder="ابحث عن سلسلة أو تصنيف" value={q} onChange={(e) => setQ(e.target.value)} autoFocus
          onKeyDown={(e) => { if (e.key === "ArrowDown") { e.preventDefault(); choose(Math.max(0, rows.findIndex((r) => r.id === to) + 1)); } }} />
        <div className="mv-tree" role="radiogroup" aria-label="السلاسل والتصنيفات" ref={list}
          onKeyDown={(e) => {
            const i = rows.findIndex((r) => r.id === to);
            if (e.key === "ArrowDown") { e.preventDefault(); choose(i + 1); }
            else if (e.key === "ArrowUp") { e.preventDefault(); choose(i - 1); }
          }}>
          {rows.length === 0 ? <p className="help mv-none">لا سلسلة بهذا الاسم.</p> : rows.map((r) => (
            <button key={r.id} type="button" role="radio" aria-checked={to === r.id} data-target={r.id} data-depth={r.depth}
              className={`mv-row${r.current ? " is-current" : ""}${r.match ? "" : " is-context"}`} style={{ paddingInlineStart: 12 + r.depth * 22 }}
              tabIndex={to ? (to === r.id ? 0 : -1) : r === rows[0] ? 0 : -1}
              aria-label={`${SERIES_KIND_AR[r.kind]} ${r.path}${r.current ? " (الحالية)" : ""}`} onClick={() => setTo(r.id)} onDoubleClick={() => { if (!r.current) { setTo(r.id); void (async () => { setBusy(true); try { await onPick(r.id); } catch (x) { setErr((x as Error).message); setBusy(false); } })(); } }}>
              <i className="mv-sw" style={r.accent ? { background: r.accent } : undefined} aria-hidden="true" />
              <span className="mv-name"><b>{r.name}</b><small>{SERIES_KIND_AR[r.kind]}</small></span>
              {r.current ? <span className="mv-cur">الحالية</span> : null}
            </button>
          ))}
        </div>
        <p className="help">{(data.series.find((s) => s.id === to)?.kind ?? "series") === "category"
          ? "تُختم الحلقة بهوية التصنيف وقالبه الآن؛ التصنيف بلا ترتيب فلا تأخذ رقمًا فيه. السكريبت ومشاهده واعتماداته لا تُلمس."
          : "تُختم الحلقة بهوية السلسلة الجديدة وقالبها الآن، وتأخذ الرقم التالي فيها. السكريبت ومشاهده واعتماداته لا تُلمس."}</p>
        {err ? <p className="help" style={{ color: "var(--err)" }} role="alert"><OwnerText text={err} /></p> : null}
        <div className="sr-dialog-acts">
          <button type="submit" className="btn primary" disabled={!to || to === current} aria-busy={busy}>{busy ? "جارٍ النقل…" : to && to !== current ? `انقل إلى «${rows.find((r) => r.id === to)?.name ?? data.series.find((s) => s.id === to)?.name ?? ""}»` : "اختر سلسلة"}</button>
          <button type="button" className="btn" onClick={onClose} disabled={busy}>إلغاء</button>
        </div>
      </div>
    </Dialog>
  );
};

export type MoveToastState = { line: string; token?: string | null; err?: boolean };

/** The toast after a move: the line, and «تراجع» while the server holds the undo. */
export const MoveToast: React.FC<{ toast: MoveToastState; onUndo: () => void; onClose: () => void }> = ({ toast, onUndo, onClose }) => {
  useEffect(() => {
    const t = window.setTimeout(onClose, toast.token ? 12_000 : 6_000);
    return () => window.clearTimeout(t);
  }, [toast, onClose]);
  return (
    <div className={`mv-toast${toast.err ? " is-err" : ""}`} role="status" aria-live="polite">
      <span>{toast.line}</span>
      {toast.token ? <button type="button" className="mv-undo" onClick={onUndo}>تراجع</button> : null}
      <button type="button" className="mv-x" aria-label="أغلق" onClick={onClose}>×</button>
    </div>
  );
};

/**
 * One mover for every place that moves episodes (the channel home, a series page, an episode's band):
 * `move(to, ids)` calls the server once, then `onChanged` reloads, then the toast offers «تراجع».
 */
export const useEpisodeMover = (onChanged: () => Promise<void> | void) => {
  const [toast, setToast] = useState<MoveToastState | null>(null);
  const changed = useRef(onChanged);
  changed.current = onChanged;
  const move = useCallback(async (to: string, ids: string[]) => {
    const r = await api.moveEpisodes(to, ids);
    await changed.current();
    setToast({ line: movedLine(r), token: r.undo, err: !r.ok });
    return r;
  }, []);
  const undo = useCallback(async () => {
    const token = toast?.token;
    if (!token) return;
    setToast({ line: "جارٍ التراجع…" });
    try {
      const r = await api.undoMoveEpisodes(token);
      await changed.current();
      setToast({ line: undoneLine(r.results), err: !r.ok });
    } catch (x) { setToast({ line: (x as Error).message, err: true }); }
  }, [toast]);
  const close = useCallback(() => setToast(null), []);
  const node = toast ? <MoveToast toast={toast} onUndo={() => void undo()} onClose={close} /> : null;
  return { move, undo, toast, node, setToast };
};

/** The row's visible «انقل إلى…» (not hidden in «⋯» alone). */
export const RowMoveButton: React.FC<{ episode: string; onMove: () => void }> = ({ episode, onMove }) => (
  <button type="button" className="ledger-move" aria-label={`انقل الحلقة ${epNo(episode)} إلى سلسلة أو تصنيف`} onClick={onMove}><Icon name="move" />انقل إلى…</button>
);

/** The dock while episodes are selected: «انقل المحدّد (٣)» (the one filled button) and «ألغِ التحديد». */
export const SelectionDock: React.FC<{ count: number; onMove: () => void; onClear: () => void }> = ({ count, onMove, onClear }) => (
  <>
    <button className="btn primary" type="button" onClick={onMove}><Icon name="move" />{selectionLabel(count)}</button>
    <button className="btn" type="button" onClick={onClear}>ألغِ التحديد</button>
  </>
);
