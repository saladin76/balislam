import React, { useEffect, useRef, useState } from "react";
import type { ChannelSummary, EpisodeSummary } from "../api";
import type { StudioSection } from "../ui/StudioSidebar";
import { arDigits } from "../ui/format";

export type ManageItem = { id: StudioSection; label: string; note?: string };

type Props = {
  channels: ChannelSummary[]; channelId: string; onChannel: (id: string) => void;
  episodes: EpisodeSummary[] | null; episodeId: string; inEpisode: boolean; onEpisode: (id: string) => void;
  onHome: () => void; atHome: boolean;
  manage: ManageItem[]; active: StudioSection; onManage: (id: StudioSection) => void;
};

/**
 * الشريط العلوي: القنوات الثلاث بأسمائها (القناة النشطة تلوّن الاستوديو بلونها)، ثم الحلقة،
 * ثم قائمة الإدارة. لا قائمة جانبية: الحلقة هي مكان العمل.
 */
export const TopBar: React.FC<Props> = (p) => {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);
  return (
    <header className="tb">
      <div className="tb-brand">الاستوديو</div>
      <nav className="tb-channels" aria-label="القناة">
        {p.channels.map((c) => (
          <button key={c.id} type="button" data-ch={c.id} className="tb-ch" aria-pressed={c.id === p.channelId} onClick={() => p.onChannel(c.id)}>
            <i aria-hidden="true" /><span className="tb-ch-name">{c.name}</span>
          </button>
        ))}
      </nav>
      <div className="tb-episode">
        <button type="button" className="tb-link" aria-current={p.atHome ? "page" : undefined} onClick={p.onHome}>حلقات القناة</button>
        {p.inEpisode && p.episodes?.length ? (
          <select id="episode-select" aria-label="الحلقة" value={p.episodeId} onChange={(e) => p.onEpisode(e.target.value)}>
            {p.episodes.map((e) => <option key={e.id} value={e.id}>{arDigits(e.id)} — {e.title || e.dir}</option>)}
          </select>
        ) : null}
      </div>
      <div className="tb-tools">
        <div className="tb-manage" ref={box}>
          <button type="button" className="tb-manage-btn" aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((v) => !v)}>إدارة</button>
          {open ? (
            <div className="tb-menu" role="menu">
              {p.manage.map((m) => (
                <button key={m.id} role="menuitem" type="button" aria-current={p.active === m.id ? "page" : undefined}
                  onClick={() => { setOpen(false); p.onManage(m.id); }}>
                  <span>{m.label}</span>{m.note ? <small>{m.note}</small> : null}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
};
