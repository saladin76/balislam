import {
  type NewReviewNote, type ReviewAdapter, type ReviewDecision, type ReviewEpisode,
  type SceneReviewRecord, type SceneSeed, type OwnerSession,
  type AvReviewStart, type AvReviewTick,
  sameScope,
} from "./model";

/**
 * Adapter to Backend PR #88. No synthetic version, permission, owner identity,
 * media hash, previous approval or AV viewing receipt is created by the browser.
 * Credential and CSRF are kept only in memory (never localStorage/URL).
 */
const SHA256 = /^[a-f0-9]{64}$/;
const REVIEW_ID = /^[a-f0-9]{48}$/;
const CHANNELS = new Set(["balislam", "dafatir-alzaman", "zubdat-alkutub"]);
const SCENE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const EPISODE = /^[0-9]{3}(?:-[a-z0-9]+(?:-[a-z0-9]+)*)?$/;

export class StudioV2HttpError extends Error {
  constructor(readonly status: number, readonly code: string) {
    super(
      status === 401 ? "جلسة مالك Studio V2 غير موجودة أو انتهت. سجّل الدخول." :
      status === 403 ? "رُفض الطلب بسبب الصلاحية أو حماية CSRF. أعد تسجيل الدخول." :
      status === 409 ? "بيانات المشهد تغيرت أو بوابة المراجعة رفضت الطلب. حدّث الحالة." :
      status === 423 ? "ملفات المشهد مقفلة الآن؛ أعد المحاولة بعد انتهاء العملية." :
      status === 503 ? "خادم Studio V2 غير جاهز أو لم تُفعّل متطلباته الآمنة." :
      "رفض خادم Studio V2 الطلب (HTTP " + status + ", " + code + ")."
    );
    this.name = "StudioV2HttpError";
  }
}
const record = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));
const string = (value: unknown): value is string => typeof value === "string";
const decodeSession = (raw: unknown): OwnerSession => {
  if (!record(raw) || raw.authenticated !== true || raw.role !== "owner" ||
    !string(raw.csrfToken) || !SHA256.test(raw.csrfToken) ||
    !string(raw.expiresAt) || !Number.isFinite(Date.parse(raw.expiresAt)))
    throw Error("الخادم لم يعد جلسة مالك موثوقة.");
  return { authenticated: true, role: "owner", csrfToken: raw.csrfToken,
    expiresAt: raw.expiresAt };
};

export const episodeNumber = (value: string): string => {
  if (!EPISODE.test(value)) throw Error("معرف الحلقة يجب أن يبدأ بثلاثة أرقام.");
  return value.slice(0, 3);
};

