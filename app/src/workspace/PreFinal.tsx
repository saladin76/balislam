import React, { useEffect, useState } from "react";
import { api, type OwnRecitationsRead } from "../api";
import { RecitationItem } from "./RecitationItem";
import { useOwnerSession } from "../shell/ownerSession";
import "./scene-production.css";

const ar = (n: number) => n.toLocaleString("ar-EG");

/**
 * Step ٣ «النسخة النهائية» (owner decision, 8 Nov: recitations come LAST).
 *  1. «معاينة قبل النهائية»: every current scene cut in order (approved or draft), with narration, verse
 *     scenes silent and marked «التلاوة تُضاف لاحقًا». For watching only: it is not an approval, not the
 *     assembly and never a Master.
 *  2. «التلاوات»: the owner uploads each verse he recorded; the Studio keeps the original and makes a
 *     processed copy (edge silence, gentle denoise, loudness matched to the narration), shows the loudness
 *     before/after, and the owner may switch back to the original before approving after listening.
 * The final gates are unchanged: every scene approved unconditionally with its recitation, the assembly
 * watched 1× with every seam, then Master, then publish permission.
 */
export const PreFinalPanel: React.FC<{ episodeId: string; channelId: string; onChanged?: () => void }> = ({ episodeId, channelId, onChanged }) => {
  const owner = useOwnerSession();
  const [pre, setPre] = useState<{ preview: string | null; entry: { version: number; updatedAt: string | null } | null } | null>(null);
  const [recs, setRecs] = useState<OwnRecitationsRead | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  const load = async () => {
    const [p, r] = await Promise.all([api.preFinal(episodeId, channelId).catch(() => null), api.ownRecitations(episodeId, channelId).catch(() => null)]);
    setPre(p);
    setRecs(r);
  };
  useEffect(() => { setError(""); setMsg(""); void load(); }, [episodeId, channelId]); // eslint-disable-line react-hooks/exhaustive-deps

  const guard = async (label: string, work: () => Promise<void>) => {
    if (!owner.open) return setError("افتح جلسة المالك من أعلى الصفحة أولًا.");
    setBusy(label);
    setError("");
    setMsg("");
    try {
      await work();
      await load();
      onChanged?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  };
  const makePreFinal = () => guard("prefinal", async () => {
    const r = await api.makePreFinal(episodeId, channelId, owner.secret);
    setMsg(`جُمعت ${ar(r.scenes)} مشاهد${r.recitationPending.length ? `؛ ${ar(r.recitationPending.length)} آية صامتة بانتظار تلاوتها` : ""}.`);
  });
  const verses = recs?.verses ?? [];
  const keys = [...new Set(verses.map((v) => v.key))];
  const missing = keys.filter((k) => !recs?.approved[k]);

  return (
    <section className="scene-first-panel sp pf" aria-label="معاينة قبل النهائية والتلاوات">
      <div className="sp-row">
        <div>
          <h3>معاينة قبل النهائية</h3>
          <p className="sp-hint">كل المشاهد الحالية بالترتيب (المعتمدة والمسودات) بصوت الراوي، والآيات صامتة بعلامة «التلاوة تُضاف لاحقًا». للمشاهدة فقط: ليست اعتمادًا ولا تجميعًا ولا نسخة نهائية.</p>
        </div>
        <div className="sp-actions">
          <button type="button" className="btn primary" disabled={Boolean(busy) || !owner.open} onClick={() => void makePreFinal()}>
            {busy === "prefinal" ? "جارٍ التجميع…" : pre?.preview ? "حدّث المعاينة قبل النهائية" : "اصنع المعاينة قبل النهائية"}
          </button>
        </div>
      </div>
      {pre?.preview ? (
        <video key={`${pre.entry?.version ?? 0}`} className="scene-first-video" controls preload="metadata"
          src={api.previewUrl(episodeId, pre.preview)} aria-label="المعاينة قبل النهائية بلا تلاوات" />
      ) : null}

      {keys.length ? (
        <div className="pf-recs">
          <h3>التلاوات ({ar(keys.length - missing.length)} من {ar(keys.length)} معتمدة)</h3>
          <p className="sp-hint">سجّل الآيات بنفسك وارفع كل تلاوة هنا. تُحفظ نسختك الأصلية كما هي، وتُجهَّز نسخة معالجة (قصّ صمت الطرفين، تنقية خفيفة، وعلوّ مطابق للراوي)؛ ولك أن تختار الأصل. لا جلب ولا توليد للقرآن.</p>
          <ul className="pf-rec-list">
            {keys.map((key) => (
              <RecitationItem key={key} episodeId={episodeId} channelId={channelId} ayahKey={key} recs={recs}
                scenes={verses.filter((v) => v.key === key).map((v) => v.sceneId)} onChanged={async () => { await load(); onChanged?.(); }} />
            ))}
          </ul>
        </div>
      ) : null}
      {error ? <p className="scene-first-error" role="alert">{error}</p> : null}
      {msg ? <p className="sp-hint" role="status">{msg}</p> : null}
    </section>
  );
};
