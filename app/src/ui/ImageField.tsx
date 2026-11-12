import React, { useEffect, useRef, useState } from "react";
import { api } from "../api";
import type { EpisodeMedia } from "../../../src/plan/media";
import { fireflyPrompt, fullImagePrompt, midjourneyPrompt, type PromptLook } from "../../../src/visual/prompts";
import { librarySlot } from "../../../src/visual/library";
import { OwnerText } from "./OwnerText";

const readAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });

/** صورة اللوحة الوثائقية: معاينة، ورفع، وأوامر التوليد الجاهزة للنسخ (Midjourney وأي أداة أخرى). */
export const ImageField: React.FC<{
  episodeId: string;
  sceneId: string;
  channel: string;
  value: string;
  prompt: string;
  look: PromptLook;
  media: EpisodeMedia;
  onChange: (file: string) => void;
  onMedia: (m: EpisodeMedia) => void;
}> = ({ episodeId, sceneId, channel, value, prompt, look, media, onChange, onMedia }) => {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [lib, setLib] = useState<string[]>([]);
  // دقة الملف الفعلية: النسخة النهائية 4K (3840 عرضًا)، والكاميرا تقترب حتى نحو 1.2×، فالصورة الأصغر من 2560 تظهر مبكسلة
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    api.libraryImages().then((r) => setLib(r.files)).catch(() => {});
  }, [channel]);
  useEffect(() => setDims(null), [value]);
  const resolved = value ? media.images?.find((x) => x === value || x.replace(/\.[^.]+$/, "") === value) : undefined;
  const has = Boolean(resolved);
  const url = resolved ? `${media.base}images/${encodeURIComponent(resolved.replace(/^lib:/, "lib__"))}${media.query ?? ""}` : "";
  /** أقل عرض يبقى حادًا في النسخة النهائية 4K مع اقتراب الكاميرا */
  const MIN_SHARP_WIDTH = 2560;
  const isVid = /\.(mp4|webm|mov)$/i.test(resolved ?? "");
  // المرجع بلا امتداد (lib:<الخانة>) حتى يبقى صالحًا لو استُبدلت الصورة بامتداد آخر
  const pickLib = (file: string) => {
    if (!file) return;
    onMedia({ ...media, images: [...new Set([...(media.images ?? []), `lib:${file}`])] });
    onChange(`lib:${file.replace(/\.[^.]+$/, "")}`);
  };
  const flash = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(""), 1600);
  };
  const copy = (text: string) => navigator.clipboard.writeText(text).then(() => flash("نُسخ ✓")).catch(() => flash("تعذّر النسخ"));
  const upload = async (file: File) => {
    setBusy(true);
    try {
      const data = await readAsDataUrl(file);
      const r = await api.uploadImage(episodeId, { name: file.name, data, scene: sceneId });
      onMedia(r.media);
      onChange(r.file);
      flash("رُفعت الصورة ✓");
    } catch (e) {
      flash((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const mj = midjourneyPrompt({ channel, prompt, look, orientation: "landscape" });
  const generic = fullImagePrompt({ channel, prompt, look });
  const ff = fireflyPrompt({ channel, prompt, look });

  return (
    <div className="field image-field" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontWeight: 600, fontSize: 13 }}>الصورة</span>
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files[0];
          if (f) void upload(f);
        }}
        style={{ border: "1px dashed var(--line, #ccc)", borderRadius: 10, aspectRatio: "16 / 9", overflow: "hidden", display: "grid", placeItems: "center", background: "#0b0806", color: "#E9D9B8", cursor: "pointer" }}
        onClick={() => input.current?.click()}
        title="اضغط لاختيار صورة أو اسحبها هنا"
      >
        {url ? isVid ? <video src={url} muted loop autoPlay playsInline onLoadedMetadata={(e) => setDims({ w: e.currentTarget.videoWidth, h: e.currentTarget.videoHeight })} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <img src={url} alt="" onLoad={(e) => setDims({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 13 }}>{busy ? "جارٍ الرفع…" : value ? (value.startsWith("lib:") ? "خانة المكتبة لم تُرفع صورتها بعد (المكتبة ← صور القناة)" : "الصورة غير موجودة على هذا الجهاز، ارفعها مرة أخرى") : "اضغط أو اسحب صورة هنا (JPG/PNG)"}</span>}
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ""; }} />
      {lib.length ? (
        <select value={value.startsWith("lib:") ? (lib.find((f) => f === value.slice(4) || f.replace(/\.[^.]+$/, "") === value.slice(4)) ?? "") : ""} onChange={(e) => pickLib(e.target.value)}>
          <option value="">من مكتبة صور القناة ({lib.length})…</option>
          {lib.map((f) => {
            const slot = librarySlot(channel, f.replace(/\.[^.]+$/, ""));
            return <option key={f} value={f}>{slot ? `${slot.group} — ${slot.titleAr}` : f}</option>;
          })}
        </select>
      ) : null}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <button className="btn small" disabled={busy} onClick={() => input.current?.click()}>{has && !value.startsWith("lib:") ? "استبدل الصورة" : "ارفع صورة خاصة بالمشهد"}</button>
        {has ? <button className="btn small" onClick={() => onChange("")}>أزل</button> : null}
        {mj ? <button className="btn small" onClick={() => copy(mj)} title={mj}>انسخ أمر Midjourney</button> : null}
        {ff.prompt ? <button className="btn small" onClick={() => copy(ff.prompt)} title={`${ff.prompt}\n\nExclude: ${ff.exclude}`}>انسخ وصف Firefly</button> : null}
        {generic ? <button className="btn small" onClick={() => copy(generic)} title={generic}>انسخ الوصف لأي أداة</button> : null}
        {msg ? <span className="help"><OwnerText text={msg} /></span> : null}
      </div>
      {url && dims ? (
        dims.w < MIN_SHARP_WIDTH ? (
          <span className="help" style={{ color: "var(--danger, #B3261E)" }}>
            دقة الملف {dims.w}×{dims.h}: ستظهر مبكسلة في النسخة النهائية 4K. نزّلها من أداة التوليد بأعلى دقة (2560 عرضًا على الأقل، والأفضل 3840)، أو كبّرها بأداة رفع الدقة قبل رفعها.
          </span>
        ) : (
          <span className="help">دقة الملف {dims.w}×{dims.h}: حادة في النسخة النهائية 4K.</span>
        )
      ) : null}
      {!prompt.trim() ? <span className="help">اكتب «وصف الصورة» بالأسفل أولًا، وسيظهر أمر التوليد جاهزًا للنسخ بأسلوب القناة.</span> : null}
    </div>
  );
};