export const mapBackendSceneSnapshot = (
  raw: unknown, channelId: string, episodeId: string, sources: unknown
): ReviewEpisode => {
  if (!record(raw) || raw.channel !== channelId ||
    !string(raw.episode) || !EPISODE.test(raw.episode) ||
    episodeNumber(raw.episode) !== episodeNumber(episodeId) ||
    (episodeId.length > 3 && raw.episode !== episodeId) ||
    !Number.isSafeInteger(raw.revision) || Number(raw.revision) < 0 ||
    !Array.isArray(raw.scenes) || raw.scenes.length < 1 || raw.scenes.length > 1000) {
    throw Error("قائمة المشاهد من Backend غير متطابقة مع الحلقة المختارة.");
  }
  if (!record(sources) || !record(sources.script) || !record(sources.storyboard) ||
    typeof sources.script.approved !== "boolean" ||
    typeof sources.storyboard.approved !== "boolean")
    throw Error("بيانات اعتماد مصادر الحلقة غير متاحة من Backend.");
  const order: string[] = [];
  const scenes: Record<string, SceneReviewRecord> = {};
  for (const item of raw.scenes) {
    if (!record(item) || !string(item.id) || !SCENE_ID.test(item.id) ||
      Object.hasOwn(scenes, item.id) ||
      !["draft","prepared","producing","in_review","changes_requested",
        "approved","needs_reapproval"].includes(String(item.status)) ||
      !Array.isArray(item.notes) || item.notes.length > 20000 ||
      (item.fingerprint !== undefined &&
       (!string(item.fingerprint) || !SHA256.test(item.fingerprint)))) {
      throw Error("مشهد أو بصمة غير صالحة من Backend؛ لن يُعرض اعتماد غير موثوق.");
    }
    const id = item.id;
    const fingerprint = string(item.fingerprint) ? item.fingerprint : undefined;
    const notes = item.notes.map((note, index) => {
      if (!record(note) || !string(note.text) || !string(note.at) ||
        !Number.isFinite(Date.parse(note.at)) ||
        (note.second !== undefined &&
          (typeof note.second !== "number" || !Number.isFinite(note.second) ||
           note.second < 0)) ||
        (note.elementId !== undefined && !string(note.elementId)))
        throw Error("سجل ملاحظات المشهد غير صالح.");
      return {
        id: id + "-server-note-" + index, versionId: "",
        text: note.text, createdAt: note.at,
        ...(typeof note.second === "number" ? { second: note.second } : {}),
        ...(string(note.elementId) ? { elementId: note.elementId } : {}),
      };
    });
    const status = item.status as SceneReviewRecord["status"];
    scenes[id] = {
      id, status,
      currentVersionId: fingerprint,
      // Backend currently exposes the CURRENT fingerprint, not historical versions.
      // The grouping key below is exactly the server's fingerprint, not a made-up version.
      versions: fingerprint ? [{ id: fingerprint,
        label: "البصمة الحالية (الإصدار غير متاح)", fingerprint }] : [],
      notes,
      permissions: {
        // Backend does not currently provide per-action permission booleans.
        // The UI issues approve ONLY after a server-completed AV receipt.
        approve: false,
        requestChanges: ["in_review","approved","needs_reapproval"].includes(status),
        reasons: [],
      },
    };
    order.push(id);
  }
  const output: ReviewEpisode = {
    channelId, episodeId, revision: Number(raw.revision), order, scenes,
    sourceApprovals: {
      script: sources.script.approved as boolean,
      storyboard: sources.storyboard.approved as boolean,
    },
    serverEpisode: raw.episode,
  };
  if (!sameScope(output, channelId, episodeId)) throw Error("بيانات مراجعة V2 غير صالحة.");
  return output;
};

