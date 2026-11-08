import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { episodeNumber, mapBackendSceneSnapshot, serverReviewAdapter, StudioV2HttpError } from "./adapter";

const fp = "a".repeat(64);
const csrf = "b".repeat(64);
const reviewId = "c".repeat(48);
const challenge = "d".repeat(48);
const nextChallenge = "e".repeat(48);
const session = { authenticated: true, role: "owner", csrfToken: csrf,
  expiresAt: "2026-11-08T12:00:00.000Z" };
const sources = {
  script: { approved: true, fingerprint: "f".repeat(64) },
  storyboard: { approved: true, fingerprint: "f".repeat(64) },
};
const scenes = { channel: "balislam", episode: "001-example", revision: 12,
  scenes: [{ id: "c1-s1", status: "in_review", fingerprint: fp,
    notes: [{ at: "2026-11-08T08:00:00.000Z", text: "الصوت متقدم", second: 3.1,
      elementId: "title" }] },
    { id: "c1-s2", status: "prepared", notes: [] }] };
const mediaUrl = "/api/studio-v2/episodes/001/scenes/c1-s1/media" +
  "?channel=balislam&reviewId=" + reviewId;

type Call = { url: string; method: string; body: Record<string, unknown>; headers: Record<string, string> };
const makeResponse = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { "content-type": "application/json; charset=utf-8" },
});

