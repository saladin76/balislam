import React, { useEffect, useRef, useState } from "react";
import type { ChannelSummary } from "../api";
import { StudioIcon, type StudioSection } from "../ui/StudioSidebar";
import { Icon } from "../ui/icons";
import { Num, arDigits } from "../ui/format";

/**
 * note: a short line under the item. alert: it needs the owner (unsaved changes, voice not connected): only an
 * alert lights the dot on the gear or the button (a description never does). quick: the item is also a button on
 * the band itself, beside the channels (owner decision 18 Nov, D156); on a phone it heads the gear menu instead.
 */
export type ManageItem = { id: StudioSection; label: string; note?: string; alert?: boolean; quick?: "monitor" | "sliders" | "palette" };
export type BandSteps = {
  /** The four steps from the ledger: done or not. */
  done: boolean[];
  /** The step on screen (the accent square). */
  here: number;
  /** One short line under the step on screen («٠ من ٣١»، «ينتظرك»…). */
  sub?: string;
};
type Props = {
  channels: ChannelSummary[];
  channelId: string;
  channelName: string;
  onChannel: (id: string) => void;
  onHome: () => void;
  /** Inside an episode: its number and title, and the four steps. */
  episode?: { id: string; title: string } | null;
  steps?: BandSteps | null;
  stepTitles: string[];
  onStep: (i: number) => void;
  /** The current series under the channel name (the episode's, or the series page's); opens its page. */
  series?: { id: string; name: string; kind: string } | null;
  onSeries?: (id: string) => void;
  /** Inside an episode: «غيّر السلسلة» opens the move dialog (D77). */
  onChangeSeries?: () => void;
  /** On the channel's episodes: how many, and one line under the number. */
  counter?: { n: number; label: string } | null;
  manage: ManageItem[];
  active: StudioSection;
  onManage: (id: StudioSection) => void;
};

/**
 * The channel band on the start edge (direction D): the channel's name in its title face, the episode,
 * the four steps as big numerals (✓ done, the accent square on the step on screen, a dot on the step that
 * waits for the owner), the channel switcher and the admin menu. It only navigates; it never decides.
 * On a phone it becomes the top bar with the four numerals (shell.css).
 */
