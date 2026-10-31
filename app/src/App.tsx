import { UpdateBanner } from "./ui/UpdateBanner";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { IdentityProvider, type Identity } from "../../brand/identity/index";
import type { Plan } from "../../src/plan/types";
import { api, setApiChannel, type ChannelSummary, type CheckResult, type EpisodeData, type EpisodeSummary } from "./api";
import { channelInfo, defaultChannel, type ChannelInfo } from "../../src/channel/types";
import { emptyMedia, type EpisodeMedia } from "../../src/plan/media";
import { EpisodeTab } from "./tabs/EpisodeTab";
import { ScriptTab, type ScriptTabHandle } from "./tabs/ScriptTab";
import { IdentityTab } from "./tabs/IdentityTab";
import { HomeTab } from "./tabs/HomeTab";
import { PublishTab } from "./tabs/PublishTab";
import { LibraryTab } from "./tabs/LibraryTab";
import { ChannelTab } from "./tabs/ChannelTab";
import { SettingsTab } from "./tabs/SettingsTab";
import { ChannelLogo, ChannelProvider } from "../../src/channel/context";
import { useTheme } from "../../brand/identity/index";

type Tab = "home" | "episode" | "script" | "publish" | "identity" | "library" | "channel" | "settings";
const EPISODE_TABS: Tab[] = ["episode", "script", "publish"];
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

