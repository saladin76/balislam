import { UpdateBanner } from "./ui/UpdateBanner";
import { StudioSidebar, StudioIcon, SECTION_TITLES, type StudioSection } from "./ui/StudioSidebar";
import "./studio-shell.css";
import { StudioStartGuide } from "./ui/StudioStartGuide";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { IdentityProvider, type Identity } from "../../brand/identity/index";
import type { Plan } from "../../src/plan/types";
import { planIssues } from "../../src/plan/validate";
import { api, setApiChannel, type ChannelSummary, type CheckResult, type EpisodeData, type EpisodeSummary } from "./api";
import { channelInfo, defaultChannel, type ChannelInfo } from "../../src/channel/types";
import { emptyMedia, type EpisodeMedia } from "../../src/plan/media";
import { EpisodeTab } from "./tabs/EpisodeTab";
import { StoryboardPanel } from "./tabs/StoryboardPanel";
import { EpisodeWorkspaceBar, type WorkspaceStage } from "./workspace/EpisodeWorkspaceBar";
import { VoiceWorkspaceTab } from "./workspace/VoiceWorkspaceTab";
import "./workspace/workspace.css";
import { ScriptTab, type ScriptTabHandle, type ResearchDraft } from "./tabs/ScriptTab";
import { IdentityTab } from "./tabs/IdentityTab";
import { HomeTab } from "./tabs/HomeTab";
import { OpsRoom } from "./tabs/OpsRoom";
import { ChannelsWorkspace } from "./tabs/ChannelsWorkspace";
import { IntegratedReviewWorkspace } from "./workspace/IntegratedReviewWorkspace";
import { PublishTab } from "./tabs/PublishTab";
import { LibraryTab } from "./tabs/LibraryTab";
import { ChannelTab } from "./tabs/ChannelTab";
import { useStudioFonts } from "./ui/useStudioFonts";
import { SettingsTab } from "./tabs/SettingsTab";
import { GuideTab } from "./tabs/GuideTab";
import { LabsTab } from "./tabs/LabsTab";
import { TechReviewsTab } from "./tabs/TechReviewsTab";
import { ChannelLogo, ChannelProvider } from "../../src/channel/context";
import { useTheme } from "../../brand/identity/index";

