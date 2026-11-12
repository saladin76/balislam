import { UpdateBanner } from "./ui/UpdateBanner";
import { PlanSaveQueue } from "./planSaveQueue";
import { PlanBackupRestore, PlanSaveRecovery, clearPlanBackup, readPlanBackup } from "./PlanSaveRecovery";
import { withServerFields } from "./planMerge";
import { PLAN_SERVER_FIELDS_EVENT, type PlanServerFieldsDetail } from "./planServerFields";
import { browserPlanRevision } from "../../src/plan/revision";
import { SECTION_TITLES, type StudioSection } from "./ui/StudioSidebar";
import "./studio-shell.css";
import "./shell/shell.css";
import { TopBar, type HeaderView } from "./shell/TopBar";
import { Band, type ManageItem } from "./shell/Band";
import { EpisodeSpine, STEPS, stepOf, stepsDone, type StepTab } from "./shell/EpisodeSpine";
import { useColorScheme } from "./ui/colorScheme";
import { episodeLength } from "../../src/plan/episodeLength";
import { arDigits, arNum, countAr, duration, episodeTitle, latinDigits, num, WORDS } from "./ui/format";
import config from "../../config.json";
import { LOCK_COPY, LockedStep, lockedStep, nextAction } from "./shell/LockedStep";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { IdentityProvider, type Identity } from "../../brand/identity/index";
import type { Plan } from "../../src/plan/types";
import { api, isPlanConflict, setApiChannel, type ChannelSummary, type CheckResult, type EpisodeData, type EpisodeSummary, type SceneProductionRead } from "./api";
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
import { SeriesPage } from "./tabs/Series";
import { MoveEpisodesDialog, useEpisodeMover } from "./tabs/MoveEpisodes";
import { GENERAL_SLUG, SERIES_KIND_AR } from "../../src/channel/series";
import type { SeriesRead } from "./api";
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
import { ChannelProvider, useChannel } from "../../src/channel/context";
import { channelPlaceholders } from "../../src/channel/placeholders";
import { recitationStageNeeded } from "../../src/quran/citation";
import { shotWordIssues } from "../../src/plan/shotWords";
import { hasBasmala } from "../../src/voice/basmala";
import { bootPlace, navigationKind, parseStudioHash, studioHash } from "./shell/route";
import { StudioErrorBoundary } from "./shell/ErrorBoundary";
import { OwnerText } from "./ui/OwnerText";
import { splitOwnerDetails } from "./serverMessages";

type Tab = StudioSection;
type FinalView = "recitations" | "seams" | "master";
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
/**
 * Where the Studio opens (D85, `bootPlace` in shell/route.ts): a fresh open lands on «الرئيسية» of the last
 * channel chosen; a reload while working keeps the place in the address bar (or a `?link` deep link).
 */
const bootRoute = typeof window === "undefined"
  ? { tab: "home" as Tab }
  : bootPlace({
    hash: window.location.hash,
    search: window.location.search,
    navigation: navigationKind(),
    stored: { channel: store.get("bal-channel"), episode: store.get("bal-episode"), tab: store.get("bal-tab") },
  });

