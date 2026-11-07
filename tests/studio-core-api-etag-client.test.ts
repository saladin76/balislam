import { describe, expect, it } from "vitest";
import { api } from "../app/src/api";
import type { ChannelConfig } from "../src/channel/types";

describe("Studio API client conditional settings writes", () => {
  it("uses the revision of the selected channel only, then advances it after a save", async () => {
    const oldFetch = globalThis.fetch;
    const seen: Array<{ channel: string; method: string; conditional: string | null }> = [];
    globalThis.fetch = async (input, init) => {
      const url = new URL(String(input), "http://127.0.0.1:4321");
      const channel = url.searchParams.get("channel") ?? "";
      const method = init?.method ?? "GET";
      const conditional = new Headers(init?.headers).get("if-match");
      seen.push({ channel, method, conditional });
      const revision = method === "PUT" ? `"new-${channel}"` : `"old-${channel}"`;
      return new Response(method === "GET" ? JSON.stringify({ id: channel }) : '{"ok":true}', {
        status: 200,
        headers: { "content-type": "application/json", etag: revision },
      });
    };
    try {
      const a = "core-revision-a";
      const b = "core-revision-b";
      await api.channelFor(a);
      await api.channelFor(b);
      await api.saveChannelFor(a, { id: a } as ChannelConfig);
      await api.saveChannelFor(b, { id: b } as ChannelConfig);
      await api.saveChannelFor(a, { id: a } as ChannelConfig);
      expect(seen).toEqual([
        { channel: a, method: "GET", conditional: null },
        { channel: b, method: "GET", conditional: null },
        { channel: a, method: "PUT", conditional: '"old-core-revision-a"' },
        { channel: b, method: "PUT", conditional: '"old-core-revision-b"' },
        { channel: a, method: "PUT", conditional: '"new-core-revision-a"' },
      ]);
    } finally {
      globalThis.fetch = oldFetch;
    }
  });
});
