/**
 * One scene's sentences in the list view, or its verse: «ارفع التلاوة» (a human recitation the owner uploads; the
 * Quran is never generated with the cloned voice), or a silent written citation on a channel that cites (D68).
 */
import React from "react";
import type { SentenceScene } from "../../api";
import { RecitationItem } from "../RecitationItem";
import { ar, countAr } from "./format";
import { BasmalaBlock, OlderNote, SceneControl, type SentencesPart } from "./SentenceParts";
import { SentenceListRow } from "./SentenceListRow";

export const SentenceSceneBlock: React.FC<SentencesPart & { s: SentenceScene }> = ({ m, p, s }) => {
  const { cited, recs, load, sceneQueue } = m;
  const { episodeId, channelId, sceneId, onChanged } = p;
  if (s.verse) {
    const v = s.verse;
    return (
      <section className="sv-scene is-verse" aria-label={`المشهد ${ar(s.index)}: آية`}>
        {!sceneId ? <h4 className="sv-scene-h">المشهد {ar(s.index)} <span>آية — {v.reference}</span></h4> : null}
        {cited ? (
          <p className="sp-hint sv-citation" role="note">استشهاد مكتوب: تظهر الآية بنصها ومرجعها صامتة، بلا تلاوة ولا تسجيل (قرار القناة). لا يولَّد القرآن بالصوت المستنسخ أبدًا.</p>
        ) : (<>
        <ul className="pf-rec-list sv-verse">
          <RecitationItem compact episodeId={episodeId} channelId={channelId} ayahKey={v.ayahKey} scenes={[s.id]} recs={recs}
            onChanged={async () => { await load(); onChanged?.(); }} />
        </ul>
        <p className="sp-hint">تلاوة بشرية ترفعها بنفسك؛ لا يولَّد القرآن بالصوت المستنسخ أبدًا. اعتمادها يعيد فتح مشهدها وحده.</p>
        </>)}
      </section>
    );
  }
  const q = sceneQueue(s);
  return (
    <section className="sv-scene" aria-label={`جمل المشهد ${ar(s.index)}`}>
      <header className="sv-scene-head">
        {sceneId ? <h3>الجمل <span className="sv-meta">{countAr(s.rows.length)}</span></h3>
          : <h4 className="sv-scene-h">المشهد {ar(s.index)}{s.divided ? <span>الفصل {ar(s.chapter)}{s.chapterTitle ? ` — ${s.chapterTitle}` : ""}</span> : null}</h4>}
        <SceneControl m={m} s={s} q={q} />
      </header>
      {!s.managed ? (
        <p className="sp-hint">{s.audio.state === "scene" ? "صوت المشهد الحالي ملف واحد. أي فعل على جملة يبدأ العمل جملةً جملة، ويُقص صوت المشهد إلى جمله إن كانت الوقفات بينها واضحة؛ والملف الأصلي يبقى محفوظًا."
          : "قُسّم التعليق آليًا عند علامات الجملة. ولّد الجمل واحدة واحدة، ويُركَّب صوت المشهد منها حين تكتمل."}</p>
      ) : s.import?.state === "unreliable" && s.audio.state !== "sentences" ? <p className="sp-hint">{s.import.note}</p> : null}
      {s.managed && s.waiting ? <p className="sv-wait" role="status">{s.waiting}</p> : null}
      <OlderNote s={s} />
      <ol className="sv-list">{s.rows.map((r, i) => <SentenceListRow key={r.id} m={m} p={p} s={s} r={r} i={i} />)}</ol>
      <BasmalaBlock m={m} p={p} s={s} />
    </section>
  );
};