export function serverReviewAdapter(channelId: string, episodeId: string): ReviewAdapter {
  if (!CHANNELS.has(channelId)) throw Error("قناة Studio V2 غير معروفة.");
  const number = episodeNumber(episodeId);
  const api = "/api/studio-v2";
  const scope = new URLSearchParams({ channel: channelId }).toString();
  const base = api + "/episodes/" + number;
  let csrf: string | null = null;

  async function request<T>(url: string, method = "GET", body?: unknown): Promise<T> {
    const write = method !== "GET";
    if (write && !csrf && !(method === "POST" && url === api + "/session"))
      throw Error("لا توجد جلسة مالك وCSRF صالحة لإرسال تعديل.");
    const res = await fetch(url, {
      method, credentials: "same-origin", cache: "no-store",
      headers: {
        Accept: "application/json",
        ...(write ? { "Content-Type": "application/json" } : {}),
        ...(write && csrf && url !== api + "/session" ? { "x-studio-v2-csrf": csrf } : {}),
      },
      ...(write ? { body: JSON.stringify(body ?? {}) } : {}),
    });
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) csrf = null;
      let code = "HTTP_" + res.status;
      try {
        const error: unknown = await res.json();
        if (record(error) && string(error.code)) code = error.code;
      } catch { /* preserve status */ }
      throw new StudioV2HttpError(res.status, code);
    }
    const type = res.headers.get("content-type") ?? "";
    if (!type.toLowerCase().includes("application/json"))
      throw Error("استجابة الخادم ليست JSON موثوقًا.");
    return await res.json() as T;
  }
  async function session(): Promise<OwnerSession> {
    try {
      const data = decodeSession(await request(api + "/session"));
      csrf = data.csrfToken;
      return data;
    } catch (error) { csrf = null; throw error; }
  }
  async function login(secret: string): Promise<OwnerSession> {
    if (!secret.trim()) throw Error("أدخل سر مالك Studio V2.");
    csrf = null;
    const data = decodeSession(await request(api + "/session", "POST", { secret }));
    csrf = data.csrfToken;
    return data;
  }
  async function logout(): Promise<void> {
    try { await request(api + "/session", "DELETE"); }
    finally { csrf = null; }
  }
  async function load(): Promise<ReviewEpisode> {
    if (!csrf) await session();
    const [raw, sources] = await Promise.all([
      request<unknown>(base + "/scenes?" + scope),
      request<unknown>(base + "/sources?" + scope),
    ]);
    return mapBackendSceneSnapshot(raw, channelId, episodeId, sources);
  }
  const scenePath = (id: string) => {
    if (!SCENE_ID.test(id)) throw Error("معرف المشهد غير صالح.");
    return base + "/scenes/" + encodeURIComponent(id);
  };
  const reviewPath = (sceneId: string, reviewId: string) => {
    if (!REVIEW_ID.test(reviewId)) throw Error("معرف مراجعة AV غير صالح.");
    return scenePath(sceneId) + "/review/" + reviewId;
  };
  return {
    mode: "server", session, login, logout, load,
    async startReview(sceneId: string, fingerprint: string) {
      if (!SHA256.test(fingerprint)) throw Error("بصمة AV الحالية غير متاحة.");
      const value = await request<unknown>(scenePath(sceneId) +
        "/review/start?" + scope, "POST", { expectedFingerprint: fingerprint });
      if (!record(value) || !string(value.reviewId) ||
          !REVIEW_ID.test(value.reviewId) || !string(value.challenge) ||
          !REVIEW_ID.test(value.challenge) || value.fingerprint !== fingerprint ||
          typeof value.durationSec !== "number" || !Number.isFinite(value.durationSec) ||
          value.durationSec <= 0 || value.durationSec > 28800 ||
          !string(value.mediaUrl))
        throw Error("Backend أعاد جلسة مشاهدة غير مكتملة أو غير مطابقة.");
      const media = new URL(value.mediaUrl, window.location.origin);
      if (media.origin !== window.location.origin ||
          media.pathname !== scenePath(sceneId) + "/media" ||
          media.searchParams.get("channel") !== channelId ||
          media.searchParams.get("reviewId") !== value.reviewId ||
          media.searchParams.size !== 2)
        throw Error("رابط MP4 لم يطابق نطاق المشهد وجلسة المالك.");
      return {
        reviewId: value.reviewId, challenge: value.challenge,
        fingerprint: value.fingerprint, durationSec: value.durationSec,
        mediaUrl: media.pathname + media.search,
      } satisfies AvReviewStart;
    },
    async tickReview(sceneId: string, reviewId: string, challenge: string, positionSec: number) {
      if (!REVIEW_ID.test(challenge) || !Number.isFinite(positionSec) || positionSec < 0)
        throw Error("نقطة مشاهدة AV غير صالحة.");
      const response = await request<unknown>(reviewPath(sceneId, reviewId) +
        "/tick?" + scope, "POST", { challenge, positionSec });
      if (!record(response) || !string(response.challenge) ||
        !REVIEW_ID.test(response.challenge) ||
        typeof response.playedSec !== "number" || !Number.isFinite(response.playedSec) ||
        response.playedSec < 0 || response.playedSec > positionSec + 0.001)
        throw Error("لم يقبل Backend نقطة المشاهدة المرسلة.");
      return { challenge: response.challenge, playedSec: response.playedSec } satisfies AvReviewTick;
    },
    async finishReview(sceneId: string, reviewId: string, fingerprint: string) {
      const result = await request<unknown>(reviewPath(sceneId, reviewId) +
        "/finish?" + scope, "POST", { confirmation: "reviewed_av" });
      if (!record(result) || result.completed !== true ||
          result.sceneId !== sceneId || result.fingerprint !== fingerprint)
        throw Error("لم يؤكد Backend اكتمال مشاهدة الإصدار المحدد.");
    },
    async addNote(_input: NewReviewNote) {
      // Backend #88 has no stand-alone note writer. Never silently turn
      // a normal note into "request_changes" (which invalidates approval).
      throw Error("Backend #88 لا يدعم حفظ ملاحظة مستقلة. استخدم «طلب تعديل» لتسجيل تصحيح خادمي صريح.");
    },
    async decide(input: ReviewDecision) {
      if (input.action === "approve" &&
          (!input.reviewId || !REVIEW_ID.test(input.reviewId)))
        throw Error("اعتماد AV يتطلب معرّف مراجعة مكتملة من الخادم.");
      const body: Record<string, unknown> = {
        action: input.action,
        ...(input.action === "approve" ? {
          expectedFingerprint: input.expectedFingerprint, reviewId: input.reviewId,
        } : {
          note: input.note,
          ...(input.second !== undefined ? { second: input.second } : {}),
          ...(input.elementId ? { elementId: input.elementId } : {}),
        }),
      };
      const outcome = await request<unknown>(scenePath(input.sceneId) +
        "/commands?" + scope, "POST", body);
      if (!record(outcome) || outcome.ok !== true ||
        outcome.sceneId !== input.sceneId || outcome.action !== input.action)
        throw Error("لم يؤكد Backend تسجيل القرار.");
      return load();
    },
  };
}

