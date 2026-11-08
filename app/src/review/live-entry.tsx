/**
 * Standalone V2 entry during STUDIO_V2_ENFORCE=1.
 * The legacy Studio app still uses locked /api/* routes; never silently
 * fall back to them. Rendered scene metadata must come from Backend V2.
 */
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { SceneReviewWorkspace } from "./SceneReviewWorkspace";
import { episodeNumber } from "./adapter";
import "../styles.css";

const CHANNELS = [
  { id: "balislam", label: "بالإسلام" },
  { id: "dafatir-alzaman", label: "دفاتر الزمن" },
  { id: "zubdat-alkutub", label: "زبدة الكتب" },
] as const;
const params = new URLSearchParams(window.location.search);
const givenChannel = params.get("channel") || "balislam";
const initialChannel = CHANNELS.some(c => c.id === givenChannel) ? givenChannel : "balislam";
const givenEpisode = params.get("episode") || "001";
const initialEpisode = /^\d{3}$/.test(givenEpisode) ? givenEpisode : "001";

function LiveReviewApp() {
  const [channel, setChannel] = useState(initialChannel);
  const [episode, setEpisode] = useState(initialEpisode);
  const [scope, setScope] = useState<{ channel: string; episode: string } | null>(null);
  const [error, setError] = useState("");
  if (scope) return <SceneReviewWorkspace key={scope.channel + ":" + scope.episode}
    channelId={scope.channel} episodeId={scope.episode}
    episodeTitle={"الحلقة " + scope.episode + " — بيانات Backend V2"}
    seeds={[]} initialMode="server" onClose={() => setScope(null)}/>;
  return <main className="v2-live-entry" dir="rtl">
    <div className="v2-live-panel">
      <p className="v2-eyebrow">STUDIO V2 / SECURE REVIEW</p>
      <h1>مراجعة المشاهد بالصوت والصورة</h1>
      <p>يفتح هذا المدخل الخادم المحلي المحمي مباشرةً؛ لا يُجري اعتمادًا من بيانات تجريبية أو من محرر Studio القديم.</p>
      <form onSubmit={event => {
        event.preventDefault();
        try {
          const number = episodeNumber(episode);
          setError(""); setScope({ channel, episode: number });
          const url = new URL(window.location.href);
          url.searchParams.set("channel", channel);
          url.searchParams.set("episode", number);
          window.history.replaceState(null, "", url.pathname + url.search);
        } catch (e) { setError((e as Error).message); }
      }}>
        <label>القناة
          <select value={channel} onChange={event => setChannel(event.target.value)}>
            {CHANNELS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </label>
        <label>رقم الحلقة (3 أرقام)
          <input dir="ltr" type="text" inputMode="numeric" maxLength={3}
            pattern="[0-9]{3}" required value={episode}
            onChange={event => setEpisode(event.target.value)}/>
        </label>
        <button type="submit">فتح مراجعة الحلقة</button>
      </form>
      {error && <p role="alert">{error}</p>}
      <p>تسجيل دخول المالك يتم في الخطوة التالية؛ احتفظ بسر المالك خارج المتصفح والمستودع.</p>
    </div>
  </main>;
}
createRoot(document.getElementById("root")!).render(<LiveReviewApp/>);
