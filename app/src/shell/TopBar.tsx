import React from "react";
import type { EpisodeSummary } from "../api";
import { Icon } from "../ui/icons";
import { Num, arDigits } from "../ui/format";

export type { ManageItem } from "./Band";
/** One view inside the current step («مشهدًا مشهدًا»، «الوصلات»…), shown in the floating pill. */
export type HeaderView = { id: string; label: string; sub?: string; badge?: number; current: boolean; onSelect: () => void };

type Props = {
  /** Inside an episode: the picker; elsewhere a plain title. */
  episodes?: EpisodeSummary[] | null;
  episodeId?: string;
  onEpisode?: (id: string) => void;
  title?: string;
  views: HeaderView[];
  /** The episode's save state (plan autosave and unsaved script). */
  save?: { state: "saved" | "dirty" | "saving" | "error"; unsaved: boolean } | null;
  scheme: "light" | "dark";
  onToggleScheme: () => void;
};

/**
 * The header over the paper (direction D): the episode on the start side, the floating pill of the views
 * inside the current step in the middle, and on the end side the save state and the light/dark toggle.
 * Navigation only: it never saves or approves. There is no owner session (D54).
 */
export const TopBar: React.FC<Props> = (p) => {
  const saveLabel = !p.save ? "" : p.save.state === "error" ? "تعذّر الحفظ" : p.save.state === "saving" ? "جارٍ الحفظ…"
    : p.save.unsaved || p.save.state === "dirty" ? "تعديلات غير محفوظة" : "محفوظ";
  return (
    <header className="ms-hdr">
      <div className="ms-who">
        {p.episodes?.length && p.episodeId && p.onEpisode ? (
          <label className="ms-ep-pick">
            <span className="ms-vh">الحلقة</span>
            <select id="episode-select" value={p.episodeId} onChange={(e) => p.onEpisode!(e.target.value)}>
              {p.episodes.map((e) => <option key={e.id} value={e.id}>الحلقة {arDigits(e.id.replace(/^0+(?=\d)/, ""))} · {e.title || e.dir}</option>)}
            </select>
            <Icon name="down" />
          </label>
        ) : <span className="ms-who-home">{p.title ?? "الاستوديو"}</span>}
      </div>
      {p.views.length ? (
        <nav className="ms-pill" aria-label="عرض الخطوة">
          {p.views.map((v) => (
            <button key={v.id} type="button" aria-current={v.current ? "page" : undefined} onClick={v.onSelect}>
              {v.label}
              {v.sub ? <small><Num>{v.sub}</Num></small> : null}
              {v.badge !== undefined ? <span className="bd" aria-label={`${arDigits(v.badge)} مشهدًا`}><Num>{v.badge}</Num></span> : null}
            </button>
          ))}
        </nav>
      ) : <span />}
      <div className="ms-me">
        {saveLabel ? <span className={`ms-save${p.save!.state === "error" ? " is-err" : saveLabel !== "محفوظ" ? " is-dirty" : ""}`} role="status">{saveLabel}</span> : null}
        <button type="button" className="ms-ibtn" onClick={p.onToggleScheme} aria-pressed={p.scheme === "dark"}
          aria-label={p.scheme === "dark" ? "الوضع النهاري" : "الوضع الليلي"} title={p.scheme === "dark" ? "الوضع النهاري" : "الوضع الليلي"}>
          <Icon name={p.scheme === "dark" ? "sun" : "moon"} />
        </button>
      </div>
    </header>
  );
};
