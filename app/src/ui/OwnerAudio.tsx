import React, { useEffect, useRef, useState } from "react";
import { duration } from "./format";
import { Icon } from "./icons";

/**
 * مشغّل صوت صغير بأرقام عربية (KI-022): مشغّل المتصفح الأصلي (`<audio controls>`) يكتب الزمن «0:00» بأرقام
 * غربية ولا يمكن تغييرها. تشغيل/إيقاف، وشريط موضع، والزمن «٠:٠٠ / ١:١٢». العنصر نفسه بلا controls، فالتحميل
 * (`preload`) والملف كما كانا.
 */
export const OwnerAudio: React.FC<{ src: string; preload?: "none" | "metadata" | "auto"; label?: string }> = ({ src, preload = "none", label = "التسجيل" }) => {
  const el = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [at, setAt] = useState(0);
  const [len, setLen] = useState(0);
  const [failed, setFailed] = useState(false);
  useEffect(() => { setPlaying(false); setAt(0); setLen(0); setFailed(false); }, [src]);
  const toggle = () => {
    const a = el.current;
    if (!a) return;
    if (a.paused) void a.play().catch(() => setFailed(true)); else a.pause();
  };
  return (
    <span className="own-audio" role="group" aria-label={label}>
      <audio ref={el} preload={preload} src={src}
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)}
        onTimeUpdate={(e) => setAt(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setLen(Number.isFinite(e.currentTarget.duration) ? e.currentTarget.duration : 0)}
        onDurationChange={(e) => setLen(Number.isFinite(e.currentTarget.duration) ? e.currentTarget.duration : 0)}
        onError={() => setFailed(true)} />
      <button type="button" className="own-audio-pp" aria-label={playing ? `أوقف ${label}` : `شغّل ${label}`} onClick={toggle}>
        <Icon name={playing ? "pause" : "play"} />
      </button>
      <input type="range" className="own-audio-seek" min={0} max={len || 0} step={0.1} value={Math.min(at, len || 0)} disabled={!len}
        aria-label="الموضع" aria-valuetext={`${duration(at)} من ${duration(len)}`}
        onChange={(e) => { const a = el.current; if (a) a.currentTime = Number(e.target.value); setAt(Number(e.target.value)); }} />
      <span className="own-audio-t clk">{duration(at)} / {len ? duration(len) : "—"}</span>
      {failed ? <span className="sp-hint" role="alert">تعذّر تشغيل الملف.</span> : null}
    </span>
  );
};