type Tab = StudioSection;
const EPISODE_TABS: Tab[] = ["research", "script", "storyboard", "voice", "episode", "review", "publish"];
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
  useStudioFonts();
  const [navOpen, setNavOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const [tab, setTab] = useState<Tab>((store.get("bal-tab") as Tab) || "home");
  const [keysOk, setKeysOk] = useState({ voice: false, quran: false });
  const [homeKey, setHomeKey] = useState(0);
  const [channels, setChannels] = useState<ChannelSummary[]>([]);
  const [channelId, setChannelId] = useState<string>(() => {
    const c = store.get("bal-channel") || "";
    setApiChannel(c);
    return c;
  });
  // القناة الحالية لطلبات الواجهة تُضبط أثناء الرسم لا في useEffect: تأثيرات الأبناء (مثل تحميل إعدادات القناة)
  // تعمل قبل تأثير الأب، فكانت تجلب بيانات القناة السابقة بعد التبديل
  if (channelId) setApiChannel(channelId);
  // دليل الاستوديو: يظهر في القائمة فقط للقناة التي لها دليل (docs/<القناة>/guide.json)
  const [hasGuide, setHasGuide] = useState(false);
  const [guideLabel, setGuideLabel] = useState("دليل الاستوديو");
  // مختبرات الإنتاج: تظهر في القائمة فقط للقناة التي لها مختبر (مجلد فيه lab.json)
  const [hasLabs, setHasLabs] = useState(false);
  // المراجعات الفنية: تظهر فقط للقناة التي فيها مراجعة (tech-reviews/)
  const [hasTechReviews, setHasTechReviews] = useState(false);
  useEffect(() => {
    if (!channelId) return setHasGuide(false), setHasLabs(false), setHasTechReviews(false);
    let live = true;
    api.guideIndex(channelId).then((r) => { if (!live) return; setHasGuide(Boolean(r.index)); setGuideLabel(r.index?.navLabel || "دليل الاستوديو"); }, () => live && setHasGuide(false));
    api.labs(channelId).then((r) => live && setHasLabs(r.labs.length > 0), () => live && setHasLabs(false));
    api.techReviews(channelId).then((r) => live && setHasTechReviews(r.reviews.length > 0), () => live && setHasTechReviews(false));
    return () => {
      live = false;
    };
  }, [channelId]);
  const channelRef = useRef(channelId);
  channelRef.current = channelId;
  const [channel, setChannel] = useState<ChannelInfo>(channelInfo(defaultChannel));
  const [episodes, setEpisodes] = useState<EpisodeSummary[] | null>(null);
  const [epId, setEpId] = useState<string>(store.get("bal-episode") || "");
  const episodeRef = useRef(epId);
  episodeRef.current = epId;
  const [requestedSceneId, setRequestedSceneId] = useState<string | undefined>();
  useEffect(() => setRequestedSceneId(undefined), [channelId, epId]);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [episodeLoadError, setEpisodeLoadError] = useState("");
  const [script, setScript] = useState("");
  const [savedScript, setSavedScript] = useState("");
  const [researchDirty, setResearchDirty] = useState(false);
  const [check, setCheck] = useState<CheckResult | null>(null);
  const [media, setMedia] = useState<EpisodeMedia>(emptyMedia);
  const [extra, setExtra] = useState<Pick<EpisodeData, "issues" | "keys">>({ issues: [], keys: { voice: false, quran: false } });
  const [planState, setPlanState] = useState<"saved" | "dirty" | "saving" | "error">("saved");
  const [ident, setIdent] = useState<{ draft: Identity; saved: Identity; defaults: Identity } | null>(null);
  const [toast, setToast] = useState<{ msg: string; err?: boolean } | null>(null);
  const [showNew, setShowNew] = useState(false);
  /** فكرة من بنك الأفكار تتحول حلقة: تملأ نموذج الحلقة الجديدة */
  const [newPrefill, setNewPrefill] = useState<{ channel: string; title: string; domain?: string; suggested: string; ideaId: string } | null>(null);
  /** فتح حلقة في قناة أخرى من غرفة العمليات: يُطبَّق بعد تحميل حلقات القناة */
  const pendingOpen = useRef<{ ep: string; tab: Tab } | null>(null);
  const loadedKey = useRef("");
  /** القناة التي تخصها قائمة الحلقات المعروضة */
  const episodesOf = useRef("");
  const scriptRef = useRef<ScriptTabHandle>(null);
  /** Unsaved text is kept by channel/episode through in-app navigation, never in production files. */
  const scriptDrafts = useRef(new Map<string, { text: string; saved: string }>());
  const researchDrafts = useRef(new Map<string, ResearchDraft>());
  const identityDrafts = useRef(new Map<string, { draft: Identity; saved: Identity; defaults: Identity }>());
  const sessionKey = `${channelId}/${epId}`;
  const onResearchDraftChange = useCallback((draft: ResearchDraft) => {
    researchDrafts.current.set(`${channelId}/${epId}`, draft);
    setResearchDirty(draft.text !== draft.saved);
  }, [channelId, epId]);
  useEffect(() => {
    const saved = researchDrafts.current.get(`${channelId}/${epId}`);
    setResearchDirty(Boolean(saved && saved.text !== saved.saved));
  }, [channelId, epId]);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** آخر خطة لم تُحفظ بعد (تنتظر مؤقت الحفظ التلقائي) */
  const pendingPlan = useRef<{ ep: string; channel: string; plan: Plan } | null>(null);
  const savingPlan = useRef<Promise<boolean> | null>(null);
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
    setEpisodeLoadError("");
    setIdent(null); // Never show another channel's identity while this one loads.
    loadedKey.current = "";
    episodesOf.current = "";
    const ch = channelId;
    api.episodes().then((list) => {
      if (channelRef.current !== ch) return;
      episodesOf.current = ch;
      setEpisodes(list);
      const want = pendingOpen.current;
      pendingOpen.current = null;
      if (want && list.some((e) => e.id === want.ep)) {
        setEpId(want.ep);
        setTab(want.tab);
      } else setEpId((cur) => (list.some((e) => e.id === cur) ? cur : (list[0]?.id ?? "")));
    }).catch((e) => say(e.message, true));
    api.identity().then(({ identity, defaults }) => {
      if (channelRef.current !== ch) return;
      const prior = identityDrafts.current.get(ch);
      const dirty = prior && JSON.stringify(prior.draft) !== JSON.stringify(prior.saved);
      setIdent({ draft: dirty ? prior.draft : identity, saved: identity, defaults });
    }).catch((e) => { if (channelRef.current === ch) say(e.message, true); });
    // بيانات القناة نفسها (الاسم والشعار والقواعد) حتى بلا حلقات، فلا يبقى الاستوديو على قناة سابقة
    if (channelId) api.channel().then((c) => {
      if (channelRef.current === ch) setChannel(channelInfo(c));
    }).catch((e) => { if (channelRef.current === ch) say(e.message, true); });
  }, [channelId]); // eslint-disable-line react-hooks/exhaustive-deps

  /** يحفظ فورًا أي تعديل ينتظر الحفظ التلقائي، حتى لا يكتب فوق خطة أحدث لاحقًا. */
  const flushPlan = useCallback(async (): Promise<boolean> => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = null;
    if (savingPlan.current && !(await savingPlan.current)) return false;
    const p = pendingPlan.current;
    if (!p) return true;
    pendingPlan.current = null;
    setPlanState("saving");
    const work = api.savePlanFor(p.ep, p.plan, p.channel).then(() => {
      if (!pendingPlan.current) setPlanState("saved");
      return true;
    }).catch((e: unknown) => {
      if (!pendingPlan.current) pendingPlan.current = p; // Never lose an unsaved plan on failure.
      setPlanState("error");
      say("فشل حفظ الخطة، ولن نغادر حتى ينجح الحفظ: " + (e as Error).message, true);
      return false;
    });
    savingPlan.current = work;
    const ok = await work;
    if (savingPlan.current === work) savingPlan.current = null;
    return ok;
  }, []);

  const loadEpisode = useCallback(async (id: string, opts: { keepScript?: boolean } = {}) => {
    // Keep the previous draft, but never show stale approval/data from another episode.
    const ch = channelRef.current;
    setEpisodeLoadError("");
    if (!(await flushPlan())) return;
    if (channelRef.current !== ch || episodeRef.current !== id) return;
    api.episode(id, ch).then((d) => {
      if (channelRef.current !== ch || episodeRef.current !== id) return;
      setPlan(d.plan);
      setChannel(d.channel);
      if (!(opts.keepScript && scriptDirtyRef.current)) {
        const draft = scriptDrafts.current.get(`${ch}/${id}`);
        setScript(draft && draft.text !== draft.saved ? draft.text : d.script);
        setSavedScript(d.script);
      }
      setCheck(d.check);
      setMedia(d.media);
      setExtra({ issues: d.issues, keys: d.keys });
      setPlanState("saved");
      // مرة لكل حلقة في الجلسة: جلب نصوص الآيات (والتلاوة إن اختيرت) تلقائيًا من Quran Foundation
      if (d.keys.quran && !quranSynced.current.has(`${channelId}:${id}`)) {
        quranSynced.current.add(`${channelId}:${id}`);
        api.quran(id, ch).then((r) => {
          if (r.result?.failed?.length) say(`تعذّر جلب: ${r.result.failed.map((f) => `${f.ref} (${f.reason})`).join("، ")}`, true);
          return api.episode(id, ch);
        }).then((n) => {
          if (channelRef.current !== ch || episodeRef.current !== id) return;
          setPlan(n.plan);
          setMedia(n.media);
          setExtra({ issues: n.issues, keys: n.keys });
        }).catch((e) => say(`تعذّر جلب الآيات: ${(e as Error).message}`, true));
      }
    }).catch((e) => {
      if (channelRef.current !== ch || episodeRef.current !== id) return;
      setEpisodeLoadError((e as Error).message);
      loadedKey.current = "";
      say((e as Error).message, true);
    });
  }, [flushPlan, channelId]);
  // تُحمَّل الحلقة بعد وصول قائمة حلقات القناة الحالية فقط، فلا تُطلب حلقة القناة السابقة بعد التبديل
  useEffect(() => {
    if (!epId || episodesOf.current !== channelId || !episodes?.some((e) => e.id === epId)) return;
    const key = `${channelId}/${epId}`;
    if (loadedKey.current === key) return;
    loadedKey.current = key;
    store.set("bal-episode", epId);
    setPlan(null);
    loadEpisode(epId);
  }, [epId, channelId, episodes, loadEpisode]);
  useEffect(() => store.set("bal-tab", tab), [tab]);

  /** حفظ تلقائي للخطة بعد توقف التعديل */
  const onPlanChange = useCallback((p: Plan) => {
    setPlan(p);
    setPlanState("dirty");
    pendingPlan.current = { ep: epId, channel: channelId, plan: p };
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void flushPlan(), 700);
  }, [epId, channelId, flushPlan]);

  const saveScript = async () => {
    // Preserve edits typed while a save is in flight; do not rebind the reply to another episode.
    const snapshot = script, ch = channelId, episode = epId;
    if (!(await flushPlan())) return;
    let r;
    try {
      r = await api.saveScript(episode, snapshot);
    } catch (e) {
      say(`تعذّر حفظ السكريبت: ${(e as Error).message}`, true);
      return;
    }
    scriptDrafts.current.set(`${ch}/${episode}`, {
      text: scriptDrafts.current.get(`${ch}/${episode}`)?.text ?? snapshot, saved: snapshot,
    });
    if (channelRef.current === ch && episodeRef.current === episode) {
      setSavedScript(snapshot);
      setCheck(r.check);
      setPlan(r.plan);
      setPlanState("saved");
      api.episode(episode, ch).then((d) => {
        if (channelRef.current === ch && episodeRef.current === episode) {
          setMedia(d.media); setExtra({ issues: d.issues, keys: d.keys });
        }
      }).catch(() => {});
      say("حُفظ السكريبت وتحدّثت المشاهد مع إبقاء تعديلاتك");
    }
  };

  const scriptDirty = script !== savedScript;
  scriptDirtyRef.current = scriptDirty;

  // تنبيه قبل إغلاق الصفحة إن بقي شيء غير محفوظ
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (scriptDirtyRef.current || researchDirty || pendingPlan.current ||
          [...scriptDrafts.current.values()].some((d) => d.text !== d.saved) ||
          [...researchDrafts.current.values()].some((d) => d.text !== d.saved) ||
          [...identityDrafts.current.values()].some((d) => JSON.stringify(d.draft) !== JSON.stringify(d.saved)) ||
          Boolean(savingPlan.current) || planState !== "saved") {
        // beforeunload لا يضمن إكمال أي طلب شبكة؛ لا نَعِد المستخدم بحفظ غير مؤكد.
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [researchDirty, planState, ident]);
  // Navigating between workspaces cannot discard an unsaved script or research draft.
  // Both are restored from the per-channel, per-episode in-memory maps on return.
  const confirmLeaveScript = () => true;
  const identDirty = ident ? JSON.stringify(ident.draft) !== JSON.stringify(ident.saved) : false;

  const navigateManage = async (next: Tab) => {
    if (!next || !confirmLeaveScript()) return;
    if (!(await flushPlan())) return;
    setTab(next);
    setNavOpen(false);
    if (navOpen) menuButton.current?.focus();
  };
  const closeNavigation = () => { setNavOpen(false); menuButton.current?.focus(); };
  useEffect(() => {
    if (navOpen && window.matchMedia("(max-width: 880px)").matches) {
      document.querySelector<HTMLButtonElement>(".studio-close-nav")?.focus();
    }
  }, [navOpen]);
  const trapMobileNavigation = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!navOpen) return;
    if (event.key === "Escape") { event.preventDefault(); closeNavigation(); return; }
    if (event.key !== "Tab" || !window.matchMedia("(max-width: 880px)").matches) return;
    const focusable = [...document.querySelectorAll<HTMLElement>(".studio-sidebar button:not([disabled]), .studio-sidebar a[href]")]
      .filter((item) => item.getClientRects().length > 0);
    if (!focusable.length) return;
    const first = focusable[0]!, last = focusable[focusable.length - 1]!;
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };

  if (!ident) return <div className="empty-state"><h2>جارٍ التحميل…</h2></div>;

  return (
    <IdentityProvider identity={ident.draft}>
      <ChannelProvider channel={channel}>
      <div className={`studio-shell${navOpen ? " is-nav-open" : ""}`} onKeyDown={trapMobileNavigation}>
      <StudioSidebar
        active={tab} channelName={channel.nameDisplay ?? channel.name} channelMark={<BrandMark channel={channel} />}
        hasGuide={hasGuide} guideLabel={guideLabel} hasLabs={hasLabs} hasTechReviews={hasTechReviews}
        identityDirty={identDirty} voiceConnected={keysOk.voice} episodeId={epId} episodeTitle={plan?.title}
        onHome={() => void navigateManage("home")}
        onNavigate={navigateManage} onClose={closeNavigation}
      />
      {navOpen && <button className="studio-nav-scrim" type="button" aria-label="إغلاق قائمة التنقل" onClick={closeNavigation} />}
      <div className={`app studio-main${EPISODE_TABS.includes(tab) && plan && check && epId ? " episode-workspace-app" : ""}`}>
        <UpdateBanner beforeUpdate={async () => { if (!(await flushPlan())) throw new Error("تعذر حفظ الخطة؛ لن يُحدّث الاستوديو."); }} hasUnsaved={scriptDirty || researchDirty || identDirty ||
          [...scriptDrafts.current.values()].some((d) => d.text !== d.saved) ||
          [...researchDrafts.current.values()].some((d) => d.text !== d.saved) ||
          [...identityDrafts.current.values()].some((d) => JSON.stringify(d.draft) !== JSON.stringify(d.saved)) ||
          Boolean(pendingPlan.current) || Boolean(savingPlan.current) || planState !== "saved"} />
        <header className="top studio-topbar">
          <button ref={menuButton} type="button" className="studio-menu-toggle" aria-label="فتح قائمة التنقل" aria-expanded={navOpen} aria-controls="studio-navigation" onClick={() => setNavOpen((open) => !open)}><StudioIcon name="menu" /></button>
          <div className="studio-page-heading"><span>الاستوديو <i aria-hidden="true">/</i> {channel.name}</span><strong>{tab === "guide" ? guideLabel : SECTION_TITLES[tab] ?? "الاستوديو"}</strong></div>
          <div className="studio-topbar-controls">
          {channels.length > 1 ? (
            <label className="studio-context-select"><span>القناة النشطة</span><select id="channel-select" value={channelId || channels[0]?.id} onChange={async (e) => { const next = e.target.value; if (!confirmLeaveScript() || !(await flushPlan())) return; setChannelId(next); }} aria-label="القناة">
              {channels.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select></label>
          ) : null}
          {EPISODE_TABS.includes(tab) ? (
            <label className="studio-context-select studio-episode-select"><span>الحلقة الحالية</span><select id="episode-select" value={epId} onChange={async (e) => { if (!confirmLeaveScript() || !(await flushPlan())) return; setEpId(e.target.value); }} aria-label="الحلقة">
              {episodes?.length ? null : <option value="">لا توجد حلقات</option>}
              {episodes?.map((e) => <option key={e.id} value={e.id}>{e.id} · {e.title || e.dir}</option>)}
            </select></label>
          ) : null}
          {tab === "episode" && plan ? (
            <span className="status">
              <i className={`dot ${planState === "dirty" || planState === "saving" ? "dirty" : planState === "error" ? "err" : ""}`} />
              {planState === "saved" ? "كل التعديلات محفوظة" : planState === "saving" ? "جارٍ الحفظ…" : planState === "dirty" ? "تعديل…" : "تعذّر الحفظ"}
            </span>
          ) : null}
          </div>
        </header>

        {EPISODE_TABS.includes(tab) && plan && check && epId ? (
           <EpisodeWorkspaceBar
             key={`${channelId}:${epId}`}
             episodeId={epId}
             channelId={channelId}
             title={plan.title}
             stage={tab as WorkspaceStage}
             onStage={(stage, target) => {
               void (async () => {
                 if (stage !== tab && (!confirmLeaveScript() || !(await flushPlan()))) return;
                 if (target?.sceneId && stage === "episode") setRequestedSceneId(target.sceneId);
                 setTab(stage);
                 if (target?.line && stage === "script") {
                   setTimeout(() => scriptRef.current?.goToLine(target.line!), 50);
                 }
               })();
             }}
             check={check}
             issues={planIssues(plan, channel)}
             plan={plan}
             media={media}
             saveState={planState}
             scriptDirty={scriptDirty}
             researchDirty={researchDirty}
           />
         ) : null}

         {tab === "ops" ? (
          <div className="home-wrap studio-ops-workspace">
            <OpsRoom
            refreshKey={homeKey}
            onOpen={async (ch, id, t) => {
              if (ch === (channelId || channels[0]?.id)) {
                if (id !== epId && (!confirmLeaveScript() || !(await flushPlan()))) return;
                setEpId(id);
                setTab(t);
                return;
              }
              if (!confirmLeaveScript()) return;
              if (!(await flushPlan())) return;
              pendingOpen.current = { ep: id, tab: t };
              setChannelId(ch);
            }}
            onStartIdea={async (ch, idea, suggested) => {
              if (ch !== (channelId || channels[0]?.id)) {
                if (!confirmLeaveScript()) return;
                if (!(await flushPlan())) return;
                setChannelId(ch);
              }
              setNewPrefill({ channel: ch, title: idea.title, domain: idea.domain, suggested, ideaId: idea.id });
              setShowNew(true);
            }}
          />
          </div>
        ) : tab === "channels" ? (
          <ChannelsWorkspace channels={channels} activeId={channelId || channels[0]?.id || ""} onRetry={() => void reloadChannels()} onOpen={async (id, destination) => {
            if (!confirmLeaveScript()) return;
            if (!(await flushPlan())) return;
            if (id !== channelId) setChannelId(id);
            setTab(destination);
          }} />
        ) : tab === "home" ? (
          <div className="home-wrap studio-episodes-workspace">
            <StudioStartGuide />
            <h2 className="home-sub">حلقات قناة «{channel.name}»</h2>
          <HomeTab
            key={`${channelId}-${homeKey}`}
            channel={channel}
            onNew={() => setShowNew(true)}
            onDeleted={(id) => {
              // الحلقة المحذوفة لا تبقى مفتوحة ولا في القائمة
              api.episodes().then((list) => {
                setEpisodes(list);
                if (id === epId) {
                  loadedKey.current = "";
                  setPlan(null);
                  setEpId(list[0]?.id ?? "");
                }
              }).catch(() => {});
            }}
            onOpen={(id, t) => {
              void (async () => {
                if (id !== epId && (!confirmLeaveScript() || !(await flushPlan()))) return;
                setEpId(id);
                setTab(t);
              })();
            }}
          />
          
          </div>
        ) : tab === "treviews" && channelId ? (
          <TechReviewsTab key={channelId} channel={channelId} />
        ) : tab === "labs" && channelId ? (
          <LabsTab key={channelId} channel={channelId} />
        ) : tab === "guide" && channelId ? (
          <GuideTab key={channelId} channel={channelId} />
        ) : tab === "library" ? (
          <LibraryTab hasVoiceKeys={keysOk.voice} identity={ident?.draft} channel={channel} />
        ) : tab === "channel" ? (
          <ChannelTab
            key={channelId}
            identity={ident?.draft}
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
            onChange={(draft) => {
              const next = { ...ident, draft };
              identityDrafts.current.set(channelId, next);
              setIdent(next);
            }}
            onSave={async () => {
              try {
                await api.saveIdentity(ident.draft);
                const next = { ...ident, saved: ident.draft };
                identityDrafts.current.set(channelId, next);
                setIdent(next);
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
          <div className="empty-state" role={episodeLoadError ? "alert" : "status"}>
            <h2>{episodeLoadError ? "تعذّر فتح الحلقة" : "جارٍ فتح الحلقة…"}</h2>
            {episodeLoadError ? <><p>{episodeLoadError}</p>
              <button className="btn primary" type="button" onClick={() => { if (epId) { loadedKey.current = `${channelId}/${epId}`; void loadEpisode(epId, { keepScript: true }); } }}>إعادة المحاولة</button></> : null}
          </div>
        ) : tab === "storyboard" ? (
          <div className="ew-storyboard-wrap"><StoryboardPanel
            key={`${channelId}:${epId}`}
            episodeId={epId}
            plan={plan}
            identity={ident.draft}
            channel={channel}
            media={media}
            onOpenScene={(id) => { setRequestedSceneId(id); setTab("episode"); }}
            onReload={() => loadEpisode(epId, { keepScript: true })}
          /></div>
        ) : tab === "voice" ? (
          <VoiceWorkspaceTab
            channelId={channelId}
            episodeId={epId}
            plan={plan}
            media={media}
            hasKeys={extra.keys.voice}
            onMedia={setMedia}
            onOpenScene={(id) => { setRequestedSceneId(id); setTab("episode"); }}
          />
        ) : tab === "review" ? (
          <IntegratedReviewWorkspace key={`${channelId}:${epId}`} episodeId={epId} channelId={channelId}
             hasUnsavedChanges={scriptDirty || researchDirty || planState !== "saved" || Boolean(pendingPlan.current)} onOpen={(stage, sceneId) => {
            if (!confirmLeaveScript()) return;
            if (stage === "episode" && sceneId) setRequestedSceneId(sceneId);
            setTab(stage);
          }} />
        ) : tab === "publish" ? (
          <PublishTab key={epId} episodeId={epId} hasVoiceKeys={keysOk.voice} onChanged={() => setHomeKey((k) => k + 1)} />
        ) : tab === "episode" ? (
          <EpisodeTab
            key={epId}
            episodeId={epId}
            requestedSceneId={requestedSceneId}
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
            onOpenVoice={() => setTab("voice")}
          />
        ) : (
          <ScriptTab key={`${channelId}:${epId}:${tab}`} ref={scriptRef} episodeId={epId} initialDoc={tab === "research" ? "research" : "script"} workspaceMode onOpenScriptLine={(line) => { if (!confirmLeaveScript()) return; setTab("script"); setTimeout(() => scriptRef.current?.goToLine(line), 50); }} researchDraft={researchDrafts.current.get(sessionKey) ?? null} onResearchDraftChange={onResearchDraftChange}
             onResearchDirtyChange={setResearchDirty} text={script} savedText={savedScript} check={check}
             onChange={(next) => {
               scriptDrafts.current.set(sessionKey, { text: next, saved: savedScript });
               setScript(next);
             }} onSave={saveScript} />
        )}

        {showNew ? (
          <NewEpisode
            domains={Object.entries(channels.find((c) => c.id === (channelId || channels[0]?.id))?.domains ?? defaultChannel.domains).map(([id, d]) => [id, d.name])}
            suggested={newPrefill?.suggested ?? String((episodes?.reduce((m, e) => Math.max(m, Number(e.id)), 0) ?? 0) + 1).padStart(3, "0")}
            initialTitle={newPrefill?.title}
            initialDomain={newPrefill?.domain}
            onClose={() => {
              setShowNew(false);
              setNewPrefill(null);
            }}
            onCreated={async (id) => {
              // الفكرة صارت حلقة: تُرفع من بنك الأفكار
              if (newPrefill) {
                const pre = newPrefill;
                setNewPrefill(null);
                const ops = await api.ops().catch(() => []);
                const ideas = ops.find((o) => o.channel.id === pre.channel)?.ideas;
                if (ideas) await api.saveIdeas(pre.channel, ideas.filter((x) => x.id !== pre.ideaId)).catch(() => {});
              }
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
      </div>
      </ChannelProvider>
    </IdentityProvider>
  );
};

const NewEpisode: React.FC<{ domains: [string, string][]; suggested: string; initialTitle?: string; initialDomain?: string; onClose: () => void; onCreated: (id: string) => void }> = ({ domains, suggested, initialTitle, initialDomain, onClose, onCreated }) => {
  const [episode, setEpisode] = useState(suggested);
  const [slug, setSlug] = useState("");
  const [domain, setDomain] = useState(initialDomain && domains.some(([d]) => d === initialDomain) ? initialDomain : (domains[0]?.[0] ?? ""));
  const [title, setTitle] = useState(initialTitle ?? "");
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

