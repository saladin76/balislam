import React, { useRef, useState } from "react";
import { api, type Loudness, type OwnRecitationsRead, type RecitationPolish, type RecitationVariant } from "../api";
import { SCENES, countAr, num, sceneName, seconds as secs, verseRef } from "../ui/format";
import { OwnerText } from "../ui/OwnerText";
import { OwnerAudio } from "../ui/OwnerAudio";

const lufs = (l?: Loudness | null) => (l && Number.isFinite(l.integrated) ? `علوّ ${num(l.integrated, 1)} — ذروة ${num(l.truePeak, 1)}` : "—");
const sec = (n: number) => secs(n, 2);

/**
 * ما ينقص قبل «اعتمد التلاوة»، أو "" إن اكتمل (KI-020): علامة الاستماع الكامل أولًا، ثم اسم القارئ ودليل الحق
 * وملاحظة الاستماع (١٢ حرفًا على الأقل). الشروط نفسها التي يرفض بها الخادم (`approveOwnRecitation`).
 */
export const approveMissing = (f: { reciter: string; rights: string; note: string; listened: boolean }, basmala = false): string => {
  const listen = basmala ? "استمع إليه كاملًا" : "استمع إليها كاملة";
  const fields = !f.reciter.trim() || f.rights.trim().length < 12 || f.note.trim().length < 12;
  if (!f.listened && fields) return `${listen} وضع العلامة، واكتب اسم القارئ ودليل حق الاستخدام وملاحظة الاستماع (١٢ حرفًا على الأقل لكل منهما).`;
  if (!f.listened) return `${listen} وضع العلامة «استمعت…» أولًا.`;
  if (fields) return "اكتب اسم القارئ، ودليل حق الاستخدام وملاحظة الاستماع (١٢ حرفًا على الأقل لكل منهما).";
  return "";
};

export const recitationUrl = (episodeId: string, channelId: string, file: string) =>
  `/api/episodes/${encodeURIComponent(episodeId)}/media/recitations/${encodeURIComponent(file)}?channel=${encodeURIComponent(channelId)}`;

/**
 * تلاوة آية واحدة يرفعها المالك (التلاوات آخرًا، D35): رفع ← نسخة معالجة بجوار الأصل كما سُجّل ← اختيار النسخة ←
 * اسم القارئ ودليل الحق وملاحظة الاستماع ← «اعتمد التلاوة». المسار نفسه في الخطوة ٣ («التلاوات») وفي «الجمل»
 * (صف الآية في تسلسل المشهد): `own-recitations` على الخادم، ولا توليد ولا جلب للقرآن أبدًا.
 */
