import {
  type NewReviewNote, type PlaybackEvent, type ReviewAdapter,
  type ReviewDecision, type ReviewEpisode, type SceneReviewRecord, type SceneSeed,
  sameScope,
} from "./model";

/** Explicit not-yet-implemented HTTP boundary. No legacy /scene-review calls. */
export function serverReviewAdapter(channelId: string, episodeId: string): ReviewAdapter {
  const base = "/api/studio-v2/channels/" + encodeURIComponent(channelId) +
    "/episodes/" + encodeURIComponent(episodeId) + "/scene-review";
  async function request<T>(path: string, method = "GET", body?: unknown): Promise<T> {
    const res = await fetch(base + path, {
      method, credentials: "same-origin", cache: "no-store",
      headers: { "Accept": "application/json", ...(body ? { "Content-Type": "application/json" } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!res.ok) throw Error("خدمة مراجعة V2 غير متاحة أو رفضت الطلب (HTTP " + res.status + ").");
    if (res.status === 204) return undefined as T;
    const type = res.headers.get("content-type") || "";
    if (!type.includes("application/json")) throw Error("استجابة مراجعة V2 ليست JSON معتمدًا.");
    return res.json() as Promise<T>;
  }
  async function load(): Promise<ReviewEpisode> {
    const data = await request<ReviewEpisode>("");
    if (!sameScope(data, channelId, episodeId)) throw Error("بيانات مراجعة الحلقة لا تطابق نطاقها.");
    return data;
  }
  const scenePath = (id: string) => "/scenes/" + encodeURIComponent(id);
  return {
    mode: "server",
    load,
    async addNote(input: NewReviewNote) {
      await request(scenePath(input.sceneId) + "/notes", "POST", {
        versionId: input.versionId, expectedFingerprint: input.expectedFingerprint,
        text: input.text, ...(input.second !== undefined ? { second: input.second } : {}),
        ...(input.elementId ? { elementId: input.elementId } : {}),
      });
      return load();
    },
    async decide(input: ReviewDecision) {
      // The backend derives authenticated owner, proof and current hashes.
      // Never send watched/approved or client assertions about review completion.
      await request(scenePath(input.sceneId) + "/decisions", "POST", {
        action: input.action, sceneId: input.sceneId,
        expectedFingerprint: input.expectedFingerprint,
        ...(input.note ? { note: input.note } : {}),
        ...(input.second !== undefined ? { second: input.second } : {}),
        ...(input.elementId ? { elementId: input.elementId } : {}),
      });
      return load();
    },
    async playback(event: PlaybackEvent) {
      await request(scenePath(event.sceneId) + "/playback-events", "POST", event);
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
    async playback(_event) {
      // QA playback data is never accepted as viewing evidence.
    },
  };
}
