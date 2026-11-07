import { afterEach, describe, expect, it, vi } from "vitest";
import { api, setApiChannel } from "../app/src/api";

const response = (data: unknown = {}) => ({
  ok: true,
  json: async () => data,
});

describe("Studio asynchronous channel isolation", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    setApiChannel("");
  });

  it("binds script, research and identity writes to the channel where the edit began", async () => {
    const calls: { url: string; method: string; json: unknown }[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: string, init?: RequestInit) => {
      calls.push({
        url: String(input), method: init?.method ?? "GET",
        json: init?.body ? JSON.parse(String(init.body)) : undefined,
      });
      return response({ ok: true, plan: { title: "test" }, check: { ok: true } });
    }));
    setApiChannel("dafatir-alzaman");
    const saved = [
      api.saveScript("001", "دفاتر الزمن", "dafatir-alzaman"),
      api.saveResearch("001", "بحث عن التاريخ", "dafatir-alzaman"),
      api.saveIdentity({} as Parameters<typeof api.saveIdentity>[0], "dafatir-alzaman"),
      api.saveChannel({} as Parameters<typeof api.saveChannel>[0], "dafatir-alzaman"),
    ];
    setApiChannel("balislam"); // switched while requests are in flight
    await Promise.all(saved);
    expect(calls).toHaveLength(4);
    for (const call of calls) {
      expect(call.url).toContain("channel=dafatir-alzaman");
      expect(call.url).not.toContain("channel=balislam");
      expect(call.method).toBe("PUT");
    }
    expect(calls[0]?.json).toEqual({ text: "دفاتر الزمن" });
    expect(calls[1]?.json).toEqual({ text: "بحث عن التاريخ" });
    expect(calls[3]?.json).toEqual({ channel: {} });
  });

  it("reads episode, research and verification data from the requested channel", async () => {
    const urls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: string) => {
      urls.push(String(input));
      return response({ files: [], items: [], summary: {} });
    }));
    setApiChannel("zubdat-alkutub");
    await Promise.all([
      api.episodes("balislam"),
      api.episode("001", "balislam"),
      api.research("001", "balislam"),
      api.identity("balislam"),
      api.review("001", "balislam"),
      api.sceneReview("001", "balislam"),
      api.storyboard("001", "balislam"),
      api.status("001", "balislam"),
      api.packageInfo("001", "balislam"),
      api.previews("001", "balislam"),
      api.workflowApprovals("001", "balislam"),
    ]);
    expect(urls).toHaveLength(11);
    for (const url of urls) expect(url).toMatch(/\bchannel=balislam(?:&|$)/);
    expect(urls.filter((url) => url.includes("/episodes/001"))).toHaveLength(9);
    expect(api.previewUrl("001", "review.mp4", "balislam")).toContain("channel=balislam");
    expect(api.packageUrl("001", "master.mp4", false, "balislam")).toContain("channel=balislam");
    expect(api.packageUrl("001", "master.mp4", true, "balislam")).toContain("download=1&channel=balislam");
  });

  it("keeps fallback behavior for existing callers that don't pass a channel", async () => {
    const urls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: string) => {
      urls.push(String(input)); return response();
    }));
    setApiChannel("balislam");
    await api.identity();
    await api.saveScript("002", "نص");
    await api.research("002");
    expect(urls).toHaveLength(3);
    expect(urls.every((url) => url.includes("channel=balislam"))).toBe(true);
  });

  it("does not interpret a failed API response as success", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: false, status: 503, json: async () => ({ error: "workflow unavailable" }),
    })));
    await expect(api.workflowApprovals("001", "balislam")).rejects.toThrow("workflow unavailable");
  });
});
