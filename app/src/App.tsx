import { UpdateBanner } from "./ui/UpdateBanner";
import { SECTION_TITLES, type StudioSection } from "./ui/StudioSidebar";
import "./studio-shell.css";
import "./shell/shell.css";
import { TopBar, type HeaderView } from "./shell/TopBar";
import { Band, type ManageItem } from "./shell/Band";
import { EpisodeSpine, STEPS, stepOf, stepsDone, type StepTab } from "./shell/EpisodeSpine";
import { useColorScheme } from "./ui/colorScheme";
import { episodeLength } from "../../src/plan/episodeLength";
import { duration, episodeTitle, num } from "./ui/format";
import config from "../../config.json";
import { LOCK_COPY, LockedStep, lockedStep, nextAction } from "./shell/LockedStep";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { IdentityProvider, type Identity } from "../../brand/identity/index";
import type { Plan } from "../../src/plan/types";
import { api, setApiChannel, type ChannelSummary, type CheckResult, type EpisodeData, type EpisodeSummary, type SceneProductionRead } from "./api";
import { scriptSaveMessage } from "./planGuard";
import { channelInfo, defaultChannel, type ChannelInfo } from "../../src/channel/types";
import { emptyMedia, type EpisodeMedia } from "../../src/plan/media";
import { EpisodeTab, SceneLivePreview } from "./tabs/EpisodeTab";
import { SceneThumb } from "./tabs/StoryboardPanel";
import { StoryboardPanel } from "./tabs/StoryboardPanel";
import { VoiceWorkspaceTab } from "./workspace/VoiceWorkspaceTab";
import { SceneProductionPanel } from "./workspace/SceneProductionPanel";
import { PreFinalPanel } from "./workspace/PreFinal";
import "./workspace/workspace.css";
import { ScriptTab, type ScriptTabHandle } from "./tabs/ScriptTab";
import { IdentityTab } from "./tabs/IdentityTab";
import { HomeTab } from "./tabs/HomeTab";
import { OpsRoom } from "./tabs/OpsRoom";
import { ChannelsWorkspace } from "./tabs/ChannelsWorkspace";
import { IntegratedReviewWorkspace } from "./workspace/IntegratedReviewWorkspace";
import { PublishTab } from "./tabs/PublishTab";
import { LibraryTab } from "./tabs/LibraryTab";
import { ChannelTab } from "./tabs/ChannelTab";
import { useStudioFonts } from "./ui/useStudioFonts";
import { Dialog } from "./ui/Dialog";
import { SettingsTab } from "./tabs/SettingsTab";
import { GuideTab } from "./tabs/GuideTab";
import { LabsTab } from "./tabs/LabsTab";
import { TechReviewsTab } from "./tabs/TechReviewsTab";
import { ChannelProvider } from "../../src/channel/context";
import { parseStudioHash, studioHash } from "./shell/route";