/** QA adapter: temporary notes are held in this browser instance only. NEVER approves. */
export function demoReviewAdapter(channelId: string, episodeId: string, seeds: SceneSeed[], videoUrl?: string): ReviewAdapter {
  const order = seeds.map(s => s.id);
  const scenes: Record<string, SceneReviewRecord> = {};
  seeds.forEach((s, i) => {
    const status: SceneReviewRecord["status"] =
      i === 0 ? "in_review" : i === 1 ? "prepared" : i === 2 ? "changes_requested" : "draft";
    const versionId = "qa-" + s.id + "-v2";
    scenes[s.id] = {
      id: s.id, status, currentVersionId: versionId,
      versions: [{
        id: versionId, label: "QA v2", fingerprint: "qa-only-not-a-real-fingerprint",
        createdAt: "2026-11-08T09:00:00.000Z",
        ...(i === 0 && videoUrl ? { video: { url: videoUrl, mime: "video/mp4" as const, durationSec: 8, width: 1280, height: 720, hasAudio: true } } : {}),
        ...(i === 0 ? { changes: [{ field: "التوقيت", before: "10 ثوانٍ (تخطيطي)", after: "8 ثوانٍ (اختبار QA)" }] } : {}),
      }, {
        id: "qa-" + s.id + "-v1", label: "QA v1", fingerprint: "qa-previous-only",
        changes: [],
      }],
      notes: [],
      permissions: { approve: false, requestChanges: false, reasons: ["الاعتماد الفعلي يحتاج خادمًا موثوقًا."] },
    };
  });
  let data: ReviewEpisode = { channelId, episodeId, revision: 1, order, scenes };
  const snapshot = () => structuredClone(data);
  return {
    mode: "demo",
    async session() { throw Error("لا توجد جلسة مالك في وضع QA."); },
    async login(_secret) { throw Error("ممنوع تسجيل اعتماد حقيقي من وضع QA."); },
    async logout() { /* QA has no server session. */ },
    async startReview(_sceneId, _fingerprint) { throw Error("مراجعة QA ليست دليل مشاهدة معتمدًا."); },
    async tickReview(_sceneId, _reviewId, _challenge, _positionSec) { throw Error("QA ليست مراجعة AV معتمدة."); },
    async finishReview(_sceneId, _reviewId, _fingerprint) { throw Error("QA ليست مراجعة AV معتمدة."); },
    async load() { return snapshot(); },
    async addNote(input) {
      const scene = data.scenes[input.sceneId];
      if (!scene || scene.currentVersionId !== input.versionId)
        throw Error("إصدار المشهد تغير؛ حدّث قبل تسجيل الملاحظة.");
      scene.notes.push({
        id: "qa-note-" + (scene.notes.length + 1), versionId: input.versionId,
        text: input.text, second: input.second, elementId: input.elementId,
        createdAt: new Date().toISOString(),
      });
      data = { ...data, revision: data.revision + 1 };
      return snapshot();
    },
    async decide(_input) {
      throw Error("هذه معاينة اختبارية، ولا يمكنها تنفيذ اعتماد أو طلب تعديل حقيقي.");
    },
  };
}
