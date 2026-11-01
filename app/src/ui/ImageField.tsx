import React, { useRef, useState } from "react";
import { api } from "../api";
import type { EpisodeMedia } from "../../../src/plan/media";
import { fullImagePrompt, midjourneyPrompt, type PromptLook } from "../../../src/visual/prompts";

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
  const has = Boolean(value && media.images?.includes(value));
  const url = has ? `${media.base}images/${encodeURIComponent(value)}${media.query ?? ""}` : "";
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
        {url ? <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 13 }}>{busy ? "جارٍ الرفع…" : value ? "الصورة غير موجودة على هذا الجهاز، ارفعها مرة أخرى" : "اضغط أو اسحب صورة هنا (JPG/PNG)"}</span>}
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ""; }} />
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <button className="btn small" disabled={busy} onClick={() => input.current?.click()}>{has ? "استبدل الصورة" : "ارفع صورة"}</button>
        {has ? <button className="btn small" onClick={() => onChange("")}>أزل</button> : null}
        {mj ? <button className="btn small" onClick={() => copy(mj)} title={mj}>انسخ أمر Midjourney</button> : null}
        {generic ? <button className="btn small" onClick={() => copy(generic)} title={generic}>انسخ الوصف لأي أداة</button> : null}
        {msg ? <span className="help">{msg}</span> : null}
      </div>
      {!prompt.trim() ? <span className="help">اكتب «وصف الصورة» بالأسفل أولًا، وسيظهر أمر التوليد جاهزًا للنسخ بأسلوب القناة.</span> : null}
    </div>
  );
};
