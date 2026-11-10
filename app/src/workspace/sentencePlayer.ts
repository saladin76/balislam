/**
 * مشغّل الجمل للصفحة كلها (D62): صوت واحد فقط في كل لحظة.
 *
 * - مقطع = ملف (تسجيل الجملة، أو صوت المشهد ملفًا واحدًا) ومعه حدّا البداية والنهاية إن كان جزءًا منه؛
 *   يُقفز إلى البداية ويتوقف وحده عند النهاية (يُفحص كل إطار، لا كل ربع ثانية).
 * - «شغّل المشهد متتابعًا» قائمة مقاطع بوقفاتها؛ الإيقاف المؤقت يوقف الوقفة بين جملتين أيضًا.
 * - تشغيل أي مقطع يوقف كل صوت أو فيديو آخر في الصفحة (معاينة المشهد مثلًا)، وتشغيل أي وسيط آخر يوقفه.
 * - لكل تشغيل مالك (لوحة الجمل التي بدأته): تغيير المشهد أو إغلاق اللوحة يوقف ما بدأته وحده.
 */

export type Clip = {
  /** معرّف الجملة (أو المشهد) الذي يُبرز أثناء تشغيله */
  id: string;
  url: string;
  /** ثوانٍ داخل الملف؛ بلا start من أوله، وبلا end حتى نهايته */
  start?: number;
  end?: number;
  /** وقفة بعد المقطع قبل التالي */
  pauseAfterMs?: number;
  /** الحدود تقديرية بعدد الأحرف (لا توقيت كلمات) */
  estimated?: boolean;
};

export type PlayerState = {
  key: string;
  owner: string;
  /** الجملة الجارية */
  id: string;
  index: number;
  count: number;
  paused: boolean;
  /** ٠–١ داخل المقطع الجاري */
  progress: number;
  estimated: boolean;
};

type AudioLike = Pick<HTMLAudioElement, "play" | "pause" | "currentTime" | "duration" | "readyState" | "paused" | "addEventListener" | "removeEventListener" | "src"> & {
  onended: ((this: GlobalEventHandlers, ev: Event) => unknown) | null;
  onerror: OnErrorEventHandler;
};

export type PlayerDeps = {
  createAudio?: (url: string) => AudioLike;
  doc?: Document | null;
  raf?: (cb: () => void) => number;
  caf?: (id: number) => void;
};

export type SentencePlayer = ReturnType<typeof createSentencePlayer>;

