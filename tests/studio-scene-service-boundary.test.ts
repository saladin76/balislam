import { afterEach, describe, expect, it } from "vitest";
import { assertSceneOwner } from "../src/studio/sceneService";

const original = process.env.BAL_STUDIO_OWNER_TOKEN;
afterEach(() => {
  if (original === undefined) delete process.env.BAL_STUDIO_OWNER_TOKEN;
  else process.env.BAL_STUDIO_OWNER_TOKEN = original;
});

describe("single-operator scene API server authentication", () => {
  it("fails closed when the owner session secret is not configured", () => {
    delete process.env.BAL_STUDIO_OWNER_TOKEN;
    expect(() => assertSceneOwner("anything")).toThrow(/not configured/);
  });

  it("rejects wrong, malformed or forged credentials without leaking the secret", () => {
    process.env.BAL_STUDIO_OWNER_TOKEN = "owner-local-session-very-long-secret-2026";
    expect(() => assertSceneOwner("wrong")).toThrow(/authentication/);
    expect(() => assertSceneOwner({ role: "owner", approved: true })).toThrow(/authentication/);
    expect(() => assertSceneOwner("x".repeat(5000))).toThrow(/authentication/);
    expect(() => assertSceneOwner(process.env.BAL_STUDIO_OWNER_TOKEN)).not.toThrow();
  });
});
