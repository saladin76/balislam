import { SCENES, countAr } from "../../../src/i18n/count";
import React, { useEffect, useState } from "react";
import { api, type OwnRecitationsRead } from "../api";
import { RecitationItem } from "./RecitationItem";
import { FramePlayer } from "./SceneProductionPanel";
import { num } from "../ui/format";
import "./scene-production.css";
import { useChannel } from "../../../src/channel/context";
import { versesAreCitations } from "../../../src/quran/citation";

const ar = (n: number) => num(n);

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
export const PreFinalPanel: React.FC<{
  episodeId: string; channelId: string; onChanged?: () => void;
  /** Step ٣ still locked (D52): only the recitation uploads, allowed early (D35), under «يمكنك الآن». */
  recitationsOnly?: boolean;
  /** Scene order, to name scenes «المشهد ٣» instead of their ids. */
  order?: string[];
}> = ({ episodeId, channelId, onChanged, recitationsOnly, order: orderProp }) => {
  /** D68: in a written-citation channel the verse cards are finished silent cards, not placeholders. */
  const cited = versesAreCitations(useChannel());
  const [pre, setPre] = useState<{ preview: string | null; entry: { version: number; updatedAt: string | null } | null } | null>(null);
  const [recs, setRecs] = useState<OwnRecitationsRead | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  const [order, setOrder] = useState<string[]>(orderProp ?? []);
  const load = async () => {
    const [p, r, w] = await Promise.all([
      recitationsOnly ? Promise.resolve(null) : api.preFinal(episodeId, channelId).catch(() => null),
      api.ownRecitations(episodeId, channelId).catch(() => null),
      orderProp ? Promise.resolve(null) : api.sceneProduction(episodeId, channelId).catch(() => null),
    ]);
    setPre(p);
    setRecs(r);
    if (w) setOrder(w.scenes.map((x) => x.id));
  };
  useEffect(() => { setError(""); setMsg(""); void load(); }, [episodeId, channelId]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Each action works directly on click (no passphrase, owner decision 9 Nov). */
  const guard = async (label: string, work: () => Promise<void>) => {
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
    const r = await api.makePreFinal(episodeId, channelId);
    setMsg(`جُمعت المشاهد (${countAr(r.scenes, SCENES)})${r.recitationPending.length ? `؛ آيات صامتة بانتظار تلاوتها: ${ar(r.recitationPending.length)}` : ""}.`);
  });
  const verses = recs?.verses ?? [];
  const keys = [...new Set(verses.map((v) => v.key))];
  const missing = keys.filter((k) => !recs?.approved[k]);

  if (recitationsOnly && !keys.length) return null;
  return (
    <section className="scene-first-panel sp pf" aria-label={recitationsOnly ? "التلاوات" : keys.length ? "معاينة قبل النهائية والتلاوات" : "معاينة قبل النهائية"}>
      {recitationsOnly ? null : <>
      <div className="sp-row">
        <div>
          <h3>معاينة قبل النهائية</h3>
          <p className="sp-hint">{cited
            ? "كل المشاهد الحالية بالترتيب (المعتمدة والمسودات) بصوت الراوي، وبطاقات الآيات صامتة بنصها ومرجعها (استشهاد مكتوب). للمشاهدة فقط: ليست اعتمادًا ولا تجميعًا ولا نسخة نهائية."
            : "كل المشاهد الحالية بالترتيب (المعتمدة والمسودات) بصوت الراوي، والآيات صامتة بعلامة «التلاوة تُضاف لاحقًا». للمشاهدة فقط: ليست اعتمادًا ولا تجميعًا ولا نسخة نهائية."}</p>
        </div>
        <div className="sp-actions">
          <button type="button" className="btn primary" aria-busy={Boolean(busy)} onClick={() => { if (!busy) void makePreFinal(); }}>
            {busy === "prefinal" ? "جارٍ التجميع…" : pre?.preview ? "حدّث المعاينة قبل النهائية" : "اصنع المعاينة قبل النهائية"}
          </button>
        </div>
      </div>
      {pre?.preview ? (
        <FramePlayer key={`${pre.entry?.version ?? 0}`} src={api.previewUrl(episodeId, pre.preview)} label={cited ? "المعاينة قبل النهائية" : "المعاينة قبل النهائية بلا تلاوات"} />
      ) : null}
      </>}

      {keys.length ? (
        <div className="pf-recs">
          <h3>التلاوات ({ar(keys.length - missing.length)} من {ar(keys.length)} معتمدة)</h3>
          <p className="sp-hint">سجّل الآيات بنفسك وارفع كل تلاوة هنا. تُحفظ نسختك الأصلية كما هي، وتُجهَّز نسخة معالجة (قصّ صمت الطرفين، تنقية خفيفة، وعلوّ مطابق للراوي)؛ ولك أن تختار الأصل. لا جلب ولا توليد للقرآن.</p>
          <ul className="pf-rec-list">
            {keys.map((key) => (
              <RecitationItem key={key} episodeId={episodeId} channelId={channelId} ayahKey={key} recs={recs} order={order}
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