export const createSentencePlayer = (deps: PlayerDeps = {}) => {
  const createAudio = deps.createAudio ?? ((url: string) => new Audio(url) as AudioLike);
  const doc = deps.doc === undefined ? (typeof document !== "undefined" ? document : null) : deps.doc;
  const raf = deps.raf ?? ((cb: () => void) => (typeof requestAnimationFrame !== "undefined" ? requestAnimationFrame(cb) : (setTimeout(cb, 16) as unknown as number)));
  const caf = deps.caf ?? ((id: number) => (typeof cancelAnimationFrame !== "undefined" ? cancelAnimationFrame(id) : clearTimeout(id)));

  let state: PlayerState | null = null;
  let clips: Clip[] = [];
  let audio: AudioLike | null = null;
  let gap: ReturnType<typeof setTimeout> | null = null;
  /** وقفة بين مقطعين أُوقفت مؤقتًا: يُكمل منها عند الاستئناف */
  let pendingNext: number | null = null;
  let frame: number | null = null;
  /** رسائل الخطأ لكل مالك (اللوحة التي بدأت التشغيل) */
  const onErrors = new Map<string, (msg: string) => void>();
  const fail = (msg: string) => { const o = state?.owner; if (o !== undefined) onErrors.get(o)?.(msg); };
  const subs = new Set<(s: PlayerState | null) => void>();

  const emit = () => { for (const f of subs) f(state); };
  const set = (patch: Partial<PlayerState> | null) => {
    state = patch === null ? null : state ? { ...state, ...patch } : null;
    emit();
  };

  const stopLoop = () => { if (frame !== null) caf(frame); frame = null; };
  const detach = () => {
    stopLoop();
    if (gap) clearTimeout(gap);
    gap = null; pendingNext = null;
    if (audio) {
      audio.onended = null; audio.onerror = null;
      audio.removeEventListener("timeupdate", onTime);
      try { audio.pause(); } catch { /* jsdom */ }
    }
    audio = null;
  };

  const stop = () => {
    if (!state && !audio) return;
    detach();
    clips = [];
    set(null);
  };

  /** يفحص الموضع: يحدّث التقدم، وعند حد المقطع ينهيه (التوقف التلقائي عند نهاية الجملة) */
  const check = () => {
    if (!audio || !state) return;
    const c = clips[state.index];
    if (!c) return;
    const from = c.start ?? 0;
    const dur = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0;
    const to = c.end ?? dur;
    const t = audio.currentTime;
    if (c.end !== undefined && t >= c.end - 0.01) { finishClip(); return; }
    const p = to > from ? Math.min(1, Math.max(0, (t - from) / (to - from))) : 0;
    if (Math.abs(p - state.progress) > 0.004) set({ progress: p });
  };
  function onTime() { check(); }
  const loop = () => {
    stopLoop();
    const tick = () => { frame = null; check(); if (audio && state && !state.paused) frame = raf(tick); };
    frame = raf(tick);
  };

  const finishClip = () => {
    if (!state) return;
    const k = state.index;
    const c = clips[k];
    detach();
    if (k + 1 >= clips.length) { clips = []; set(null); return; }
    set({ progress: 1 });
    const next = k + 1;
    const wait = Math.max(0, c?.pauseAfterMs ?? 0);
    if (state.paused) { pendingNext = next; return; }
    pendingNext = next;
    gap = setTimeout(() => { gap = null; pendingNext = null; startClip(next); }, wait);
  };

  const pauseOthers = () => {
    if (!doc) return;
    doc.querySelectorAll<HTMLMediaElement>("audio, video").forEach((el) => {
      if (el !== (audio as unknown) && !el.paused) { try { el.pause(); } catch { /* ignore */ } }
    });
  };

  const startClip = (k: number) => {
    const c = clips[k];
    if (!c || !state) { stop(); return; }
    const a = createAudio(c.url);
    audio = a;
    set({ index: k, id: c.id, progress: 0, paused: false, estimated: Boolean(c.estimated) });
    a.onended = () => finishClip();
    a.onerror = () => { if (audio === a) { fail("تعذّر تشغيل الملف."); finishClip(); } };
    a.addEventListener("timeupdate", onTime);
    const go = () => {
      if (audio !== a) return;
      if (c.start !== undefined && c.start > 0) { try { a.currentTime = c.start; } catch { /* ignore */ } }
      pauseOthers();
      const p = a.play();
      const ok = () => { if (audio === a) loop(); };
      if (p && typeof (p as Promise<void>).then === "function")
        (p as Promise<void>).then(ok, () => { if (audio === a) { fail("يتطلب المتصفح الضغط على تشغيل مرة أخرى."); stop(); } });
      else ok();
    };
    if (c.start === undefined || c.start <= 0 || a.readyState >= 1) go();
    else a.addEventListener("loadedmetadata", go, { once: true } as AddEventListenerOptions);
  };

  const play = (key: string, list: Clip[], owner = "") => {
    stop();
    if (!list.length) return false;
    clips = list;
    state = { key, owner, id: list[0]!.id, index: 0, count: list.length, paused: false, progress: 0, estimated: Boolean(list[0]!.estimated) };
    emit();
    startClip(0);
    return true;
  };

  const pause = () => {
    if (!state || state.paused) return;
    stopLoop();
    if (gap) { clearTimeout(gap); gap = null; }
    try { audio?.pause(); } catch { /* ignore */ }
    set({ paused: true });
  };
  const resume = () => {
    if (!state || !state.paused) return;
    set({ paused: false });
    if (pendingNext !== null && !audio) { const n = pendingNext; pendingNext = null; startClip(n); return; }
    if (!audio) return;
    pauseOthers();
    const a = audio;
    const p = a.play();
    if (p && typeof (p as Promise<void>).then === "function") (p as Promise<void>).then(() => { if (audio === a) loop(); }, () => stop());
    else loop();
  };
  /** الضغط على زر التشغيل نفسه: إيقاف مؤقت أو استئناف */
  const toggle = () => { if (state?.paused) resume(); else pause(); };

  // أي وسيط آخر في الصفحة يبدأ (معاينة المشهد، تلاوة…) يوقف الجملة
  const onAnyPlay = (e: Event) => { if (state && e.target !== (audio as unknown)) stop(); };
  doc?.addEventListener("play", onAnyPlay, true);

  return {
    play,
    pause,
    resume,
    toggle,
    stop,
    /** يوقف ما بدأه هذا المالك وحده (تغيير المشهد، إغلاق اللوحة) */
    stopOwner: (owner: string) => { if (state?.owner === owner) stop(); },
    state: () => state,
    subscribe: (f: (s: PlayerState | null) => void) => { subs.add(f); return () => { subs.delete(f); }; },
    setErrorHandler: (owner: string, f: ((msg: string) => void) | null) => { if (f) onErrors.set(owner, f); else onErrors.delete(owner); },
    dispose: () => { stop(); doc?.removeEventListener("play", onAnyPlay, true); subs.clear(); onErrors.clear(); },
  };
};

