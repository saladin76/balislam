import React, { useMemo, useRef, useState } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import { Providers } from "../../../src/remotion/Providers";
import { sceneCatalog } from "../../../src/remotion/scenes/catalog";
import { templateById } from "../../../src/plan/templates";
import { familyNamesAr, templateMeta, templateSuits, type TemplateFamily } from "../../../src/plan/templateMeta";
import { SetBackdrop, sets } from "../../../brand/sets/index";
import type { Identity } from "../../../brand/identity/index";
import type { ChannelInfo } from "../../../src/channel/types";
import type { ChannelSummary } from "../api";
import config from "../../../config.json";

const fps = config.video.fps;

/** معاينة قالب: لقطة ثابتة، وتتحرك عند المرور عليها. */
const TemplatePreview: React.FC<{ entry: (typeof sceneCatalog)[number]; identity?: Identity; channel?: ChannelInfo }> = ({ entry, identity, channel }) => {
  const ref = useRef<PlayerRef>(null);
  const frames = Math.round(entry.seconds * fps);
  const Comp = useMemo(() => {
    const C: React.FC<Record<string, unknown>> = (p) => (
      <Providers identity={identity} channel={channel}>
        <entry.component {...p} />
      </Providers>
    );
    return C;
  }, [entry, identity, channel]);
  return (
    <div
      className="tpl-prev"
      onMouseEnter={() => ref.current?.play()}
      onMouseLeave={() => {
        ref.current?.pause();
        ref.current?.seekTo(Math.round(frames * 0.6));
      }}
    >
      <Player
        ref={ref}
        component={Comp}
        inputProps={{ ...entry.sample, themeId: "paper", orientation: "landscape" }}
        durationInFrames={frames}
        fps={fps}
        compositionWidth={config.video.episode.width}
        compositionHeight={config.video.episode.height}
        initialFrame={Math.round(frames * 0.6)}
        style={{ width: "100%", height: "100%" }}
        loop
        acknowledgeRemotionLicense
      />
    </div>
  );
};

/** معرض القوالب: معاينة حية لكل قالب، وعائلته، والقنوات التي يناسبها. */
export const TemplatesGallery: React.FC<{ identity?: Identity; channel?: ChannelInfo; channels: ChannelSummary[] }> = ({ identity, channel, channels }) => {
  const [family, setFamily] = useState<TemplateFamily | "all">("all");
  const [forChannel, setForChannel] = useState<string>("all");
  const items = sceneCatalog.filter((e) => (family === "all" || templateMeta[e.id]?.family === family) && (forChannel === "all" || templateSuits(e.id, forChannel)));
  return (
    <>
      <div className="toolbar">
        <div className="cat-row">
          <button aria-pressed={family === "all"} onClick={() => setFamily("all")}>كل العائلات</button>
          {(Object.keys(familyNamesAr) as TemplateFamily[]).map((f) => (
            <button key={f} aria-pressed={family === f} onClick={() => setFamily(f)}>{familyNamesAr[f]}</button>
          ))}
        </div>
        <span className="spacer" />
        <select value={forChannel} onChange={(e) => setForChannel(e.target.value)} style={{ width: 200 }} aria-label="القناة">
          <option value="all">لكل القنوات</option>
          {channels.map((c) => <option key={c.id} value={c.id}>يناسب {c.name}</option>)}
        </select>
      </div>
      <p className="help">مرّر الفأرة على القالب لتشاهده يتحرك. نوّع بين العائلات في الحلقة الواحدة، ولا تبنِ حلقتين متتاليتين على القالب الأساسي نفسه.</p>
      <div className="tpl-grid">
        {items.map((e) => {
          const def = templateById(e.id);
          const meta = templateMeta[e.id];
          return (
            <article key={e.id} className="tpl-card">
              <TemplatePreview entry={e} identity={identity} channel={channel} />
              <div className="tpl-info">
                <div className="tpl-head">
                  <b>{def?.nameAr ?? e.id}</b>
                  {meta ? <span className="chip">{familyNamesAr[meta.family]}</span> : null}
                </div>
                <span className="help">{def?.useAr}</span>
                <div className="tpl-ch">
                  {channels.map((c) => (
                    <span key={c.id} className={`tpl-dot ${templateSuits(e.id, c.id) ? "on" : "off"}`}>{templateSuits(e.id, c.id) ? "✓" : "✕"} {c.name}</span>
                  ))}
                </div>
                <code className="help" style={{ direction: "ltr" }}>[مشهد: {e.id}]</code>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
};

/** أماكن التصوير: كل مكان مرسوم كاملًا، يُستعمل في قالب «مشهد في مكان». */
export const SetsGallery: React.FC = () => (
  <>
    <p className="help">أماكن مرسومة كاملة تتحرك فيها الإضاءة والبخار والنجوم. استعملها من قالب «مشهد في مكان» واختر المكان. غيّر المكان بين الحلقات ليبقى المحتوى متنوعًا.</p>
    <div className="tpl-grid">
      {sets.map((s) => (
        <article key={s.id} className="tpl-card">
          <svg viewBox="0 0 1920 1080" style={{ width: "100%", display: "block", borderRadius: 10 }}>
            <SetBackdrop id={s.id} t={1.2} />
          </svg>
          <div className="tpl-info">
            <div className="tpl-head">
              <b>{s.nameAr}</b>
              <span className="chip">{s.mood === "night" ? "ليلي" : "نهاري"}</span>
            </div>
            <span className="help">{s.tags.join(" · ")}</span>
            <code className="help" style={{ direction: "ltr" }}>[مشهد: set-scene | set={s.id}]</code>
          </div>
        </article>
      ))}
    </div>
  </>
);
