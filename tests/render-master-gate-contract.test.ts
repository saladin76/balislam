import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { assertRenderMediaOwnership, assertRenderChannelOwnership } from "../src/render/episode";
import { assertMasterStageAuthorized, masterRenderSubject } from "../src/render/masterGateContract";
import type { EpisodeMedia } from "../src/plan/media";
import type { Plan } from "../src/plan/types";

const owned: string[] = [];
const setup = async () => {
  const root = await mkdtemp(path.join(tmpdir(), "studio-master-contract-"));
  owned.push(root);
  const scriptPath = path.join(root, "channels", "balislam", "episodes", "001-test", "script.md");
  await mkdir(path.dirname(scriptPath), { recursive: true });
  await writeFile(scriptPath, "# v1");
  return scriptPath;
};
afterEach(async () => { for (const p of owned.splice(0)) await rm(p, { recursive: true, force: true }); });
const plan = { version: 1, episode: "001", title: "Example", chapters: [] } as unknown as Plan;
const media = (digest: string): EpisodeMedia => ({
  mode: "static", base: `_render/balislam/001-test/${digest}/`,
  voice: {}, sfx: [], recitations: {},
});

describe("render input identity and permanent Master gate contract", () => {
  it("rejects another channel or episode even when a caller supplies the media object", async () => {
    const script = await setup();
    const own = media("a".repeat(24));
    expect(() => assertRenderMediaOwnership(script, own)).not.toThrow();
    expect(() => assertRenderChannelOwnership(script, "balislam")).not.toThrow();
    expect(() => assertRenderChannelOwnership(script, "dafatir-alzaman")).toThrow(/لا يخص القناة/);
    expect(() => assertRenderMediaOwnership(script, { ...own, base: own.base.replace("balislam", "dafatir-alzaman") })).toThrow(/لا تخص/);
    expect(() => assertRenderMediaOwnership(script, { ...own, base: own.base.replace("001-test", "002-other") })).toThrow(/لا تخص/);
    expect(() => assertRenderMediaOwnership(script, { ...own, mode: "url" })).toThrow(/لا تخص/);
  });

  it("fingerprints script, plan, channel, dimensions and the media snapshot before asking for approval", async () => {
    const script = await setup();
    const v1 = await masterRenderSubject(script, "balislam", plan, media("a".repeat(24)), "landscape");
    const anotherMedia = await masterRenderSubject(script, "balislam", plan, media("b".repeat(24)), "landscape");
    const portrait = await masterRenderSubject(script, "balislam", plan, media("a".repeat(24)), "portrait");
    await writeFile(script, "# changed source");
    const changedScript = await masterRenderSubject(script, "balislam", plan, media("a".repeat(24)), "landscape");
    expect(new Set([v1.inputSha256, anotherMedia.inputSha256, portrait.inputSha256, changedScript.inputSha256]).size).toBe(4);
    expect(v1.quality).toBe("master");
    expect(v1.episodeFolder).toBe("001-test");
    await expect(assertMasterStageAuthorized(v1)).rejects.toThrow(/محظور/);
    await expect(masterRenderSubject(script, "zubdat-alkutub", plan, media("a".repeat(24)), "portrait")).rejects.toThrow(/لا تخص/);
  });
});
