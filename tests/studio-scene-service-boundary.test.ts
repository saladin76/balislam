import { createHash } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { assertSceneOwner } from "../src/studio/sceneService";

const KEY = "BAL_STUDIO_OWNER_PASSPHRASE_SHA256";
const original = process.env[KEY];
afterEach(() => {
  if (original === undefined) delete process.env[KEY];
  else process.env[KEY] = original;
});
const sha = (v: string) => createHash("sha256").update(v).digest("hex");

describe("single-operator scene API server authentication", () => {
  it("fails closed until the owner sets a passphrase", () => {
    delete process.env[KEY];
    expect(() => assertSceneOwner("anything")).toThrow(/passphrase/);
  });

  it("accepts only the owner's passphrase; only its hash is configured", () => {
    const passphrase = "owner-local-passphrase-2026";
    process.env[KEY] = sha(passphrase);
    expect(() => assertSceneOwner("wrong")).toThrow(/authentication/);
    expect(() => assertSceneOwner({ role: "owner", approved: true })).toThrow(/authentication/);
    expect(() => assertSceneOwner("x".repeat(5000))).toThrow(/authentication/);
    // The stored hash itself is not a credential.
    expect(() => assertSceneOwner(process.env[KEY])).toThrow(/authentication/);
    expect(() => assertSceneOwner(passphrase)).not.toThrow();
  });
});
