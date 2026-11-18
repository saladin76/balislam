import React, { useMemo, useRef, useState } from "react";
import { sampleForChannel } from "../../../src/remotion/scenes/channelSamples";
import { Player, type PlayerRef } from "@remotion/player";
import { Providers } from "../../../src/remotion/Providers";
import { sceneCatalog } from "../../../src/remotion/scenes/catalog";
import { templateById } from "../../../src/plan/templates";
import { familyNamesAr, templateMeta, type TemplateFamily } from "../../../src/plan/templateMeta";
import { SetBackdrop, sets } from "../../../brand/sets/index";
import type { Identity } from "../../../brand/identity/index";
import type { ChannelInfo } from "../../../src/channel/types";
import config from "../../../config.json";
const arDigitsLib = (s: string) => s.replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)]!);

const fps = config.video.fps;

/** معاينة قالب: لقطة ثابتة، وتتحرك عند المرور عليها. */
const TemplatePreview: React.FC<{ entry: (typeof sceneCatalog)[number]; identity?: Identity; channel?: ChannelInfo }> = ({ entry, identity, channel }) => {
  const ref = useRef<PlayerRef>(null);
  const [playing, setPlaying] = useState(false);
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
      onMouseEnter={() => { if (window.matchMedia("(hover: hover)").matches) { ref.current?.play(); setPlaying(true); } }}
      onMouseLeave={() => {
        ref.current?.pause(); setPlaying(false);
        ref.current?.seekTo(Math.round(frames * 0.6));
      }}
    >
      <Player
        ref={ref}
        component={Comp}
        inputProps={{ ...sampleForChannel(channel?.id, entry.id, entry.sample), themeId: "paper", orientation: "landscape" }}
        durationInFrames={frames}
        fps={fps}
        compositionWidth={config.video.episode.width}
        compositionHeight={config.video.episode.height}
        initialFrame={Math.round(frames * 0.6)}
        style={{ width: "100%", height: "100%" }}
        loop
        acknowledgeRemotionLicense
      />
      <button type="button" className="tpl-preview-toggle" aria-pressed={playing} onClick={() => { if (playing) ref.current?.pause(); else ref.current?.play(); setPlaying(!playing); }}>{playing ? "أوقف المثال" : "شاهد مثالًا"}</button>
    </div>
  );
};

/** معرض القوالب: معاينة حية لكل قالب، وعائلته، والقنوات التي يناسبها. */
/** قوالب القناة الحالية فقط، بهويتها */
export const TemplatesGallery: React.FC<{ identity?: Identity; channel?: ChannelInfo; allowed: string[] }> = ({ identity, channel, allowed }) => {
  const [family, setFamily] = useState<TemplateFamily | "all">("all");
  const mine = sceneCatalog.filter((e) => allowed.includes(e.id));
  const items = mine.filter((e) => family === "all" || templateMeta[e.id]?.family === family);
  const families = (Object.keys(familyNamesAr) as TemplateFamily[]).filter((f) => mine.some((e) => templateMeta[e.id]?.family === f));
  return (
    <>
      <div className="toolbar">
        <div className="cat-row">
          <button aria-pressed={family === "all"} onClick={() => setFamily("all")}>كل العائلات</button>
          {families.map((f) => (
            <button key={f} aria-pressed={family === f} onClick={() => setFamily(f)}>{familyNamesAr[f]}</button>
          ))}
        </div>
      </div>
      <p className="help">قوالب «{channel?.name}» فقط ({mine.length.toLocaleString("ar-EG")} من {sceneCatalog.length.toLocaleString("ar-EG")}). اضغط «شاهد مثالًا» أو مرّر الفأرة على القالب لتشاهده يتحرك. نوّع بين العائلات في الحلقة الواحدة، ولا تبنِ حلقتين متتاليتين على القالب الأساسي نفسه.</p>
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
                <span className="help">{arDigitsLib(def?.useAr ?? "")}</span>
                <span className="help">في السكريبت: <code dir="ltr">[مشهد: {e.id}]</code></span>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
};

/** أماكن التصوير: كل مكان مرسوم كاملًا، يُستعمل في قالب «مشهد في مكان». */
export const SetsGallery: React.FC<{ allowed: string[] }> = ({ allowed }) => (
  !allowed.length ? (
    <div className="empty-state">
      <h2>لا أماكن تصوير في مكتبة هذه القناة الآن.</h2>
      <p className="help">الأماكن القديمة برسومات وألوان لا تناسب هوية القناة استُبعدت. تعود بعد إعادة رسمها بهويتها واعتماد الستوري بورد وقياس حركتها.</p>
    </div>
  ) :
  <>
    <p className="help">أماكن هذه القناة فقط. أماكن مرسومة كاملة تتحرك فيها الإضاءة والبخار والنجوم. استعملها من قالب «مشهد في مكان» واختر المكان. غيّر المكان بين الحلقات ليبقى المحتوى متنوعًا.</p>
    <div className="tpl-grid">
      {sets.filter((s) => allowed.includes(s.id)).map((s) => (
        <article key={s.id} className="tpl-card">
          <svg viewBox="0 0 1920 1080" style={{ width: "100%", display: "block", borderRadius: 10 }}>
            <SetBackdrop id={s.id} t={1.2} />
          </svg>
          <div className="tpl-info">
            <div className="tpl-head">
              <b>{s.nameAr}</b>
              <span className="chip">{s.mood === "night" ? "ليلي" : "نهاري"}</span>
            </div>
            <span className="help">{s.tags.join("، ")}</span>
            <code className="help" style={{ direction: "ltr" }}>[مشهد: set-scene | set={s.id}]</code>
          </div>
        </article>
      ))}
    </div>
  </>
);
