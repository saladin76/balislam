import React, { useRef, useState, useEffect } from "react";
import { Icon } from "../ui/icons";
import { Num } from "../ui/format";
import { OwnerText } from "../ui/OwnerText";
import { clockAr } from "./sceneNames";

const noop = () => {};
export const videoFailureMessage = (code?: number): string => code === 2
  ? "تعذّر تحميل الفيديو. تحقق من اتصال الاستوديو ثم أعد المحاولة."
  : code === 3 ? "تعذّر فك ترميز الفيديو. أعد إنتاج معاينة المشهد من أدواته."
  : code === 4 ? "ملف الفيديو غير متاح أو صيغته غير مدعومة. أعد تحميله أو أعد إنتاج المعاينة."
  : "تعذّر تشغيل الفيديو. أعد المحاولة؛ وإذا تكرر الخطأ فأعد إنتاج المعاينة.";
export const FramePlayer = React.forwardRef<HTMLVideoElement, {
  src: string; label: string; autoPlay?: boolean; className?: string;
  expectedDuration?: number; onDuration?: (seconds: number) => void;
  onTimeUpdate?: React.ReactEventHandler<HTMLVideoElement>; onLoadedMetadata?: React.ReactEventHandler<HTMLVideoElement>;
  /** D199: a seek (the bar or the keyboard) breaks the «watched» chain of the pre-final. */
  onSeeking?: React.ReactEventHandler<HTMLVideoElement>; onPause?: React.ReactEventHandler<HTMLVideoElement>;
}>(({ src, label, autoPlay, className, expectedDuration, onDuration, onTimeUpdate, onLoadedMetadata, onSeeking, onPause }, ref) => {
  const own = useRef<HTMLVideoElement | null>(null);
  const box = useRef<HTMLDivElement | null>(null);
  const [t, setT] = useState(0);
  const [d, setD] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { setT(0); setD(0); setPlaying(false); setError(""); }, [src]);
  const setRef = (el: HTMLVideoElement | null) => {
    own.current = el;
    if (typeof ref === "function") ref(el); else if (ref) ref.current = el;
  };
  const toggle = () => {
    const v = own.current; if (!v) return;
    if (v.paused) void v.play().catch((e: Error) => {
      if (e.name === "AbortError") return;
      setError(e.name === "NotAllowedError" ? "منع المتصفح تشغيل الفيديو. اضغط «شغّل» لبدء المشاهدة." : videoFailureMessage(v.error?.code));
    }); else v.pause();
  };
  const mute = () => { const v = own.current; if (!v) return; v.muted = !v.muted; setMuted(v.muted); };
  const full = () => {
    const el = box.current;
    if (typeof document === "undefined" || !el) return;
    if (document.fullscreenElement) void document.exitFullscreen().catch(noop); else void el.requestFullscreen?.().catch(noop);
  };
  // Our own controls, in Arabic (the browser's native ones speak the browser's language): play, time, sound, full screen.
  return (
    <>
    <div ref={box} className={`s3-frame${className ? ` ${className}` : ""}`}>
      <video ref={setRef} className="scene-first-video" preload="metadata" playsInline autoPlay={autoPlay} src={src} aria-label={label}
        onClick={toggle} onPlay={() => { setPlaying(true); setError(""); }} onPause={(e) => { setPlaying(false); onPause?.(e); }} onEnded={(e) => { setPlaying(false); onPause?.(e); }}
        onSeeking={onSeeking}
        onError={(e) => { setPlaying(false); setError(videoFailureMessage(e.currentTarget.error?.code)); }}
        onVolumeChange={(e) => setMuted(e.currentTarget.muted)}
        onTimeUpdate={(e) => { setT(e.currentTarget.currentTime); onTimeUpdate?.(e); }}
        onLoadedMetadata={(e) => {
          const seconds = e.currentTarget.duration;
          if (Number.isFinite(seconds) && seconds > 0) { setD(seconds); onDuration?.(seconds); }
          onLoadedMetadata?.(e);
        }} />
      <div className="s3-play" dir="ltr">
        <button type="button" onClick={toggle} aria-label={playing ? "أوقف" : "شغّل"} title={playing ? "أوقف" : "شغّل"}><Icon name={playing ? "pause" : "play"} /></button>
        <Num className="clk">{`${clockAr(t)} / ${clockAr(d)}`}</Num>
      </div>
      <div className="s3-tools" dir="ltr">
        <button type="button" onClick={mute} aria-pressed={muted} aria-label={muted ? "أعد الصوت" : "اكتم الصوت"} title={muted ? "أعد الصوت" : "اكتم الصوت"}>{muted ? "شغّل الصوت" : "اكتم"}</button>
        <button type="button" onClick={full} aria-label="ملء الشاشة" title="ملء الشاشة">ملء الشاشة</button>
      </div>
      <input className="s3-prog" type="range" min={0} max={d || 0} step={0.05} value={Math.min(t, d || 0)} aria-label="موضع التشغيل"
        aria-valuetext={`${clockAr(t)} من ${clockAr(d)}`}
        style={{ "--p": `${d ? (100 * t) / d : 0}%` } as React.CSSProperties}
        onChange={(e) => { const v = own.current; if (v) v.currentTime = Number(e.target.value); }} />
    </div>
      {error ? <div className="s3-media-error" role="alert">
        <span><OwnerText text={error} /></span>
        <button type="button" onClick={() => { setError(""); own.current?.load(); }}>أعد تحميل الفيديو</button>
      </div> : null}
      {d > 0 && expectedDuration !== undefined && Math.abs(d - expectedDuration) > 0.2 ? (
        <p className="s3-duration-note" role="note">
          مدة الفيديو الفعلية {clockAr(d)}؛ تقدير الخطة {clockAr(expectedDuration)}. راجع الإيقاع والذيل في هذا الملف قبل الاعتماد.
        </p>
      ) : null}
    </>
  );
});
FramePlayer.displayName = "FramePlayer";
