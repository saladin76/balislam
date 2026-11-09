import { describe, expect, it } from "vitest";
import { assertSceneOwner, isOwnerAuthError } from "../src/studio/sceneService";
import { runOwnerRequest } from "../src/studio/ownerContext";

// Owner decision (9 Nov 2026): no passphrase. The owner is the local process (CLI) or a loopback,
// same-origin Studio request; nothing a caller sends can make another request the owner.
describe("single-operator scene API server authentication", () => {
  it("needs no secret on the owner's own machine (CLI) or from the loopback Studio page", () => {
    expect(() => assertSceneOwner()).not.toThrow();
    expect(() => runOwnerRequest({ remoteAddress: "127.0.0.1", sameOrigin: true, host: "localhost:4321" }, () => assertSceneOwner())).not.toThrow();
  });

  it("refuses a remote or cross-origin Studio request, with the 403 owner-auth code", () => {
    for (const facts of [
      { remoteAddress: "192.168.1.20", sameOrigin: true, host: "127.0.0.1:4321" },
      { remoteAddress: "127.0.0.1", sameOrigin: false, host: "127.0.0.1:4321" },
      { remoteAddress: "127.0.0.1", sameOrigin: true, host: "evil.example" },
    ]) {
      let error: unknown = null;
      try { runOwnerRequest(facts, () => assertSceneOwner()); } catch (e) { error = e; }
      expect(isOwnerAuthError(error), JSON.stringify(facts)).toBe(true);
    }
  });
});