let page: SentencePlayer | null = null;
/** المشغّل الواحد للصفحة */
export const pagePlayer = (): SentencePlayer => (page ??= createSentencePlayer());
/** للاختبارات: يستبدل مشغّل الصفحة */
export const setPagePlayer = (p: SentencePlayer | null) => { page?.dispose(); page = p; };

/**
 * مقطع جملة واحدة: تسجيلها إن كان لها، وإلا جزؤها من صوت المشهد بحدّيها (من توقيت الكلمات، أو تقديرًا بالأحرف).
 * null: لا صوت لها.
 */
export const sentenceClip = (
  row: { id: string; text: string; audio: { file: string } | null; sceneSpan?: { start: number; end: number; timing: "words" | "estimated" } | null },
  scene: { audio: { state: string; file: string | null; duration: number | null }; rows: { id: string; text: string }[] },
  urlOf: (file: string, kind: "sentences" | "voice") => string,
): Clip | null => {
  if (row.audio) return { id: row.id, url: urlOf(row.audio.file, "sentences") };
  if (!scene.audio.file || scene.audio.state !== "scene") return null;
  const span = row.sceneSpan ?? estimateSpan(scene.rows.map((r) => r.text), scene.rows.findIndex((r) => r.id === row.id), scene.audio.duration ?? 0);
  if (!span) return null;
  return { id: row.id, url: urlOf(scene.audio.file, "voice"), start: span.start, end: span.end, estimated: span.timing === "estimated" };
};

/** تقدير حدود جملة بنسبة أحرفها من مدة الملف (حين لا يرسل الخادم حدودها) */
export const estimateSpan = (texts: string[], k: number, duration: number): { start: number; end: number; timing: "estimated" } | null => {
  if (k < 0 || !(duration > 0)) return null;
  const len = texts.map((t) => t.trim().split(/\s+/).filter(Boolean).join(" ").length);
  const sum = len.reduce((a, b) => a + b, 0) || 1;
  const before = len.slice(0, k).reduce((a, b) => a + b, 0);
  return { start: (before / sum) * duration, end: ((before + len[k]!) / sum) * duration, timing: "estimated" };
};
