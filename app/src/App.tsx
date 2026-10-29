import React, { useCallback, useEffect, useRef, useState } from "react";
import { IdentityProvider, type Identity } from "../../brand/identity/index";
import { LogoMark } from "../../brand/logo/Logo";
import type { Plan } from "../../src/plan/types";
import { api, type CheckResult, type EpisodeData, type EpisodeSummary } from "./api";
import { emptyMedia, type EpisodeMedia } from "../../src/plan/media";
import { EpisodeTab } from "./tabs/EpisodeTab";
import { ScriptTab, type ScriptTabHandle } from "./tabs/ScriptTab";
import { IdentityTab } from "./tabs/IdentityTab";

type Tab = "episode" | "script" | "identity";
const store = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* لا شيء */
    }
  },
};
const domains: [string, string][] = [
  ["psychology", "النفس والسلوك · حبر وورق"],
  ["family", "الأسرة والعلاقات · دفء البيت"],
  ["money", "المال والتأمل · ليلٌ هادئ"],
  ["knowledge", "العلم والتاريخ · أقواس دافئة"],
];

export const App: React.FC = () => {
  const [tab, setTab] = useState<Tab>((store.get("bal-tab") as Tab) || "episode");
  const [episodes, setEpisodes] = useState<EpisodeSummary[] | null>(null);
  const [epId, setEpId] = useState<string>(store.get("bal-episode") || "");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [script, setScript] = useState("");
  const [savedScript, setSavedScript] = useState("");
  const [check, setCheck] = useState<CheckResult | null>(null);
  const [media, setMedia] = useState<EpisodeMedia>(emptyMedia);
  const [extra, setExtra] = useState<Pick<EpisodeData, "issues" | "keys">>({ issues: [], keys: { voice: false, quran: false } });
  const [planState, setPlanState] = useState<"saved" | "dirty" | "saving" | "error">("saved");
  const [ident, setIdent] = useState<{ draft: Identity; saved: Identity; defaults: Identity } | null>(null);
  const [toast, setToast] = useState<{ msg: string; err?: boolean } | null>(null);
  const [showNew, setShowNew] = useState(false);
  const scriptRef = useRef<ScriptTabHandle>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const say = (msg: string, err = false) => {
    setToast({ msg, err });
    setTimeout(() => setToast(null), 2600);
  };

  useEffect(() => {
    api.episodes().then((list) => {
      setEpisodes(list);
      if (!list.some((e) => e.id === epId) && list[0]) setEpId(list[0].id);
    }).catch((e) => say(e.message, true));
    api.identity().then(({ identity, defaults }) => setIdent({ draft: identity, saved: identity, defaults })).catch((e) => say(e.message, true));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadEpisode = useCallback((id: string) => {
    api.episode(id).then((d) => {
      setPlan(d.plan);
      setScript(d.script);
      setSavedScript(d.script);
      setCheck(d.check);
      setMedia(d.media);
      setExtra({ issues: d.issues, keys: d.keys });
      setPlanState("saved");
    }).catch((e) => say(e.message, true));
  }, []);
  useEffect(() => {
    if (!epId) return;
    store.set("bal-episode", epId);
    setPlan(null);
    loadEpisode(epId);
  }, [epId, loadEpisode]);
  useEffect(() => store.set("bal-tab", tab), [tab]);

  /** حفظ تلقائي للخطة بعد توقف التعديل */
  const onPlanChange = useCallback((p: Plan) => {
    setPlan(p);
    setPlanState("dirty");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setPlanState("saving");
      try {
        await api.savePlan(epId, p);
        setPlanState("saved");
      } catch (e) {
        setPlanState("error");
        say((e as Error).message, true);
      }
    }, 700);
  }, [epId]);

  const saveScript = async () => {
    const r = await api.saveScript(epId, script);
    setSavedScript(script);
    setCheck(r.check);
    setPlan(r.plan);
    setPlanState("saved");
    api.episode(epId).then((d) => { setMedia(d.media); setExtra({ issues: d.issues, keys: d.keys }); }).catch(() => {});
    say("حُفظ السكريبت وتحدّثت المشاهد مع إبقاء تعديلاتك");
  };

  const scriptDirty = script !== savedScript;
  const identDirty = ident ? JSON.stringify(ident.draft) !== JSON.stringify(ident.saved) : false;

  if (!ident) return <div className="empty-state"><h2>جارٍ التحميل…</h2></div>;

  return (
    <IdentityProvider identity={ident.draft}>
      <div className="app">
        <header className="top">
          <div className="brand">
            <LogoMark size={34} colors={ident.draft.themes.warm.logo} />
            <span>استوديو بالإسلام</span>
          </div>
          <select id="episode-select" value={epId} onChange={(e) => setEpId(e.target.value)} style={{ width: 300 }} aria-label="الحلقة">
            {episodes?.length ? null : <option value="">لا توجد حلقات</option>}
            {episodes?.map((e) => <option key={e.id} value={e.id}>{e.id} · {e.title || e.dir}</option>)}
          </select>
          <button className="btn" onClick={() => setShowNew(true)}>+ حلقة جديدة</button>
          <nav className="tabs" role="tablist">
            <button role="tab" aria-selected={tab === "episode"} onClick={() => setTab("episode")}>الحلقة</button>
            <button role="tab" aria-selected={tab === "script"} onClick={() => setTab("script")}>السكريبت{scriptDirty ? " •" : ""}</button>
            <button role="tab" aria-selected={tab === "identity"} onClick={() => setTab("identity")}>الهوية{identDirty ? " •" : ""}</button>
          </nav>
          <span className="spacer" />
          {tab === "episode" && plan ? (
            <span className="status">
              <i className={`dot ${planState === "dirty" || planState === "saving" ? "dirty" : planState === "error" ? "err" : ""}`} />
              {planState === "saved" ? "كل التعديلات محفوظة" : planState === "saving" ? "جارٍ الحفظ…" : planState === "dirty" ? "تعديل…" : "تعذّر الحفظ"}
            </span>
          ) : null}
        </header>

        {tab === "identity" ? (
          <IdentityTab
            draft={ident.draft}
            saved={ident.saved}
            defaults={ident.defaults}
            onChange={(draft) => setIdent({ ...ident, draft })}
            onSave={async () => {
              await api.saveIdentity(ident.draft);
              setIdent({ ...ident, saved: ident.draft });
              say("حُفظت الهوية. الرندر القادم يستخدمها.");
            }}
          />
        ) : !episodes?.length ? (
          <div className="empty-state">
            <h2>لا توجد حلقات بعد</h2>
            <p>أنشئ أول حلقة، ثم اكتب السكريبت في تبويب «السكريبت» وستظهر المشاهد هنا تلقائيًا.</p>
            <button className="btn primary" onClick={() => setShowNew(true)}>+ حلقة جديدة</button>
          </div>
        ) : !plan || !check ? (
          <div className="empty-state"><h2>جارٍ فتح الحلقة…</h2></div>
        ) : tab === "episode" ? (
          <EpisodeTab
            key={epId}
            episodeId={epId}
            plan={plan}
            identity={ident.draft}
            media={media}
            issues={extra.issues}
            keys={extra.keys}
            onMediaChange={setMedia}
            onReload={() => loadEpisode(epId)}
            onPlanChange={onPlanChange}
            onEditScript={(line) => {
              setTab("script");
              setTimeout(() => scriptRef.current?.goToLine(line), 50);
            }}
          />
        ) : (
          <ScriptTab ref={scriptRef} text={script} savedText={savedScript} check={check} onChange={setScript} onSave={saveScript} />
        )}

        {showNew ? (
          <NewEpisode
            suggested={String((episodes?.reduce((m, e) => Math.max(m, Number(e.id)), 0) ?? 0) + 1).padStart(3, "0")}
            onClose={() => setShowNew(false)}
            onCreated={async (id) => {
              const list = await api.episodes();
              setEpisodes(list);
              setEpId(id);
              setShowNew(false);
              setTab("script");
              say(`أُنشئت الحلقة ${id}`);
            }}
          />
        ) : null}
        {toast ? <div className={`toast ${toast.err ? "err" : ""}`} role="status">{toast.msg}</div> : null}
      </div>
    </IdentityProvider>
  );
};