export const RecitationItem: React.FC<{
  episodeId: string; channelId: string; ayahKey: string; scenes: string[];
  recs: OwnRecitationsRead | null; onChanged: () => void | Promise<void>; compact?: boolean;
  /** Scene order, to name scenes «المشهد ٣» (D52); without it the scene ids stay in the tooltip only. */
  order?: string[];
}> = ({ episodeId, channelId, ayahKey: key, scenes, recs, onChanged, compact, order }) => {
  const [busy, setBusy] = useState("");
  const picker = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [f, setF] = useState({ reciter: "", rights: "", note: "", listened: false });
  const set = (patch: Partial<typeof f>) => setF({ ...f, ...patch });
  const approved = recs?.approved[key];
  const pending = recs?.pending[key];
  const audioUrl = (file: string) => recitationUrl(episodeId, channelId, file);
  // البسملة تسجيل المالك بصوته لا تلاوة آية (قرار ١٠ نوفمبر): «ارفع التسجيل» (KI-016)
  const word = key === "basmala" ? "التسجيل" : "التلاوة";
  const missing = approveMissing(f, key === "basmala");

  /** Each action works directly on click (no passphrase, owner decision 9 Nov). */
  const guard = async (label: string, work: () => Promise<void>) => {
    setBusy(label);
    setError("");
    setMsg("");
    try {
      await work();
      await onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  };
  const upload = (file: File) => guard("up", async () => {
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(new Error("تعذّر قراءة الملف."));
      reader.readAsDataURL(file);
    });
    await api.ownRecitationAction(episodeId, channelId, { action: "upload", key, name: file.name, data });
    setMsg(`${key === "basmala" ? "رُفع التسجيل" : "رُفعت التلاوة"} وجُهّزت نسختها المعالجة؛ استمع إليها ثم اعتمدها.`);
  });
  const select = (variant: "processed" | "original") => guard("sel", async () => {
    await api.ownRecitationAction(episodeId, channelId, { action: "select", key, variant });
  });
  const approve = () => guard("ok", async () => {
    if (missing) throw new Error(missing);
    await api.ownRecitationAction(episodeId, channelId, { action: "approve", key, reciter: f.reciter, rightsEvidence: f.rights, note: f.note, listened: f.listened });
    setMsg(`${key === "basmala" ? "اعتُمد التسجيل" : "اعتُمدت التلاوة"}. مشهدها وحده يُفتح لمراجعة سريعة بالتلاوة في «المشاهد».`);
  });

  const variants = (vs: Record<"processed" | "original", RecitationVariant>, chosen: string | null, polish: RecitationPolish | null) => (
    <div className="pf-variants">
      {(["processed", "original"] as const).map((id) => (
        <label key={id} className={`pf-variant${chosen === id ? " is-on" : ""}`}>
          <input type="radio" name={`v-${key}`} checked={chosen === id} disabled={Boolean(busy)} onChange={() => void select(id)} />
          <b>{id === "processed" ? "المعالجة" : "الأصل كما سُجّل"}</b>
          <span className="sp-hint">{lufs(vs[id].loudness)} — {sec(vs[id].duration)}</span>
          <OwnerAudio src={audioUrl(vs[id].file)} label={id === "processed" ? "النسخة المعالجة" : "الأصل"} />
        </label>
      ))}
      {polish ? (
        <p className="sp-hint">
          قبل: {lufs(polish.before)} ← بعد: {lufs(vs.processed.loudness)} (الهدف {num(polish.target.integrated)} {polish.target.source === "narration" ? "مطابق لعلوّ صوت الراوي" : "الافتراضي"}).
          {" "}قُصّ من الصمت: أول {sec(polish.trim.trimmedHead)} وآخر {sec(polish.trim.trimmedTail)}، بلا مساس بالتلاوة ولا تغيير في طبقتها أو سرعتها.
        </p>
      ) : null}
    </div>
  );

  return (
    <li className={`pf-rec${compact ? " is-compact" : ""}`}>
      <div className="pf-rec-head">
        <b title={key}>{verseRef(key)}</b> <span className="sp-hint" title={scenes.join("، ")}>{order?.length ? scenes.map((id) => sceneName(order, id)).join("، ") : scenes.length > 1 ? countAr(scenes.length, SCENES) : "مشهدها"}</span>
        <span className={`pf-st is-${approved ? "ok" : pending ? "review" : "missing"}`}>{approved ? (key === "basmala" ? "معتمد" : "معتمدة") : pending ? "بانتظار استماعك" : key === "basmala" ? "لم يُرفع" : "لم تُرفع"}</span>
      </div>
      {approved ? (
        approved.variants ? variants(approved.variants, approved.variant, approved.polish) : <OwnerAudio src={audioUrl(approved.file)} label={word} />
      ) : pending ? (
        <>
          {pending.variants ? variants(pending.variants, pending.variant ?? "processed", pending.polish ?? null) : <OwnerAudio src={audioUrl(pending.file)} label={word} />}
          <div className="pf-approve">
            <input placeholder="اسم القارئ" value={f.reciter} onChange={(e) => set({ reciter: e.target.value })} aria-label="اسم القارئ" />
            <input placeholder="دليل حق الاستخدام (مثل: تسجيلي الخاص بتاريخ…)" value={f.rights} onChange={(e) => set({ rights: e.target.value })} aria-label="دليل حق الاستخدام" />
            <textarea rows={2} placeholder="ملاحظة الاستماع" value={f.note} onChange={(e) => set({ note: e.target.value })} aria-label="ملاحظة الاستماع" />
            <label className="sp-confirm"><input type="checkbox" checked={f.listened} onChange={(e) => set({ listened: e.target.checked })} /> {key === "basmala" ? "استمعت إلى التسجيل كاملًا" : "استمعت إلى التلاوة كاملة"}</label>
            {missing ? <p className="sp-hint" id={`rec-missing-${key}`}>{missing}</p> : null}
            {/* KI-020: لا يُضغط قبل علامة الاستماع والحقول (الخادم يرفض أيضًا) */}
            <button type="button" className={`btn ${compact ? "" : "primary"}`} disabled={Boolean(busy) || Boolean(missing)} aria-describedby={missing ? `rec-missing-${key}` : undefined}
              aria-busy={Boolean(busy)} onClick={() => { if (!busy && !missing) void approve(); }}>اعتمد {word}</button>
          </div>
        </>
      ) : null}
      {!pending ? (
        <>
          {/* A real button (keyboard: Tab, then Enter or Space) that opens the hidden file picker */}
          <button type="button" className="btn ghost pf-upload" disabled={Boolean(busy)} aria-busy={busy === "up"} onClick={() => picker.current?.click()}>
            {busy === "up" ? "جارٍ الرفع والمعالجة…" : approved ? "استبدل التسجيل" : `ارفع ${word}`}
          </button>
          <input ref={picker} type="file" accept=".wav,.mp3,.m4a,.aac,.ogg,.flac,audio/*" hidden tabIndex={-1} aria-hidden="true" disabled={Boolean(busy)}
            onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ""; if (file) void upload(file); }} />
        </>
      ) : null}
      {error ? <p className="scene-first-error" role="alert"><OwnerText text={error} /></p> : null}
      {msg ? <p className="sp-hint" role="status"><OwnerText text={msg} /></p> : null}
    </li>
  );
};