type Tab = StudioSection;
type FinalView = "recitations" | "seams" | "master";
/** The link the Studio was opened with (audit item 18) wins over the last place remembered locally. */
const bootRoute = typeof window === "undefined" ? {} : parseStudioHash(window.location.hash);
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
  const { scheme, toggle: toggleScheme } = useColorScheme();
  /** Views inside a step (direction D, the floating pill): the scenes one by one or those needing a fix; step ٣'s three. */
  const [sceneView, setSceneView] = useState<"one" | "fix">("one");
  const [finalView, setFinalView] = useState<FinalView | null>(null);
  const [tab, setTab] = useState<Tab>(bootRoute.tab ?? ((store.get("bal-tab") as Tab) || "home"));
  /** The episode step that opened «الإعدادات» (audit item 14): the settings page offers to go back to it. */
  const [settingsReturn, setSettingsReturn] = useState<Tab | null>(null);
  const openSettings = () => { if (EPISODE_TABS.includes(tab)) setSettingsReturn(tab); setTab("settings"); };
  const [keysOk, setKeysOk] = useState({ voice: false, quran: false });
  const [homeKey, setHomeKey] = useState(0);
  const [channels, setChannels] = useState<ChannelSummary[]>([]);
  const [channelId, setChannelId] = useState<string>(() => {
    const c = bootRoute.channel ?? (store.get("bal-channel") || "");
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
  const [epId, setEpId] = useState<string>(bootRoute.episode ?? (store.get("bal-episode") || ""));
  const episodeRef = useRef(epId);
  episodeRef.current = epId;
  const [requestedSceneId, setRequestedSceneId] = useState<string | undefined>();
  useEffect(() => { setRequestedSceneId(undefined); setSceneView("one"); setFinalView(null); }, [channelId, epId]);
  /** The ledger read by the spine: a locked step renders one `LockedStep` (D52). */
  const [ledger, setLedger] = useState<{ key: string; w: SceneProductionRead | null } | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
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
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** آخر خطة لم تُحفظ بعد (تنتظر مؤقت الحفظ التلقائي) */
  const pendingPlan = useRef<{ ep: string; plan: Plan } | null>(null);
  /** نص السكريبت غير المحفوظ (لا يُستبدل عند إعادة تحميل الحلقة) */
  const scriptDirtyRef = useRef(false);

  const say = (msg: string, err = false) => {
    setToast({ msg, err });
    setTimeout(() => setToast(null), 2600);
  };

  const reloadChannels = useCallback(() => api.channels().then(setChannels).catch((e) => say(e.message, true)), []);
  const reloadKeys = useCallback(
    () =>
      api.keys().then(({ keys }) => setKeysOk({ voice: Boolean(keys.ELEVENLABS_API_KEY?.set && keys.ELEVENLABS_VOICE_ID?.set), quran: false })).catch(() => {}),
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
      if (channelRef.current === ch) setIdent({ draft: identity, saved: identity, defaults });
    }).catch((e) => { if (channelRef.current === ch) say(e.message, true); });
    // بيانات القناة نفسها (الاسم والشعار والقواعد) حتى بلا حلقات، فلا يبقى الاستوديو على قناة سابقة
    if (channelId) api.channel().then((c) => {
      if (channelRef.current === ch) setChannel(channelInfo(c));
    }).catch((e) => { if (channelRef.current === ch) say(e.message, true); });
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
    // الحلقة تخص القناة الحالية لحظة الطلب؛ إن تبدّلت القناة أثناء الحفظ يُلغى التحميل
    const ch = channelRef.current;
    await flushPlan();
    if (channelRef.current !== ch || episodeRef.current !== id) return;
    api.episode(id, ch).then((d) => {
      if (channelRef.current !== ch || episodeRef.current !== id) return;
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

    }).catch((e) => say(e.message, true));
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
  // The address bar always names the current channel, episode and step (a link the owner can keep).
  useEffect(() => {
    const ch = channelId || channels[0]?.id || "";
    const next = studioHash({ channel: ch, episode: epId, tab });
    if (!next || window.location.hash === next) return;
    try { window.history.replaceState(null, "", next); } catch { /* not critical */ }
  }, [channelId, channels, epId, tab]);

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
    // خطة مصمَّمة: لم تُلمس، وتُذكر المشاهد التي اختلف نصها عن السكريبت
    const note = scriptSaveMessage(r);
    say(note.msg, note.warn);
  };

  const scriptDirty = script !== savedScript;
  scriptDirtyRef.current = scriptDirty;

  // تنبيه قبل إغلاق الصفحة إن بقي شيء غير محفوظ
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (scriptDirtyRef.current || researchDirty || pendingPlan.current) {
        // beforeunload لا يضمن إكمال أي طلب شبكة؛ لا نَعِد المستخدم بحفظ غير مؤكد.
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [researchDirty]);
  const confirmLeaveScript = () => {
    if (scriptDirty && !window.confirm("في السكريبت تعديلات غير محفوظة. هل تريد مغادرة المحرر؟")) return false;
    if (scriptRef.current?.hasUnsavedResearch() && !window.confirm("في ملف البحث تعديلات غير محفوظة ستضيع. هل تريد المتابعة؟")) return false;
    return true;
  };
  const identDirty = ident ? JSON.stringify(ident.draft) !== JSON.stringify(ident.saved) : false;

  // A pasted or edited link opens its place in this tab (same leave-checks as any navigation).
  const onHash = useRef<() => void>(() => {});
  onHash.current = () => {
    const r = parseStudioHash(window.location.hash);
    if (!r.channel) return;
    const want = { ep: r.episode ?? epId, tab: r.tab ?? tab };
    if (want.ep === epId && want.tab === tab && r.channel === (channelId || channels[0]?.id)) return;
    if (!confirmLeaveScript()) return;
    void flushPlan().then(() => {
      if (r.channel !== channelId) {
        pendingOpen.current = r.episode ? { ep: r.episode, tab: want.tab } : null;
        if (!r.episode) setTab(want.tab);
        setChannelId(r.channel!);
        return;
      }
      if (r.episode) setEpId(r.episode);
      setTab(want.tab);
    });
  };
  useEffect(() => {
    const h = () => onHash.current();
    window.addEventListener("hashchange", h);
    return () => window.removeEventListener("hashchange", h);
  }, []);

  const navigateManage = async (next: Tab) => {
    if (!next || !confirmLeaveScript()) return;
    await flushPlan();
    if (next === "settings" && EPISODE_TABS.includes(tab)) setSettingsReturn(tab);
    setTab(next);
  };
  const manageItems: ManageItem[] = [
    { id: "ops", label: SECTION_TITLES.ops, note: "القنوات الثلاث وبنك الأفكار" },
    { id: "channels", label: SECTION_TITLES.channels },
    { id: "channel", label: SECTION_TITLES.channel },
    { id: "identity", label: SECTION_TITLES.identity, note: identDirty ? "تعديلات غير محفوظة" : undefined },
    { id: "library", label: SECTION_TITLES.library },
    ...(hasLabs ? [{ id: "labs" as const, label: SECTION_TITLES.labs }] : []),
    ...(hasTechReviews ? [{ id: "treviews" as const, label: SECTION_TITLES.treviews }] : []),
    ...(hasGuide ? [{ id: "guide" as const, label: guideLabel }] : []),
    { id: "settings", label: SECTION_TITLES.settings, note: keysOk.voice ? undefined : "الصوت غير متصل" },
  ];

  if (!ident) return <div className="empty-state"><h2>جارٍ التحميل…</h2></div>;

  const cid = channelId || channels[0]?.id || "";
  const inEpisode = EPISODE_TABS.includes(tab) && Boolean(plan && check && epId);
  const w = ledger?.key === `${channelId}/${epId}` ? ledger.w : null;
  const done = stepsDone(w);
  const here = inEpisode ? stepOf(tab as StepTab) : -1;
  const go = (next: Tab) => { if (next !== tab && !confirmLeaveScript()) return; setTab(next); };
  const fixCount = w?.scenes.filter((x) => x.status === "needs_revision").length ?? 0;
  const autoFinal: FinalView = !w ? "recitations" : (w.progress.recitationPending?.length ?? 0) > 0 || !w.progress.canAssemble ? "recitations" : !w.progress.assemblyApproved ? "seams" : "master";
  const final: FinalView = finalView ?? autoFinal;
  const views: HeaderView[] = tab === "home" || tab === "library" || (tab === "guide" && hasGuide) ? [
    { id: "home", label: "الحلقات", sub: episodes ? String(episodes.length) : undefined, current: tab === "home", onSelect: () => void navigateManage("home") },
    { id: "library", label: "مكتبة القناة", current: tab === "library", onSelect: () => void navigateManage("library") },
    ...(hasGuide ? [{ id: "guide", label: "مرجع القناة", current: tab === "guide", onSelect: () => void navigateManage("guide") }] : []),
  ] : !inEpisode ? [] : here === 0 ? [
    { id: "storyboard", label: "اللوحات والنص", sub: plan ? String(plan.chapters.reduce((n, c) => n + c.scenes.length, 0)) : undefined, current: tab === "storyboard", onSelect: () => go("storyboard") },
    { id: "script", label: "السكريبت", sub: check ? `${num(check.stats.totalWords)} كلمة` : undefined, current: tab === "script", onSelect: () => go("script") },
    { id: "research", label: "البحث والمصادر", current: tab === "research", onSelect: () => go("research") },
  ] : here === 1 && done[0] ? [
    { id: "one", label: "مشهدًا مشهدًا", current: tab === "episode" && sceneView === "one", onSelect: () => { setSceneView("one"); go("episode"); } },
    { id: "voice", label: "متتابعة", sub: plan ? duration(episodeLength(plan, media, config.video.fps).seconds) : undefined, current: tab === "voice", onSelect: () => go("voice") },
    { id: "fix", label: "تحتاج إصلاحًا", badge: fixCount, current: tab === "episode" && sceneView === "fix", onSelect: () => { setSceneView("fix"); go("episode"); } },
  ] : here === 2 && done[0] ? [
    { id: "recitations", label: "التلاوات", badge: w?.progress.recitationPending?.length || undefined, current: final === "recitations", onSelect: () => setFinalView("recitations") },
    { id: "seams", label: "الوصلات", sub: w?.seams.length ? String(w.seams.length) : undefined, current: final === "seams", onSelect: () => setFinalView("seams") },
    { id: "master", label: "النسخة الأساسية", sub: "4K", current: final === "master", onSelect: () => setFinalView("master") },
  ] : [];
  const stepSub = here === 0 ? (done[0] ? "معتمد" : "ينتظرك") : here === 1 && w ? `${w.progress.approvedScenes} من ${w.progress.totalScenes}`
    : here === 2 && done[0] ? views.find((v) => v.current)?.label : here === 3 && done[3] ? "مأذون" : undefined;
  const epTitle = episodeTitle(episodes?.find((e) => e.id === epId)?.title || plan?.title || "");
  const channelName = channels.find((c) => c.id === cid)?.name ?? channel.name;

  return (
    <IdentityProvider identity={ident.draft}>
      <ChannelProvider channel={channel}>
      <div className="studio-shell shell-v3" data-channel={cid}>
      <Band
        channels={channels}
        channelId={cid}
        channelName={channelName}
        onChannel={async (next) => { if (next === channelId) return; if (!confirmLeaveScript()) return; await flushPlan(); setChannelId(next); }}
        onHome={() => void navigateManage("home")}
        episode={inEpisode ? { id: epId, title: epTitle } : null}
        steps={inEpisode ? { done, here, sub: stepSub } : null}
        stepTitles={STEPS.map((s) => s.title)}
        onStep={(i) => { const t = STEPS[i]!.tabs[0]!; if (i === 1) setSceneView("one"); go(t); }}
        counter={tab === "home" && episodes ? { n: episodes.length, label: episodes.length === 1 ? "حلقة" : episodes.length === 2 ? "حلقتان" : "حلقات" } : null}
        manage={manageItems}
        active={tab}
        onManage={(id) => void navigateManage(id)}
      />
      <div className={`app studio-main${inEpisode ? " episode-workspace-app" : ""}`}>
        <TopBar
          episodes={inEpisode ? episodes : null}
          episodeId={epId}
          onEpisode={async (id) => { if (!confirmLeaveScript()) return; await flushPlan(); setEpId(id); }}
          title="الاستوديو"
          views={views}
          save={inEpisode ? { state: planState, unsaved: scriptDirty || researchDirty } : null}
          scheme={scheme}
          onToggleScheme={toggleScheme}
        />
        <UpdateBanner beforeUpdate={flushPlan} hasUnsaved={scriptDirty || researchDirty || identDirty} />
        {!EPISODE_TABS.includes(tab) && tab !== "home" ? (
          <div className="page-head"><h1>{tab === "guide" ? guideLabel : SECTION_TITLES[tab] ?? "الاستوديو"}</h1></div>
        ) : null}

        {EPISODE_TABS.includes(tab) && plan && check && epId ? (
          <EpisodeSpine
            key={`spine:${channelId}:${epId}`}
            episodeId={epId}
            channelId={channelId}
            tab={tab as StepTab}
            scriptErrors={check.issues.filter((i) => i.level === "error")}
            onScriptLine={(line) => {
              if (tab === "script") { scriptRef.current?.goToLine(line); return; }
              if (!confirmLeaveScript()) return;
              setTab("script");
              setTimeout(() => scriptRef.current?.goToLine(line), 80);
            }}
            refreshKey={homeKey}
            onOpenSettings={openSettings}
            onTab={(next) => {
              if (next !== tab && !confirmLeaveScript()) return;
              setTab(next);
            }}
            onDecided={() => setHomeKey((k) => k + 1)}
            onState={(st) => setLedger({ key: `${channelId}/${epId}`, w: st })}
          />
        ) : null}
        {inEpisode && tab === "storyboard" ? (
          <header className="ms-step-head">
            <h1 className="ms-title">التجهيز</h1>
            <p className="ms-sub">اقرأ الحلقة كما ستُرى. بعد اعتمادك تُجهَّز المشاهد وحدها.</p>
          </header>
        ) : null}

         {tab === "ops" ? (
          <div className="home-wrap studio-ops-workspace">
            <OpsRoom
            refreshKey={homeKey}
            onOpen={async (ch, id, t) => {
              if (ch === (channelId || channels[0]?.id)) {
                if (id !== epId && !confirmLeaveScript()) return;
                setEpId(id);
                setTab(t);
                return;
              }
              if (!confirmLeaveScript()) return;
              await flushPlan();
              pendingOpen.current = { ep: id, tab: t };
              setChannelId(ch);
            }}
            onStartIdea={async (ch, idea, suggested) => {
              if (ch !== (channelId || channels[0]?.id)) {
                if (!confirmLeaveScript()) return;
                await flushPlan();
                setChannelId(ch);
              }
              setNewPrefill({ channel: ch, title: idea.title, domain: idea.domain, suggested, ideaId: idea.id });
              setShowNew(true);
            }}
          />
          </div>
        ) : tab === "channels" ? (
          <ChannelsWorkspace channels={channels} activeId={channelId || channels[0]?.id || ""} onOpen={async (id, destination) => {
            if (!confirmLeaveScript()) return;
            await flushPlan();
            if (id !== channelId) setChannelId(id);
            setTab(destination);
          }} />
        ) : tab === "home" ? (
          <div className="home-wrap studio-episodes-workspace">
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
              if (id !== epId && !confirmLeaveScript()) return;
              setEpId(id);
              setTab(t);
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
            onBack={settingsReturn && epId ? () => { setTab(settingsReturn); setSettingsReturn(null); } : undefined}
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
        ) : (tab === "episode" || tab === "review" || tab === "publish") && ledger?.key !== `${channelId}/${epId}` ? (
          <div className="empty-state"><h2>جارٍ قراءة حالة الحلقة…</h2></div>
        ) : lockedStep(tab as StepTab, ledger?.w ?? null) ? (() => {
          const n = lockedStep(tab as StepTab, ledger!.w)!;
          const next = nextAction(ledger!.w);
          const verses = plan.chapters.flatMap((c) => c.scenes).filter((x) => x.template === "verse-card" && x.ayahKey).length;
          return (
            <LockedStep step={n} {...LOCK_COPY[n]} action={{ label: next.label, onClick: () => { if (confirmLeaveScript()) setTab(next.tab); } }}
              nowNote={n === 2 && verses ? "التلاوات تُضاف آخرًا، ويمكنك تسجيل الآيات ورفعها من الآن؛ لا يُعتمد شيء غيرها هنا قبل أوانه." : undefined}
              now={n === 2 && verses ? <PreFinalPanel key={`recs:${channelId}:${epId}`} episodeId={epId} channelId={channelId} recitationsOnly onChanged={() => setHomeKey((k) => k + 1)} /> : undefined} />
          );
        })() : tab === "storyboard" ? (
          <div className="ew-storyboard-wrap"><StoryboardPanel
            key={`${channelId}:${epId}`}
            episodeId={epId}
            plan={plan}
            identity={ident.draft}
            channel={channel}
            media={media}
            onEditScene={(line) => { setTab("script"); setTimeout(() => scriptRef.current?.goToLine(line), 80); }}
            onReload={() => loadEpisode(epId, { keepScript: true })}
            onSigned={() => setHomeKey((k) => k + 1)}
            refreshKey={homeKey}
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
          // Step ٣ in three views (the pill): the recitations, the seams of the assembled episode, the final file.
          final === "recitations" ? (
            <PreFinalPanel key={`prefinal:${channelId}:${epId}`} episodeId={epId} channelId={channelId} onChanged={() => setHomeKey(k => k + 1)} />
          ) : (
          <>
          <SceneProductionPanel
            key={`scene-workflow-review:${channelId}:${epId}`}
            episodeId={epId}
            channelId={channelId}
            finalView={final}
            onFinalView={setFinalView}
            plan={plan}
            thumb={(id) => <SceneThumb sceneId={id} plan={plan} identity={ident.draft} channel={channel} media={media} />}
            onOpenScene={(id) => { setRequestedSceneId(id); setTab("episode"); }}
            onOpenStoryboard={() => setTab("storyboard")}
            onOpenScript={() => setTab("script")}
            onOpenPublish={() => setTab("publish")}
            onUpdated={() => setHomeKey(k => k + 1)}
          />
          {final === "master" ? (
            <IntegratedReviewWorkspace key={`${channelId}:${epId}`} episodeId={epId} onOpen={(stage, sceneId) => {
              if (!confirmLeaveScript()) return;
              if (stage === "episode" && sceneId) setRequestedSceneId(sceneId);
              setTab(stage);
            }} />
          ) : null}
          </>
          )
        ) : tab === "publish" ? (
          <>
          <SceneProductionPanel
            key={`scene-workflow-publish:${channelId}:${epId}:${homeKey}`}
            episodeId={epId}
            channelId={channelId}
            onOpenScene={(id) => { setRequestedSceneId(id); setTab("episode"); }}
            onOpenStoryboard={() => setTab("storyboard")}
            onOpenScript={() => setTab("script")}
            onOpenPublish={() => setTab("publish")}
            onOpenReview={() => setTab("review")}
            onUpdated={() => setHomeKey(k => k + 1)}
          />
          <PublishTab key={epId} episodeId={epId} hasVoiceKeys={keysOk.voice} onChanged={() => setHomeKey((k) => k + 1)} />
          </>
        ) : tab === "episode" ? (
          // شاشة «المشاهد»: قرار المشهد الحالي أولًا، والمحرر الكامل خلف «تحرير المشهد»
          <SceneProductionPanel
            key={`scene-workflow:${channelId}:${epId}`}
            episodeId={epId}
            channelId={channelId}
            plan={plan}
            channel={channel}
            requestedSceneId={requestedSceneId}
            onCloseEditor={() => setRequestedSceneId(undefined)}
            media={media}
            onMediaChange={setMedia}
            hasVoiceKeys={extra.keys.voice}
            onOpenSettings={openSettings}
            onPlanSave={async (p) => { onPlanChange(p); await flushPlan(); }}
            onPlanFlush={flushPlan}
            onPlanReplaced={(p) => { setPlan(p); setPlanState("saved"); }}
            livePreview={(id) => <SceneLivePreview sceneId={id} plan={plan} identity={ident.draft} channel={channel} media={media} />}
            onOpenScene={(id) => setRequestedSceneId(id)}
            onOpenStoryboard={() => setTab("storyboard")}
            onOpenScript={() => setTab("script")}
            onOpenPublish={() => setTab("publish")}
            onOpenFinal={() => setTab("review")}
            onOpenPreparation={() => setTab("storyboard")}
            view={sceneView}
            onView={setSceneView}
            thumb={(id) => <SceneThumb sceneId={id} plan={plan} identity={ident.draft} channel={channel} media={media} />}
            onUpdated={() => setHomeKey(k => k + 1)}
            editor={(sceneId, onSelect) => (
              <EpisodeTab
                key={epId}
                episodeId={epId}
                requestedSceneId={sceneId}
                onSelectScene={onSelect}
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
            )}
          />
        ) : (
          <ScriptTab key={`${epId}:${tab}`} ref={scriptRef} episodeId={epId} initialDoc={tab === "research" ? "research" : "script"} workspaceMode onOpenScriptLine={(line) => { if (!confirmLeaveScript()) return; setTab("script"); setTimeout(() => scriptRef.current?.goToLine(line), 50); }} onResearchDirtyChange={setResearchDirty} text={script} savedText={savedScript} check={check} onChange={setScript} onSave={saveScript} />
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
    <Dialog as="form" labelledBy="new-episode-title" onClose={onClose} width={520}
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
        <div className="modal-head"><h3 id="new-episode-title">حلقة جديدة</h3></div>
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
    </Dialog>
  );
};
