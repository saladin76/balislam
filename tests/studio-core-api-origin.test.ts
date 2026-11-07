import { describe, expect, it } from "vitest";
import type { IncomingMessage } from "node:http";
import { isTrustedLocalRequest } from "../app/server/security";

const request = (method: string, headers: Record<string, string> = {}) =>
  ({ method, headers }) as unknown as IncomingMessage;

describe("loopback API browser-origin policy", () => {
  it("permits normal local Studio writes and curl without Origin", () => {
    expect(isTrustedLocalRequest(request("PUT", { host: "127.0.0.1:4323", origin: "http://127.0.0.1:4323" }))).toBe(true);
    expect(isTrustedLocalRequest(request("POST", { host: "localhost:4321", origin: "http://localhost:4321", "sec-fetch-site": "same-origin" }))).toBe(true);
    expect(isTrustedLocalRequest(request("POST", { host: "127.0.0.1:4323" }))).toBe(true);
    expect(isTrustedLocalRequest(request("GET", { host: "127.0.0.1:4323" }))).toBe(true);
  });

  it("rejects cross-site simple POSTs, foreign origins and confused ports", () => {
    for (const req of [
      request("POST", { host: "127.0.0.1:4323", origin: "https://evil.example" }),
      request("PUT", { host: "127.0.0.1:4323", origin: "http://localhost:4321" }),
      request("DELETE", { host: "127.0.0.1:4323", origin: "http://evil.example" }),
      request("POST", { host: "127.0.0.1:4323", origin: "null" }),
      request("GET", { host: "127.0.0.1:4323", "sec-fetch-site": "cross-site" }),
      request("POST", { host: "127.0.0.1:4323", origin: "http://127.0.0.1:4323", "sec-fetch-site": "cross-site" }),
    ]) expect(isTrustedLocalRequest(req)).toBe(false);
  });
});