export const Band: React.FC<Props> = (p) => {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const gear = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); gear.current?.focus(); } };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    [...(box.current?.querySelectorAll<HTMLButtonElement>("[role=menuitem], [role=menuitemradio]") ?? [])].find((x) => x.offsetParent !== null)?.focus();
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);
  const waiting = p.steps ? p.steps.done.findIndex((d) => !d) : -1;
  const quick = p.manage.filter((m) => m.quick);
  const attention = p.manage.some((m) => m.alert && !m.quick);
  return (
    <aside className="ms-band" aria-label="القناة وخطوات الحلقة">
      <button type="button" className="ms-mark" onClick={p.onHome} title="حلقات القناة" aria-label={`${p.channelName}: حلقات القناة`}>
        {p.channelName.split(/\s+/).filter(Boolean).map((w, i) => <span key={i}>{w}</span>)}
      </button>
      {p.series ? (
        <button type="button" className="ms-band-series" onClick={() => p.onSeries?.(p.series!.id)} title={`${p.series.kind}: ${p.series.name}`} aria-label={`${p.series.kind} ${p.series.name}`}>
          {p.series.kind}<b>{p.series.name}</b>
        </button>
      ) : null}
      {p.series && p.episode && p.onChangeSeries ? (
        <button type="button" className="ms-band-reseries" onClick={p.onChangeSeries} aria-label={`غيّر سلسلة الحلقة ${arDigits(p.episode.id.replace(/^0+(?=\d)/, ""))}`}>غيّر السلسلة</button>
      ) : null}
      {p.episode && p.steps ? (
        <>
          <div className="ms-band-ep">الحلقة <Num>{p.episode.id.replace(/^0+(?=\d)/, "")}</Num><b>{p.episode.title}</b></div>
          <ol className="ms-steps" aria-label="خطوات الحلقة">
            {p.stepTitles.map((title, i) => {
              const done = p.steps!.done[i];
              const here = i === p.steps!.here;
              return (
                <li key={title}>
                  <button type="button" className={`ms-stp${done ? " is-done" : ""}`} aria-current={here ? "step" : undefined} onClick={() => p.onStep(i)}
                    aria-label={`${arDigits(i + 1)} ${title}${done ? " (مكتملة)" : i === waiting ? " (تنتظرك)" : ""}`}>
                    {done ? <span className="ck" aria-hidden="true"><Icon name="check" /></span> : i === waiting && !here ? <span className="wait" aria-hidden="true" /> : null}
                    <span className="n" aria-hidden="true">{arDigits(i + 1)}</span>
                    <small aria-hidden="true">{title}</small>
                    {here && p.steps!.sub ? <span className="sub" aria-hidden="true"><Num>{p.steps!.sub}</Num></span> : null}
                  </button>
                </li>
              );
            })}
          </ol>
        </>
      ) : p.counter ? (
        <div className="ms-counter"><b><Num>{p.counter.n}</Num></b><span>{p.counter.label}</span></div>
      ) : null}
      <div className="ms-band-sp" />
      {p.channels.length > 1 ? (
        <nav className="ms-chs" aria-label="القناة">
          <span className="ms-chs-lb" aria-hidden="true">القناة</span>
          {p.channels.map((c) => (
            <button key={c.id} type="button" className="ms-ch" data-channel={c.id} aria-pressed={c.id === p.channelId} title={c.name} aria-label={c.name}
              onClick={() => p.onChannel(c.id)}>
              <span aria-hidden="true">{c.name.trim().charAt(0)}</span><i aria-hidden="true" />
            </button>
          ))}
        </nav>
      ) : null}
      {quick.length ? (
        <nav className="ms-quick" aria-label="أقسام القناة">
          {quick.map((m) => (
            <button key={m.id} type="button" className="ms-quick-it" aria-current={p.active === m.id ? "page" : undefined} title={m.alert && m.note ? `${m.label}: ${m.note}` : m.label}
              onClick={() => p.onManage(m.id)}>
              <StudioIcon name={m.quick!} /><small>{m.label}</small>{m.alert ? <span className="dot" aria-label={m.note ?? "يحتاجك"} /> : null}
            </button>
          ))}
        </nav>
      ) : null}
      <div className="ms-gear-wrap" ref={box}>
        <button ref={gear} type="button" className="ms-gear" aria-haspopup="menu" aria-expanded={open} aria-label="إدارة الاستوديو" title="إدارة الاستوديو" onClick={() => setOpen((v) => !v)}>
          <Icon name="gear" />{attention ? <span className="dot" aria-hidden="true" /> : null}
        </button>
        {open ? (
          <div className="ms-menu" role="menu" aria-label="إدارة الاستوديو">
            {/* On a phone the band has no room for the switcher: the channels head this menu instead (shell.css) */}
            {p.channels.length > 1 ? (
              <div className="ms-menu-chs" role="group" aria-label="القناة">
                <h2>القناة</h2>
                {p.channels.map((c) => (
                  <button key={c.id} role="menuitemradio" type="button" data-channel={c.id} aria-checked={c.id === p.channelId}
                    onClick={() => { setOpen(false); if (c.id !== p.channelId) p.onChannel(c.id); }}>
                    <span><i className="ms-menu-ch" aria-hidden="true">{c.name.trim().charAt(0)}</i>{c.name}</span>
                  </button>
                ))}
              </div>
            ) : null}
            {quick.length ? (
              <div className="ms-menu-quick" role="group" aria-label="أقسام القناة">
                {quick.map((m) => (
                  <button key={m.id} role="menuitem" type="button" aria-current={p.active === m.id ? "page" : undefined} onClick={() => { setOpen(false); p.onManage(m.id); }}>
                    <span>{m.label}</span>{m.note ? <small>{m.note}</small> : null}
                  </button>
                ))}
              </div>
            ) : null}
            <h2>إدارة الاستوديو</h2>
            {p.manage.filter((m) => !m.quick).map((m) => (
              <button key={m.id} role="menuitem" type="button" aria-current={p.active === m.id ? "page" : undefined}
                onClick={() => { setOpen(false); p.onManage(m.id); }}>
                <span>{m.label}</span>{m.note ? <small>{m.note}</small> : null}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </aside>
  );
};