const NewEpisode: React.FC<{ suggested: string; onClose: () => void; onCreated: (id: string) => void }> = ({ suggested, onClose, onCreated }) => {
  const [episode, setEpisode] = useState(suggested);
  const [slug, setSlug] = useState("");
  const [domain, setDomain] = useState("psychology");
  const [title, setTitle] = useState("");
  const [err, setErr] = useState("");
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form
        className="modal"
        style={{ width: 520 }}
        onSubmit={async (e) => {
          e.preventDefault();
          setErr("");
          try {
            await api.createEpisode({ episode, slug, domain, title });
            onCreated(episode);
          } catch (x) {
            setErr((x as Error).message);
          }
        }}
      >
        <div className="modal-head"><h3>حلقة جديدة</h3></div>
        <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label className="field"><span>العنوان (سؤال)</span><input id="new-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="لماذا نؤجّل ما نعرف أنه مهم؟" required /></label>
          <div style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: 10 }}>
            <label className="field"><span>الرقم</span><input id="new-number" type="text" value={episode} onChange={(e) => setEpisode(e.target.value)} pattern="\d{3}" required /></label>
            <label className="field"><span>اسم المجلد بالإنجليزية</span><input id="new-slug" type="text" dir="ltr" value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} placeholder="procrastination" pattern="[a-z0-9]+(-[a-z0-9]+)*" required /></label>
          </div>
          <label className="field">
            <span>المجال (يحدد الثيم)</span>
            <select id="new-domain" value={domain} onChange={(e) => setDomain(e.target.value)}>
              {domains.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          {err ? <div className="help" style={{ color: "var(--err)" }}>{err}</div> : null}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button type="button" className="btn" onClick={onClose}>إلغاء</button>
            <button type="submit" className="btn primary">إنشاء</button>
          </div>
        </div>
      </form>
    </div>
  );
};