beforeEach(() => {
  vi.stubGlobal("window", { location: { origin: "http://127.0.0.1:4322" } });
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("Studio V2 real Backend contract adapter", () => {
  it("maps only canonical Backend fields, preserving missing versions and actual notes", () => {
    const data = mapBackendSceneSnapshot(scenes, "balislam", "001", sources);
    expect(data.order).toEqual(["c1-s1", "c1-s2"]);
    expect(data.serverEpisode).toBe("001-example");
    expect(data.scenes["c1-s1"]?.currentVersionId).toBe(fp);
    expect(data.scenes["c1-s1"]?.versions[0]?.video).toBeUndefined();
    expect(data.scenes["c1-s1"]?.permissions.approve).toBe(false);
    expect(data.scenes["c1-s1"]?.notes[0]?.second).toBe(3.1);
    expect(data.scenes["c1-s1"]?.notes[0]?.versionId).toBe("");
    expect(data.scenes["c1-s2"]?.versions).toHaveLength(0);
    expect(episodeNumber("001-example")).toBe("001");
    expect(() => episodeNumber("../../secret")).toThrow();
  });
  it("rejects foreign scopes, duplicate scene ids and malformed signatures", () => {
    expect(() => mapBackendSceneSnapshot({ ...scenes, channel: "other" },
      "balislam", "001", sources)).toThrow();
    expect(() => mapBackendSceneSnapshot(scenes, "balislam", "001-wrong", sources)).toThrow();
    expect(() => mapBackendSceneSnapshot({ ...scenes,
      scenes: [scenes.scenes[0], scenes.scenes[0]] }, "balislam", "001", sources)).toThrow();
    expect(() => mapBackendSceneSnapshot({ ...scenes,
      scenes: [{ ...scenes.scenes[0], fingerprint: "fake" }] },
      "balislam", "001", sources)).toThrow();
    expect(() => mapBackendSceneSnapshot(scenes, "balislam", "001", {})).toThrow();
  });
  it("uses owner session cookies, CSRF, exact episode routes, challenge, finish and explicit decision", async () => {
    const calls: Call[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
      const method = init.method || "GET";
      const body = init.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {};
      const headers = init.headers as Record<string, string>;
      calls.push({ url, method, body, headers });
      if (url === "/api/studio-v2/session" && method === "POST") return makeResponse(session);
      if (url.endsWith("/scenes?channel=balislam") && method === "GET") return makeResponse(scenes);
      if (url.endsWith("/sources?channel=balislam") && method === "GET") return makeResponse(sources);
      if (url.includes("/review/start?")) return makeResponse({
        reviewId, challenge, fingerprint: fp, durationSec: 8, mediaUrl,
      });
      if (url.includes("/tick?")) return makeResponse({ challenge: nextChallenge, playedSec: 1.25 });
      if (url.includes("/finish?")) return makeResponse({
        completed: true, sceneId: "c1-s1", fingerprint: fp,
      });
      if (url.includes("/commands?")) return makeResponse({
        ok: true, sceneId: "c1-s1", action: body.action,
      });
      throw Error("Unexpected API call " + url);
    }));
    const adapter = serverReviewAdapter("balislam", "001");
    const owner = await adapter.login("owner-secret-kept-in-memory");
    expect(owner.csrfToken).toBe(csrf);
    const loaded = await adapter.load();
    expect(loaded.scenes["c1-s1"]?.status).toBe("in_review");
    const receipt = await adapter.startReview("c1-s1", fp);
    expect(receipt.mediaUrl).toBe(mediaUrl);
    expect((await adapter.tickReview("c1-s1", reviewId, challenge, 1.25)).challenge)
      .toBe(nextChallenge);
    await adapter.finishReview("c1-s1", reviewId, fp);
    await adapter.decide({ sceneId: "c1-s1", expectedFingerprint: fp,
      action: "approve", reviewId });
    expect(calls[0]?.body).toEqual({ secret: "owner-secret-kept-in-memory" });
    expect(calls[0]?.headers["x-studio-v2-csrf"]).toBeUndefined();
    const writes = calls.filter(c => c.method === "POST" && c.url !== "/api/studio-v2/session");
    expect(writes).toHaveLength(4);
    for (const call of writes) {
      expect(call.headers["x-studio-v2-csrf"]).toBe(csrf);
      expect(call.headers["Content-Type"]).toBe("application/json");
      expect(JSON.stringify(call.body)).not.toMatch(/"ownerId"|"actor"|"watched"|"approved"|"path"/);
      expect(call.url).toContain("channel=balislam");
    }
    expect(writes.map(c => c.body)).toEqual([
      { expectedFingerprint: fp },
      { challenge, positionSec: 1.25 },
      { confirmation: "reviewed_av" },
      { action: "approve", expectedFingerprint: fp, reviewId },
    ]);
  });
  it("never turns a standalone note into a silent state-changing command", async () => {
    const adapter = serverReviewAdapter("balislam", "001");
    await expect(adapter.addNote({
      sceneId: "c1-s1", versionId: fp, expectedFingerprint: fp,
      text: "تصحيح", second: 2,
    })).rejects.toThrow("لا يدعم");
  });
  it("records explicit timecoded correction using Backend commands, not /notes", async () => {
    const calls: Call[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
      const body = init.body ? JSON.parse(String(init.body)) : {};
      calls.push({ url, method: init.method || "GET", body, headers: init.headers as Record<string, string> });
      if (url === "/api/studio-v2/session") return makeResponse(session);
      if (url.includes("/commands?")) return makeResponse({
        ok: true, sceneId: "c1-s1", action: "request_changes",
      });
      if (url.includes("/sources?")) return makeResponse(sources);
      if (url.includes("/scenes?")) return makeResponse(scenes);
      throw Error("Unknown request");
    }));
    const adapter = serverReviewAdapter("balislam", "001");
    await adapter.session();
    await adapter.decide({ sceneId: "c1-s1", expectedFingerprint: fp,
      action: "request_changes", note: "حركة سريعة", second: 3.5, elementId: "camera" });
    const action = calls.find(c => c.url.includes("/commands?"))!;
    expect(action.body).toEqual({ action: "request_changes", expectedFingerprint: fp,
      note: "حركة سريعة", second: 3.5, elementId: "camera" });
    expect(action.headers["x-studio-v2-csrf"]).toBe(csrf);
  });
  it("fails closed on 401 and 403, never retaining an expired CSRF token", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => makeResponse({
      ok: false, code: "V2_SESSION_REQUIRED",
    }, 401)));
    const adapter = serverReviewAdapter("balislam", "001");
    await expect(adapter.session()).rejects.toBeInstanceOf(StudioV2HttpError);
    await expect(adapter.startReview("c1-s1", fp)).rejects.toThrow("CSRF");
  });
  it("drops in-memory CSRF after a real Backend 403 and refuses further writes", async () => {
    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
      calls.push(url);
      if (url === "/api/studio-v2/session") return makeResponse(session);
      return makeResponse({ ok: false, code: "V2_CSRF_REJECTED" }, 403);
    }));
    const adapter = serverReviewAdapter("balislam", "001");
    await adapter.session();
    await expect(adapter.startReview("c1-s1", fp)).rejects.toMatchObject({
      status: 403, code: "V2_CSRF_REJECTED",
    });
    await expect(adapter.startReview("c1-s1", fp)).rejects.toThrow("CSRF");
    expect(calls).toHaveLength(2);
  });
  it("rejects a server response claiming AV finish for another scene", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url === "/api/studio-v2/session") return makeResponse(session);
      if (url.includes("/finish?")) return makeResponse({
        completed: true, sceneId: "c1-s2", fingerprint: fp,
      });
      throw Error("Unexpected request");
    }));
    const adapter = serverReviewAdapter("balislam", "001");
    await adapter.session();
    await expect(adapter.finishReview("c1-s1", reviewId, fp)).rejects.toThrow("لم يؤكد");
  });
  it("rejects media URL outside the exact server-scoped protected path", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
      if (url === "/api/studio-v2/session") return makeResponse(session);
      if (url.includes("/review/start?")) return makeResponse({
        reviewId, challenge, fingerprint: fp, durationSec: 8,
        mediaUrl: "https://evil.example/media?channel=balislam&reviewId=" + reviewId,
      });
      throw Error("Unexpected request");
    }));
    const adapter = serverReviewAdapter("balislam", "001");
    await adapter.session();
    await expect(adapter.startReview("c1-s1", fp)).rejects.toThrow("رابط MP4");
  });
});