export const App: React.FC = () => {
  const [tab, setTab] = useState<Tab>((store.get("bal-tab") as Tab) || "home");
  const [keysOk, setKeysOk] = useState({ voice: false, quran: false });
  const [homeKey, setHomeKey] = useState(0);
  const [channels, setChannels] = useState<ChannelSummary[]>([]);
  const [channelId, setChannelId] = useState<string>(() => {
    const c = store.get("bal-channel") || "";
    setApiChannel(c);
    return c;
  });
  const [channel, setChannel] = useState<ChannelInfo>(channelInfo(defaultChannel));
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
  /** آخر خطة لم تُحفظ بعد (تنتظر مؤقت الحفظ التلقائي) */
  const pendingPlan = useRef<{ ep: string; plan: Plan } | null>(null);
  /** نص السكريبت غير المحفوظ (لا يُستبدل عند إعادة تحميل الحلقة) */
  const scriptDirtyRef = useRef(false);
  /** الحلقات التي جُلبت آياتها في هذه الجلسة */
  const quranSynced = useRef(new Set<string>());

  const say = (msg: string, err = false) => {
    setToast({ msg, err });
    setTimeout(() => setToast(null), 2600);
  };

  const reloadChannels = useCallback(() => api.channels().then(setChannels).catch((e) => say(e.message, true)), []);
  const reloadKeys = useCallback(
    () =>
      api.keys().then(({ keys }) => setKeysOk({ voice: Boolean(keys.ELEVENLABS_API_KEY?.set && keys.ELEVENLABS_VOICE_ID?.set), quran: Boolean(keys.QF_CLIENT_ID?.set && keys.QF_CLIENT_SECRET?.set) })).catch(() => {}),
    [],
  );
  useEffect(() => {
    reloadChannels();
    reloadKeys();
  }, [reloadChannels, reloadKeys]);

  // عند تغيير القناة: حلقاتها وهويتها
  useEffect(() => {
    setApiChannel(channelId);
    store.set("bal-channel", channelId);
    setEpisodes(null);
    setPlan(null);
    api.episodes().then((list) => {
      setEpisodes(list);
      setEpId((cur) => (list.some((e) => e.id === cur) ? cur : (list[0]?.id ?? "")));
    }).catch((e) => say(e.message, true));
    api.identity().then(({ identity, defaults }) => setIdent({ draft: identity, saved: identity, defaults })).catch((e) => say(e.message, true));
  }, [channelId]); // eslint-disable-line react-hooks/exhaustive-deps

  /** يحفظ فورًا أي تعديل ينتظر الحفظ التلقائي، حتى لا يكتب فوق خطة أحدث لاحقًا. */
  const flushPlan = useCallback(async () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = null;
    const p = pendingPlan.current;
    pendingPlan.current = null;
    if (!p) return;
    setPlanState("saving");
    try {
      await api.savePlan(p.ep, p.plan);
      setPlanState("saved");
    } catch (e) {
      setPlanState("error");
      say((e as Error).message, true);
    }
  }, []);

  const loadEpisode = useCallback(async (id: string, opts: { keepScript?: boolean } = {}) => {
    await flushPlan();
    api.episode(id).then((d) => {
      setPlan(d.plan);
      setChannel(d.channel);
      if (!(opts.keepScript && scriptDirtyRef.current)) {
        setScript(d.script);
        setSavedScript(d.script);
      }
      setCheck(d.check);
      setMedia(d.media);
      setExtra({ issues: d.issues, keys: d.keys });
      setPlanState("saved");
      // مرة لكل حلقة في الجلسة: جلب نصوص الآيات (والتلاوة إن اختيرت) تلقائيًا من Quran Foundation
      if (d.keys.quran && !quranSynced.current.has(`${id}`)) {
        quranSynced.current.add(`${id}`);
        api.quran(id).then((r) => {
          if (r.result?.failed?.length) say(`تعذّر جلب: ${r.result.failed.map((f) => `${f.ref} (${f.reason})`).join("، ")}`, true);
          return api.episode(id);
        }).then((n) => {
          setPlan(n.plan);
          setMedia(n.media);
          setExtra({ issues: n.issues, keys: n.keys });
        }).catch((e) => say(`تعذّر جلب الآيات: ${(e as Error).message}`, true));
      }
    }).catch((e) => say(e.message, true));
  }, [flushPlan]);
  useEffect(() => {
    if (!epId) return;
    store.set("bal-episode", epId);
    setPlan(null);
    loadEpisode(epId);
  }, [epId, channelId, loadEpisode]);
  useEffect(() => store.set("bal-tab", tab), [tab]);

  /** حفظ تلقائي للخطة بعد توقف التعديل */
  const onPlanChange = useCallback((p: Plan) => {
    setPlan(p);
    setPlanState("dirty");
    pendingPlan.current = { ep: epId, plan: p };
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void flushPlan(), 700);
  }, [epId, flushPlan]);

  const saveScript = async () => {
    // تعديلات المشاهد المعلّقة تُحفظ أولًا، ثم يعيد الخادم بناء الخطة مع إبقائها
    await flushPlan();
    let r;
    try {
      r = await api.saveScript(epId, script);
    } catch (e) {
      say(`تعذّر حفظ السكريبت: ${(e as Error).message}`, true);
      return;
    }
    setSavedScript(script);
    setCheck(r.check);
    setPlan(r.plan);
    setPlanState("saved");
    api.episode(epId).then((d) => { setMedia(d.media); setExtra({ issues: d.issues, keys: d.keys }); }).catch(() => {});
    say("حُفظ السكريبت وتحدّثت المشاهد مع إبقاء تعديلاتك");
  };

  const scriptDirty = script !== savedScript;
  scriptDirtyRef.current = scriptDirty;

  // تنبيه قبل إغلاق الصفحة إن بقي شيء غير محفوظ
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (scriptDirtyRef.current || pendingPlan.current) {
        void flushPlan();
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [flushPlan]);
  const confirmLeaveScript = () => !scriptDirty || window.confirm("في السكريبت تعديلات غير محفوظة ستضيع. هل تريد المتابعة؟");
  const identDirty = ident ? JSON.stringify(ident.draft) !== JSON.stringify(ident.saved) : false;

  if (!ident) return <div className="empty-state"><h2>جارٍ التحميل…</h2></div>;

  return (
    <IdentityProvider identity={ident.draft}>
      <ChannelProvider channel={channel}>
      <div className="app">
        <UpdateBanner beforeUpdate={flushPlan} hasUnsaved={scriptDirty || identDirty} />
        <header className="top">
          <button className="brand" onClick={() => setTab("home")} title="الرئيسية">
            <BrandMark channel={channel} />
            <span>استوديو {channel.name}</span>
          </button>
          {channels.length > 1 ? (
            <select id="channel-select" value={channelId || channels[0]?.id} onChange={async (e) => { if (!confirmLeaveScript()) return; await flushPlan(); setChannelId(e.target.value); }} style={{ width: 170 }} aria-label="القناة">
              {channels.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          ) : null}
          <nav className="tabs" role="tablist">
            <button role="tab" aria-selected={tab === "home"} onClick={() => setTab("home")}>الرئيسية</button>
          </nav>
          {EPISODE_TABS.includes(tab) ? (
            <select id="episode-select" value={epId} onChange={async (e) => { if (!confirmLeaveScript()) return; await flushPlan(); setEpId(e.target.value); }} style={{ width: 280 }} aria-label="الحلقة">
              {episodes?.length ? null : <option value="">لا توجد حلقات</option>}
              {episodes?.map((e) => <option key={e.id} value={e.id}>{e.id} · {e.title || e.dir}</option>)}
            </select>
          ) : null}
          <nav className="tabs" role="tablist" aria-label="الحلقة">
            <button role="tab" aria-selected={tab === "episode"} onClick={() => setTab("episode")}>المشاهد</button>
            <button role="tab" aria-selected={tab === "script"} onClick={() => setTab("script")}>السكريبت{scriptDirty ? " •" : ""}</button>
            <button role="tab" aria-selected={tab === "publish"} onClick={() => setTab("publish")}>النشر</button>
          </nav>
          <nav className="tabs" role="tablist" aria-label="القناة">
            <button role="tab" aria-selected={tab === "identity"} onClick={() => setTab("identity")}>الهوية{identDirty ? " •" : ""}</button>
            <button role="tab" aria-selected={tab === "library"} onClick={() => setTab("library")}>المكتبة</button>
            <button role="tab" aria-selected={tab === "channel"} onClick={() => setTab("channel")}>القناة</button>
            <button role="tab" aria-selected={tab === "settings"} onClick={() => setTab("settings")}>الإعدادات{keysOk.voice ? "" : " •"}</button>
          </nav>
          <span className="spacer" />
          {tab === "episode" && plan ? (
            <span className="status">
              <i className={`dot ${planState === "dirty" || planState === "saving" ? "dirty" : planState === "error" ? "err" : ""}`} />
              {planState === "saved" ? "كل التعديلات محفوظة" : planState === "saving" ? "جارٍ الحفظ…" : planState === "dirty" ? "تعديل…" : "تعذّر الحفظ"}
            </span>
          ) : null}
        </header>

        {tab === "home" ? (
          <HomeTab
            key={`${channelId}-${homeKey}`}
            channel={channel}
            onNew={() => setShowNew(true)}
            onOpen={(id, t) => {
              if (id !== epId && !confirmLeaveScript()) return;
              setEpId(id);
              setTab(t);
            }}
          />
        ) : tab === "library" ? (
          <LibraryTab hasVoiceKeys={keysOk.voice} />
        ) : tab === "channel" ? (
          <ChannelTab
            key={channelId}
            onSaved={() => {
              reloadChannels();
              if (epId) loadEpisode(epId, { keepScript: true });
            }}
            onCreated={async (id) => {
              await reloadChannels();
              setChannelId(id);
              setTab("home");
              say("أُنشئت القناة. عدّل مجالاتها وألوانها، ثم أنشئ أول حلقة.");
            }}
          />
        ) : tab === "settings" ? (
          <SettingsTab
            onKeysChanged={() => {
              reloadKeys();
              if (epId) loadEpisode(epId, { keepScript: true });
            }}
          />
        ) : tab === "identity" ? (
          <IdentityTab
            channel={channel}
            draft={ident.draft}
            saved={ident.saved}
            defaults={ident.defaults}
            onChange={(draft) => setIdent({ ...ident, draft })}
            onSave={async () => {
              try {
                await api.saveIdentity(ident.draft);
                setIdent({ ...ident, saved: ident.draft });
                say("حُفظت الهوية. الرندر القادم يستخدمها.");
              } catch (e) {
                say(`تعذّر حفظ الهوية: ${(e as Error).message}`, true);
              }
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
        ) : tab === "publish" ? (
          <PublishTab key={epId} episodeId={epId} hasVoiceKeys={keysOk.voice} onChanged={() => setHomeKey((k) => k + 1)} />
        ) : tab === "episode" ? (
          <EpisodeTab
            key={epId}
            episodeId={epId}
            plan={plan}
            identity={ident.draft}
            channel={channel}
            media={media}
            issues={extra.issues}
            keys={extra.keys}
            onMediaChange={setMedia}
            onReload={() => loadEpisode(epId, { keepScript: true })}
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
            domains={Object.entries(channels.find((c) => c.id === (channelId || channels[0]?.id))?.domains ?? defaultChannel.domains).map(([id, d]) => [id, d.name])}
            suggested={String((episodes?.reduce((m, e) => Math.max(m, Number(e.id)), 0) ?? 0) + 1).padStart(3, "0")}
            onClose={() => setShowNew(false)}
            onCreated={async (id) => {
              const list = await api.episodes();
              setEpisodes(list);
              setEpId(id);
              setShowNew(false);
              setTab("script");
              setHomeKey((k) => k + 1);
              say(`أُنشئت الحلقة ${id}`);
            }}
          />
        ) : null}
        {toast ? <div className={`toast ${toast.err ? "err" : ""}`} role="status">{toast.msg}</div> : null}
      </div>
      </ChannelProvider>
    </IdentityProvider>
  );
};

const NewEpisode: React.FC<{ domains: [string, string][]; suggested: string; onClose: () => void; onCreated: (id: string) => void }> = ({ domains, suggested, onClose, onCreated }) => {
  const [episode, setEpisode] = useState(suggested);
  const [slug, setSlug] = useState("");
  const [domain, setDomain] = useState(domains[0]?.[0] ?? "");
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

/** رمز القناة في رأس الاستوديو بألوان ثيمها الأساسي. */
const BrandMark: React.FC<{ channel: ChannelInfo }> = () => {
  const t = useTheme("warm");
  return <ChannelLogo theme={t} size={34} />;
};