export const App: React.FC = () => {
  useStudioFonts();
  const { scheme, toggle: toggleScheme } = useColorScheme();
  /** Views inside a step (direction D, the floating pill): the scenes one by one or those needing a fix; step ٣'s three. */
  const [sceneView, setSceneView] = useState<"one" | "fix">("one");
  const [finalView, setFinalView] = useState<FinalView | null>(null);
  const [tab, setTab] = useState<Tab>(bootRoute.tab);
  /** The episode step that opened «الإعدادات» (audit item 14): the settings page offers to go back to it. */
  const [settingsReturn, setSettingsReturn] = useState<Tab | null>(null);
  const openSettings = () => { if (EPISODE_TABS.includes(tab)) setSettingsReturn(tab); setTab("settings"); };
  const [keysOk, setKeysOk] = useState({ voice: false, quran: false });
  const [homeKey, setHomeKey] = useState(0);
  const [channels, setChannels] = useState<ChannelSummary[]>([]);
  const [channelId, setChannelId] = useState<string>(() => {
    const c = bootRoute.channel ?? "";
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
  const [epId, setEpId] = useState<string>(bootRoute.episode ?? "");
  /** The series page on screen («#/<channel>/series/<id>»), and the channel's series (band, picker, new episode). */
  const [seriesId, setSeriesId] = useState<string>(bootRoute.series ?? "");
  const [seriesData, setSeriesData] = useState<SeriesRead | null>(null);
  const [newSeriesFor, setNewSeriesFor] = useState<string>("");
  /** «غيّر السلسلة» from inside an episode (D77): the move dialog, then the band and picker reload. */
  const [moveOpen, setMoveOpen] = useState(false);
  const epMover = useEpisodeMover(async () => {
    const [list, r] = await Promise.all([api.episodes(), api.series()]);
    setEpisodes(list); setSeriesData(r);
  });
  const episodeRef = useRef(epId);
  episodeRef.current = epId;
  const [requestedSceneId, setRequestedSceneId] = useState<string | undefined>();
  const [viewSceneId, setViewSceneId] = useState<string | undefined>();
  /** The scene on screen in step ٢ (in the address bar, so a reload keeps it); the boot route's scene is used once. */
  const [shownScene, setShownScene] = useState<string | undefined>(bootRoute.scene);
  const bootScene = useRef<string | undefined>(bootRoute.scene);
  useEffect(() => {
    const keep = bootScene.current;
    bootScene.current = undefined;
    setRequestedSceneId(undefined); setViewSceneId(keep); setShownScene(keep); setSceneView("one"); setFinalView(null);
  }, [channelId, epId]);
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
  /** The last refused save was a revision conflict (409): the recovery offers the three-way merge (D109). */
  const [planConflict, setPlanConflict] = useState(false);
  /** D109: «ch/ep» whose browser copy (PlanSaveRecovery) is cleared when its edit is saved; re-read on each tick. */
  const clearBackupOnSave = useRef<string | null>(null);
  const [backupTick, setBackupTick] = useState(0);
  /** Counts successful plan saves: step ٢ reads the ledger again after each (dafatir M6). */
  const [planSaved, setPlanSaved] = useState(0);
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
  const planSaves = useRef<PlanSaveQueue<Plan> | null>(null);
  if (!planSaves.current) planSaves.current = new PlanSaveQueue(async (item, expectedRevision) => {
    const result = await api.savePlan(item.episode, item.value, item.channel, expectedRevision);
    return result.planRevision;
  });
  /** نص السكريبت غير المحفوظ (لا يُستبدل عند إعادة تحميل الحلقة) */
  const scriptDirtyRef = useRef(false);

  // QA 12 Nov: a warning the owner must read stays long enough to read it (the script-save list vanished in ٢ ث).
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const say = (msg: string, err = false, ms = 2600) => {
    setToast({ msg, err });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    // KI-009: a refusal with folded technical details stays long enough to open «تفاصيل».
    const wait = splitOwnerDetails(msg).details === null ? ms : Math.max(ms, 12_000);
    toastTimer.current = setTimeout(() => setToast(null), wait);
  };

  // QA 12 Nov: a fresh browser (no channel stored, no hash) takes the first channel at once, so «مرجع القناة»,
  // the labs and the guide are offered before the owner picks a channel.
  const reloadChannels = useCallback(() => api.channels().then((list) => {
    setChannels(list);
    setChannelId((c) => c || list[0]?.id || "");
  }).catch((e) => say(e.message, true)), []);
  const reloadKeys = useCallback(
    () =>
      api.keys().then(({ keys }) => setKeysOk({ voice: Boolean(keys.ELEVENLABS_API_KEY?.set && keys.ELEVENLABS_VOICE_ID?.set), quran: false })).catch(() => {}),
    [],
  );
  useEffect(() => {
    reloadChannels();
    reloadKeys();
  }, [reloadChannels, reloadKeys]);

  const prevChannel = useRef("");
  // عند تغيير القناة: حلقاتها وهويتها
  useEffect(() => {
    setApiChannel(channelId);
    store.set("bal-channel", channelId);
    setEpisodes(null);
    setPlan(null);
    loadedKey.current = "";
    episodesOf.current = "";
    const ch = channelId;
    const switched = Boolean(prevChannel.current && prevChannel.current !== ch);
    if (ch) prevChannel.current = ch;
    api.episodes().then((list) => {
      if (channelRef.current !== ch) return;
      episodesOf.current = ch;
      setEpisodes(list);
      const want = pendingOpen.current;
      pendingOpen.current = null;
      // QA 12 Nov: switching channels comes back to the episode last open in that channel (per-channel memory).
      const remembered = switched ? store.get(`bal-episode:${ch}`) : null;
      if (want && list.some((e) => e.id === want.ep)) {
        setEpId(want.ep);
        setTab(want.tab);
      } else if (remembered && list.some((e) => e.id === remembered)) setEpId(remembered);
      else setEpId((cur) => (list.some((e) => e.id === cur) ? cur : (list[0]?.id ?? "")));
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
    if (!planSaves.current!.hasPending) return;
    setPlanState("saving");
    const item = planSaves.current!.snapshot;
    const key = item ? item.channel + "/" + item.episode : null;
    try {
      await planSaves.current!.flush();
      setPlanState("saved");
      setPlanConflict(false);
      setPlanSaved((n) => n + 1);
      // D109: the browser copy of a refused or restored edit goes once that edit is saved
      if (key && clearBackupOnSave.current === key) {
        clearPlanBackup(item!.channel, item!.episode);
        clearBackupOnSave.current = null;
        setBackupTick((n) => n + 1);
      }
    } catch (e) {
      if (key) clearBackupOnSave.current = key;
      setPlanConflict(isPlanConflict(e));
      setPlanState("error");
      say((e as Error).message, true);
      throw e;
    }
  }, []);
  const flushBeforeNavigation = useCallback(() => flushPlan().then(() => true, () => false), [flushPlan]);

  const loadEpisode = useCallback(async (id: string, opts: { keepScript?: boolean } = {}) => {
    // الحلقة تخص القناة الحالية لحظة الطلب؛ إن تبدّلت القناة أثناء الحفظ يُلغى التحميل
    const ch = channelRef.current;
    if (!await flushBeforeNavigation()) return;
    if (channelRef.current !== ch || episodeRef.current !== id) return;
    api.episode(id, ch).then((d) => {
      if (channelRef.current !== ch || episodeRef.current !== id) return;
      if (planSaves.current!.hasPending) return;
      setPlan(d.plan);
      planSaves.current!.seed(ch, id, browserPlanRevision(d.plan), d.plan);
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
  }, [flushBeforeNavigation, channelId]);
  // تُحمَّل الحلقة بعد وصول قائمة حلقات القناة الحالية فقط، فلا تُطلب حلقة القناة السابقة بعد التبديل
  useEffect(() => {
    if (!epId || episodesOf.current !== channelId || !episodes?.some((e) => e.id === epId)) return;
    const key = `${channelId}/${epId}`;
    if (loadedKey.current === key) return;
    loadedKey.current = key;
    store.set("bal-episode", epId);
    store.set(`bal-episode:${channelId}`, epId);
    setPlan(null);
    loadEpisode(epId);
  }, [epId, channelId, episodes, loadEpisode]);
  useEffect(() => store.set("bal-tab", tab), [tab]);
  useEffect(() => {
    let live = true;
    setSeriesData(null);
    if (channelId) api.series().then((r) => live && setSeriesData(r), () => live && setSeriesData(null));
    return () => { live = false; };
  }, [channelId, homeKey]);
  // The address bar always names the current channel, episode and step (a link the owner can keep).
  useEffect(() => {
    const ch = channelId || channels[0]?.id || "";
    const next = studioHash({ channel: ch, episode: epId, tab, series: seriesId, scene: tab === "episode" ? shownScene : undefined });
    if (!next || (window.location.hash === next && !window.location.search)) return;
    // `?link` (and any query) is dropped once applied: a later restore of this tab is a fresh open again (D85).
    try { window.history.replaceState(null, "", `${window.location.pathname}${next}`); } catch { /* not critical */ }
  }, [channelId, channels, epId, tab, seriesId, shownScene]);

  // D109: moving the episode (series stamp) or saving its shorts writes plan.json on the server. Both fields are
  // outside the plan revision, so a pending edit stays valid; the page takes the new fields and, when nothing
  // is pending, the server's current revision, so the next edit is never refused as stale.
  useEffect(() => {
    const h = (e: Event) => {
      const detail = (e as CustomEvent<PlanServerFieldsDetail>).detail;
      const ch = channelRef.current, id = episodeRef.current;
      if (!id || !detail?.episodes?.includes(id) || (detail.channel && detail.channel !== ch)) return;
      api.episode(id, ch).then((d) => {
        if (channelRef.current !== ch || episodeRef.current !== id) return;
        setPlan((prev) => (prev ? withServerFields(prev, d.plan) : d.plan));
        if (!planSaves.current!.hasPending) planSaves.current!.seed(ch, id, browserPlanRevision(d.plan), d.plan);
      }).catch(() => {});
    };
    window.addEventListener(PLAN_SERVER_FIELDS_EVENT, h);
    return () => window.removeEventListener(PLAN_SERVER_FIELDS_EVENT, h);
  }, []);

  /** حفظ تلقائي للخطة بعد توقف التعديل */
  const onPlanChange = useCallback((p: Plan) => {
    setPlan(p);
    setPlanState("dirty");
    planSaves.current!.enqueue(channelRef.current, epId, p);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { void flushPlan().catch(() => {}); }, 700);
  }, [epId, flushPlan]);

  const saveScript = async () => {
    // تعديلات المشاهد المعلّقة تُحفظ أولًا، ثم يعيد الخادم بناء الخطة مع إبقائها
    if (!await flushBeforeNavigation()) return;
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
    planSaves.current!.seed(channelRef.current, epId, browserPlanRevision(r.plan), r.plan);
    setPlanState("saved");
    // M2: step ١'s approval state (script fingerprint, blockers) is re-read at once, so «اعتمد التجهيز»
    // never sends the fingerprint of the script before this save.
    setHomeKey((k) => k + 1);
    api.episode(epId).then((d) => { setMedia(d.media); setExtra({ issues: d.issues, keys: d.keys }); }).catch(() => {});
    // خطة مصمَّمة: لم تُلمس، وتُذكر المشاهد التي اختلف نصها عن السكريبت
    const note = scriptSaveMessage(r, r.plan?.chapters.flatMap((c) => c.scenes.map((x) => x.id)) ?? []);
    say(note.msg, note.warn, note.warn ? 9000 : undefined);
  };

  const scriptDirty = script !== savedScript;
  scriptDirtyRef.current = scriptDirty;

  // تنبيه قبل إغلاق الصفحة إن بقي شيء غير محفوظ
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (scriptDirtyRef.current || researchDirty || planSaves.current!.hasPending) {
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
    if (r.series) setSeriesId(r.series);
    if (r.scene && want.ep === epId && r.channel === (channelId || channels[0]?.id)) setViewSceneId(r.scene);
    if (want.ep === epId && want.tab === tab && r.channel === (channelId || channels[0]?.id)) return;
    if (!confirmLeaveScript()) return;
    void flushBeforeNavigation().then((saved) => {
      if (!saved) return;
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
    if (!await flushBeforeNavigation()) return;
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
  // D68: a written-citation channel has no recitations to upload, unless the episode holds the basmala (the owner's own recording).
  const planScenesAll = plan ? plan.chapters.flatMap((c) => c.scenes) : [];
  // D-5/M4: designed drawings made for an earlier text, for «قبل أن تعتمد» (the scene shows words only until updated)
  // (no hook here: after the loading return; shotWordIssues memoizes each scene itself)
  const shotMismatch = plan ? shotWordIssues(plan, channel.name).map((i) => i.sceneId) : [];
  const recStage = recitationStageNeeded(channel, planScenesAll, planScenesAll.some((x) => hasBasmala(x.narration)));
  const autoFinal: FinalView = !w ? "recitations" : (w.progress.recitationPending?.length ?? 0) > 0 || !w.progress.canAssemble ? "recitations" : !w.progress.assemblyApproved ? "seams" : "master";
  const final: FinalView = finalView ?? autoFinal;
  const views: HeaderView[] = tab === "home" || tab === "library" || (tab === "guide" && hasGuide) ? [
    { id: "home", label: "الحلقات", sub: episodes ? arNum(episodes.length) : undefined, current: tab === "home", onSelect: () => void navigateManage("home") },
    { id: "library", label: "مكتبة القناة", current: tab === "library", onSelect: () => void navigateManage("library") },
    ...(hasGuide ? [{ id: "guide", label: "مرجع القناة", current: tab === "guide", onSelect: () => void navigateManage("guide") }] : []),
  ] : !inEpisode ? [] : here === 0 ? [
    { id: "storyboard", label: "اللوحات والنص", sub: plan ? arNum(plan.chapters.reduce((n, c) => n + c.scenes.length, 0)) : undefined, current: tab === "storyboard", onSelect: () => go("storyboard") },
    { id: "script", label: "السكريبت", sub: check ? countAr(check.stats.totalWords, WORDS) : undefined, current: tab === "script", onSelect: () => go("script") },
    { id: "research", label: "البحث والمصادر", current: tab === "research", onSelect: () => go("research") },
  ] : here === 1 && done[0] ? [
    { id: "one", label: "مشهدًا مشهدًا", current: tab === "episode" && sceneView === "one", onSelect: () => { setSceneView("one"); go("episode"); } },
    { id: "voice", label: "متتابعة", sub: plan ? duration(episodeLength(plan, media, config.video.fps).seconds) : undefined, current: tab === "voice", onSelect: () => go("voice") },
    { id: "fix", label: "تحتاج إصلاحًا", badge: fixCount || undefined, current: tab === "episode" && sceneView === "fix", onSelect: () => { setSceneView("fix"); go("episode"); } },
  ] : here === 2 && done[0] ? [
    // D68: without recitations the same view holds only the watch-only pre-final preview, so it is named for it.
    { id: "recitations", label: recStage ? "التلاوات" : "قبل النهائية", badge: w?.progress.recitationPending?.length || undefined, current: final === "recitations", onSelect: () => setFinalView("recitations") },
    { id: "seams", label: "الوصلات", sub: w?.assembly && w.seams.length ? arNum(w.seams.length) : undefined, current: final === "seams", onSelect: () => setFinalView("seams") },
    { id: "master", label: "النسخة الأساسية", sub: "4K", current: final === "master", onSelect: () => setFinalView("master") },
  ] : [];
  const stepSub = here === 0 ? (done[0] ? "معتمد" : "ينتظرك") : here === 1 && w ? `${arNum(w.progress.approvedScenes)} من ${arNum(w.progress.totalScenes)}`
    : here === 2 && done[0] ? views.find((v) => v.current)?.label : here === 3 && done[3] ? "مأذون" : undefined;
  const epTitle = episodeTitle(episodes?.find((e) => e.id === epId)?.title || plan?.title || "");
  const channelName = channels.find((c) => c.id === cid)?.name ?? channel.name;
  // The series under the channel name: the open episode's (never «عام»), or the series page's
  const epSeries = inEpisode ? episodes?.find((e) => e.id === epId)?.series : undefined;
  // Inside an episode «عام» shows too when there is another series to move it to (with «غيّر السلسلة»)
  const canChangeSeries = Boolean(inEpisode && seriesData?.series.some((x) => x.id !== GENERAL_SLUG && x.status !== "archived"));
  const bandSeriesId = tab === "series" ? seriesId : epSeries && epSeries !== GENERAL_SLUG ? epSeries : canChangeSeries ? GENERAL_SLUG : "";
  const bandSeries = bandSeriesId ? seriesData?.series.find((x) => x.id === bandSeriesId) : undefined;
  const seriesNames = seriesData && seriesData.series.length > 1 ? Object.fromEntries(seriesData.series.map((x) => [x.id, x.name])) : null;
  const screenLabel = inEpisode && here >= 0 ? `الخطوة ${STEPS[here]!.n} «${STEPS[here]!.title}»` : tab === "guide" ? guideLabel : SECTION_TITLES[tab] ?? "هذه الشاشة";
  const openSeries = (id: string) => { if (!confirmLeaveScript()) return; void flushBeforeNavigation().then((saved) => { if (!saved) return; setSeriesId(id); setTab("series"); }); };

  return (
    <IdentityProvider identity={ident.draft}>
      <ChannelProvider channel={channel}>
      <div className="studio-shell shell-v3" data-channel={cid}>
      <Band
        channels={channels}
        channelId={cid}
        channelName={channelName}
        onChannel={async (next) => { if (next === channelId) return; if (!confirmLeaveScript()) return; if (!await flushBeforeNavigation()) return; setChannelId(next); }}
        onHome={() => void navigateManage("home")}
        episode={inEpisode ? { id: epId, title: epTitle } : null}
        steps={inEpisode ? { done, here, sub: stepSub } : null}
        stepTitles={STEPS.map((s) => s.title)}
        onStep={(i) => { const t = STEPS[i]!.tabs[0]!; if (i === 1) setSceneView("one"); go(t); }}
        series={bandSeries ? { id: bandSeries.id, name: bandSeries.name, kind: SERIES_KIND_AR[bandSeries.kind] } : null}
        onSeries={openSeries}
        onChangeSeries={canChangeSeries ? () => setMoveOpen(true) : undefined}
        counter={tab === "home" && episodes ? { n: episodes.length, label: episodes.length === 1 ? "حلقة" : episodes.length === 2 ? "حلقتان" : "حلقات" } : null}
        manage={manageItems}
        active={tab}
        onManage={(id) => void navigateManage(id)}
      />
      <div className={`app studio-main${inEpisode ? " episode-workspace-app" : ""}`}>
        <TopBar
          episodes={inEpisode ? episodes : null}
          episodeId={epId}
          onEpisode={async (id) => { if (!confirmLeaveScript()) return; if (!await flushBeforeNavigation()) return; setEpId(id); }}
          seriesNames={seriesNames}
          title="الاستوديو"
          views={views}
          save={inEpisode ? { state: planState, unsaved: scriptDirty || researchDirty } : null}
          scheme={scheme}
          onToggleScheme={toggleScheme}
        />
        {planState === "error" && planSaves.current!.hasPending ? (
          <PlanSaveRecovery
            queue={planSaves.current!}
            conflict={planConflict}
            retry={flushPlan}
            latest={async (ch, id) => (await api.episode(id, ch)).plan}
            revisionOf={browserPlanRevision}
            onPlan={(p) => { setPlan(p); setPlanState("dirty"); }}
            onLeft={(ch, id) => {
              clearBackupOnSave.current = null; // the way out keeps the copy: «استعد تعديلي المحفوظ» offers it back
              setBackupTick((n) => n + 1);
              setPlanConflict(false); setPlanState("saved");
              say("فُتحت النسخة المحفوظة؛ تعديلك في الملف المنزَّل وفي هذا المتصفح.");
              if (ch === channelRef.current && id === episodeRef.current) void loadEpisode(id);
            }}
          />
        ) : null}
        {(() => {
          const backup = inEpisode && plan && planState === "saved" && !planSaves.current!.hasPending ? readPlanBackup(channelRef.current, epId) : null;
          void backupTick;
          return backup ? (
            <PlanBackupRestore
              key={channelRef.current + "/" + epId + backup.at}
              channel={channelRef.current} episode={epId} backup={backup}
              latest={async () => (await api.episode(epId, channelRef.current)).plan}
              apply={async (merged, theirs) => {
                const ch = channelRef.current;
                planSaves.current!.rebase(ch, epId, browserPlanRevision(theirs), theirs, merged);
                clearBackupOnSave.current = ch + "/" + epId;
                setPlan(merged); setPlanState("dirty");
                await flushPlan();
              }}
              onDropped={() => setBackupTick((n) => n + 1)}
            />
          ) : null;
        })()}
        <UpdateBanner beforeUpdate={flushPlan} hasUnsaved={scriptDirty || researchDirty || identDirty || planState !== "saved"} />
        {!EPISODE_TABS.includes(tab) && tab !== "home" && tab !== "series" ? (
          <div className="page-head"><h1>{tab === "guide" ? guideLabel : SECTION_TITLES[tab] ?? "الاستوديو"}</h1></div>
        ) : null}

        {EPISODE_TABS.includes(tab) && plan && check && epId ? (
          <StudioErrorBoundary scope="screen" compact label="حالة الحلقة" resetKey={`${channelId}:${epId}`} onHome={() => void navigateManage("home")}>
          <EpisodeSpine
            key={`spine:${channelId}:${epId}`}
            episodeId={epId}
            channelId={channelId}
            tab={tab as StepTab}
            scriptErrors={check.issues.filter((i) => i.level === "error")}
            shotMismatch={shotMismatch}
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
            onEpisodeTone={async (tone) => { onPlanChange({ ...plan, tone }); await flushPlan(); }}
          />
          </StudioErrorBoundary>
        ) : null}
        {inEpisode && tab === "storyboard" ? (
          <header className="ms-step-head">
            <h1 className="ms-title">التجهيز</h1>
            <p className="ms-sub">اقرأ الحلقة كما ستُرى. بعد اعتمادك تُجهَّز المشاهد وحدها.</p>
          </header>
        ) : null}

        {/* D89: a screen that throws shows its error card here; the band, top bar and other steps stay usable */}
        <StudioErrorBoundary scope="screen" label={screenLabel} resetKey={`${channelId}:${epId}:${tab}:${final}:${sceneView}`} onHome={() => void navigateManage("home")}>
        {tab === "ops" ? (
          <div className="home-wrap studio-ops-workspace">
            <OpsRoom
            refreshKey={homeKey}
            onOpen={async (ch, id, t) => {
              if (ch === (channelId || channels[0]?.id)) {
                if (id !== epId && !confirmLeaveScript()) return;
                if (!await flushBeforeNavigation()) return;
                setEpId(id);
                setTab(t);
                return;
              }
              if (!confirmLeaveScript()) return;
              if (!await flushBeforeNavigation()) return;
              pendingOpen.current = { ep: id, tab: t };
              setChannelId(ch);
            }}
            onStartIdea={async (ch, idea, suggested) => {
              if (ch !== (channelId || channels[0]?.id)) {
                if (!confirmLeaveScript()) return;
                if (!await flushBeforeNavigation()) return;
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
            if (!await flushBeforeNavigation()) return;
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
            onRestored={() => { api.episodes().then(setEpisodes).catch(() => {}); }}
            onOpen={async (id, t) => {
              if (id !== epId && !confirmLeaveScript()) return;
              if (!await flushBeforeNavigation()) return;
              setEpId(id);
              setTab(t);
            }}
            onOpenSeries={openSeries}
          />
          
          </div>
        ) : tab === "series" && seriesId ? (
          <div className="home-wrap studio-episodes-workspace">
            <SeriesPage
              key={`${channelId}-${seriesId}-${homeKey}`}
              channel={channel}
              identity={ident.draft}
              seriesId={seriesId}
              onBack={() => void navigateManage("home")}
              onOpenSeries={openSeries}
              onOpenEpisode={async (id, t) => { if (id !== epId && !confirmLeaveScript()) return; if (!await flushBeforeNavigation()) return; setEpId(id); setTab(t); }}
              onNewEpisode={(sid) => { setNewSeriesFor(sid); setShowNew(true); }}
              onChanged={() => api.series().then(setSeriesData).catch(() => {})}
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
          // QA 12 Nov (balislam 15): the locked «٤ النشر» points to step ٣ only (docs/studio-interface.md)
          const next = n === 3 ? { label: "إلى النسخة النهائية", tab: "review" as const } : nextAction(ledger!.w);
          const verses = recStage;
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
            afterPreparation={w?.afterPreparation?.scenes.filter((x) => w.scenes.find((y) => y.id === x.id)?.afterPreparation)}
            afterPreparationScriptOnly={Boolean(w?.afterPreparation?.scriptOnly)}
            onOpenScene={(id) => { setViewSceneId(id); setTab("episode"); }}
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
            viewSceneId={viewSceneId}
            onCloseEditor={() => setRequestedSceneId(undefined)}
            media={media}
            onMediaChange={setMedia}
            hasVoiceKeys={extra.keys.voice}
            onOpenSettings={openSettings}
            onPlanSave={async (p) => { onPlanChange(p); await flushPlan(); }}
            onPlanFlush={flushPlan}
            onPlanReplaced={(p) => { setPlan(p); planSaves.current!.seed(channelId, epId, browserPlanRevision(p), p); setPlanState("saved"); }}
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
            onState={(st) => setLedger({ key: `${channelId}/${epId}`, w: st })}
            onShownScene={(id) => setShownScene(id ?? undefined)}
            planSaved={planSaved}
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
        </StudioErrorBoundary>

        {showNew ? (
          <NewEpisode
            channelId={channelId || channels[0]?.id}
            taken={(episodes ?? []).map((e) => e.id)}
            domains={Object.entries(channels.find((c) => c.id === (channelId || channels[0]?.id))?.domains ?? defaultChannel.domains).map(([id, d]) => [id, d.name])}
            suggested={newPrefill?.suggested ?? String((episodes?.reduce((m, e) => Math.max(m, Number(e.id)), 0) ?? 0) + 1).padStart(3, "0")}
            initialTitle={newPrefill?.title}
            initialDomain={newPrefill?.domain}
            series={(seriesData?.series ?? []).filter((x) => x.status !== "archived").map((x) => [x.id, x.name] as [string, string])}
            initialSeries={newSeriesFor || (tab === "series" ? seriesId : "")}
            onClose={() => {
              setShowNew(false);
              setNewPrefill(null);
              setNewSeriesFor("");
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
              setNewSeriesFor("");
              setTab("script");
              setHomeKey((k) => k + 1);
              say(`أُنشئت الحلقة ${id}`);
            }}
          />
        ) : null}
        {toast ? <div className={`toast ${toast.err ? "err" : ""}`} role={toast.err ? "alert" : "status"} title="انقر للإغلاق" onClick={() => setToast(null)}><OwnerText text={toast.msg} /></div> : null}
        {moveOpen && seriesData && epId ? (
          <MoveEpisodesDialog episodes={[epId]} current={epSeries || GENERAL_SLUG} data={seriesData} onClose={() => setMoveOpen(false)}
            onPick={async (to) => { if (!await flushBeforeNavigation()) return; await epMover.move(to, [epId]); setMoveOpen(false); }} />
        ) : null}
        {epMover.node}
      </div>
      </div>
      </ChannelProvider>
    </IdentityProvider>
  );
};

/** A folder name from the Arabic title (rough, readable Latin), or «episode-٠٠٢» when nothing is left. */
const AR_LATIN: Record<string, string> = { ا: "a", أ: "a", إ: "i", آ: "a", ء: "", ؤ: "u", ئ: "i", ب: "b", ت: "t", ث: "th", ج: "j", ح: "h", خ: "kh", د: "d", ذ: "dh", ر: "r", ز: "z", س: "s", ش: "sh", ص: "s", ض: "d", ط: "t", ظ: "z", ع: "a", غ: "gh", ف: "f", ق: "q", ك: "k", ل: "l", م: "m", ن: "n", ه: "h", ة: "a", و: "w", ي: "y", ى: "a" };
export const autoSlug = (title: string, episode: string): string => {
  const words = title.normalize("NFKD").replace(/[\u064B-\u065F\u0670\u0640]/g, "").split(/\s+/)
    .map((w) => [...w].map((c) => AR_LATIN[c] ?? (/[a-z0-9]/i.test(c) ? c.toLowerCase() : "")).join("").replace(/^al(?=.{3,})/, ""))
    .filter((w) => w.length > 1).slice(0, 4);
  const slug = words.join("-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 40).replace(/-$/, "");
  return slug || `episode-${latinDigits(episode) || "new"}`;
};
const NewEpisode: React.FC<{ channelId?: string; taken?: string[]; domains: [string, string][]; suggested: string; initialTitle?: string; initialDomain?: string; series?: [string, string][]; initialSeries?: string; onClose: () => void; onCreated: (id: string) => void }> = ({ channelId = "", taken = [], domains, suggested, initialTitle, initialDomain, series = [], initialSeries, onClose, onCreated }) => {
  const ph = channelPlaceholders(useChannel().id);
  const [inSeries, setInSeries] = useState(initialSeries && series.some(([id]) => id === initialSeries) ? initialSeries : GENERAL_SLUG);
  const [episode, setEpisode] = useState(arDigits(suggested));
  const [slug, setSlug] = useState("");
  const [domain, setDomain] = useState(initialDomain && domains.some(([d]) => d === initialDomain) ? initialDomain : (domains[0]?.[0] ?? ""));
  const [title, setTitle] = useState(initialTitle ?? "");
  const [err, setErr] = useState<{ field?: string; msg: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const number = latinDigits(episode.trim());
  const folder = slug.trim() || autoSlug(title, number);
  const fieldErr = (f: string) => (err?.field === f ? err.msg : "");
  return (
    <Dialog as="form" labelledBy="new-episode-title" onClose={onClose} width={520}
        noValidate
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          // QA 12 Nov: Arabic messages next to the field, never the browser's English tooltip or a silent no-op.
          if (!title.trim()) return setErr({ field: "title", msg: "اكتب عنوان الحلقة أولًا." });
          if (!/^\d{3}$/.test(number)) return setErr({ field: "episode", msg: "الرقم ثلاث خانات، مثل ٠٠٢." });
          if (taken.includes(number)) return setErr({ field: "episode", msg: `الحلقة ${arDigits(number)} موجودة بالفعل؛ اختر رقمًا آخر.` });
          if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(folder)) return setErr({ field: "slug", msg: "اسم المجلد بحروف إنجليزية صغيرة وأرقام وشرطات فقط، مثل family-conflict." });
          setErr(null);
          setBusy(true);
          try {
            await api.createEpisode({ episode: number, slug: folder, domain, title: title.trim(), ...(inSeries && inSeries !== GENERAL_SLUG ? { series: inSeries } : {}) });
            onCreated(number);
          } catch (x) {
            const m = (x as Error).message;
            setErr({ field: /رقم|الحلقة .* موجودة/.test(m) ? "episode" : /المجلد/.test(m) ? "slug" : undefined, msg: m });
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="modal-head"><h3 id="new-episode-title">حلقة جديدة</h3></div>
        <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label className="field"><span>العنوان (سؤال)</span><input id="new-title" type="text" value={title} onChange={(e) => { setTitle(e.target.value); if (err?.field === "title") setErr(null); }} placeholder={`مثال: ${ph.episodeTitle}`} aria-invalid={Boolean(fieldErr("title"))} aria-describedby={fieldErr("title") ? "new-title-err" : undefined} />
            {fieldErr("title") ? <span id="new-title-err" className="help" role="alert" style={{ color: "var(--err)" }}>{fieldErr("title")}</span> : null}</label>
          <div className="new-ep-grid" style={{ display: "grid", gridTemplateColumns: "100px minmax(0, 1fr)", gap: 10 }}>
            <label className="field"><span>الرقم</span><input id="new-number" type="text" inputMode="numeric" value={episode} onChange={(e) => { setEpisode(arDigits(latinDigits(e.target.value))); if (err?.field === "episode") setErr(null); }} aria-invalid={Boolean(fieldErr("episode"))} aria-describedby={fieldErr("episode") ? "new-number-err" : undefined} /></label>
            <label className="field"><span>اسم المجلد بالإنجليزية (اختياري)</span><input id="new-slug" type="text" dir="ltr" value={slug} onChange={(e) => { setSlug(e.target.value.toLowerCase()); if (err?.field === "slug") setErr(null); }} placeholder={title.trim() ? folder : ph.episodeSlug} aria-invalid={Boolean(fieldErr("slug"))} aria-describedby="new-slug-help" /></label>
          </div>
          {fieldErr("episode") ? <span id="new-number-err" className="help" role="alert" style={{ color: "var(--err)" }}>{fieldErr("episode")}</span> : null}
          <span id="new-slug-help" className="help" style={fieldErr("slug") ? { color: "var(--err)" } : undefined} role={fieldErr("slug") ? "alert" : undefined}>
            {fieldErr("slug") || (slug.trim() ? "" : title.trim() ? `إن تركته فارغًا يُسمّى المجلد «${folder}».` : "إن تركته فارغًا يُسمّى المجلد من العنوان تلقائيًا.")}
          </span>
          {series.length > 1 ? (
            <label className="field">
              <span>السلسلة أو التصنيف (تأخذ الحلقة قالبه وهويته الآن)</span>
              <select id="new-series" value={inSeries} onChange={(e) => setInSeries(e.target.value)}>
                {series.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
          ) : null}
          <label className="field">
            <span>المجال (يحدد الثيم)</span>
            <select id="new-domain" value={domain} onChange={(e) => setDomain(e.target.value)}>
              {domains.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          {err && !err.field ? <div className="help" role="alert" style={{ color: "var(--err)" }}>{err.msg}</div> : null}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button type="button" className="btn" onClick={onClose}>إلغاء</button>
            <button type="submit" className="btn primary" disabled={busy}>{busy ? "جارٍ الإنشاء…" : "إنشاء"}</button>
          </div>
        </div>
    </Dialog>
  );
};
