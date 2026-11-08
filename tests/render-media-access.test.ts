import { describe, expect, it } from "vitest";
import { isPrivateRenderAssetRequest } from "../src/render/mediaAccess";
import { defaultRenderMediaRoot } from "../src/plan/renderStage";
import path from "node:path";

describe("private Remotion staging is never served by Vite static middleware", () => {
  it.each([
    "/_render/balislam/001-demo/abcdef/voice/c1.mp3",
    "/_storyboard_media/dafatir-alzaman/001-demo-abcd/images/private.png",
    "/@fs/Users/local/studio/public/_render/balislam/001-demo/voice/secret.mp3",
    "/@fs/Users/local/studio/renders/.private-media/_render/x/y/sensitive.mp3",
    "/%255frender/balislam/s.mp3",
    "/@fs/Users/local/studio/channels/balislam/episodes/001-demo/voice/c1.mp3",
    "/@fs/Users/local/studio/channels/zubdat-alkutub/episodes/001-demo/recitations/a.mp3",
    "/@fs/Users/local/studio/channels/dafatir-alzaman/episodes/001-demo/images/a.png",
    "/@fs/Users/local/studio/assets/recitations/licensed.mp3",
  ])("rejects direct private asset route: %s", (url) => {
    expect(isPrivateRenderAssetRequest(url)).toBe(true);
  });

  it.each([
    "/api/episodes/001/media/voice/c1.mp3?channel=balislam",
    "/api/episodes/001/media/images/a.png?channel=zubdat-alkutub",
    "/fonts/main.woff2",
    "/illus/texture.png",
    "/src/remotion/index.ts",
    "/@fs/Users/local/studio/channels/balislam/channel.json",
  ])("preserves intended Studio and public shared asset routes: %s", (url) => {
    expect(isPrivateRenderAssetRequest(url)).toBe(false);
  });

  it("stores newly prepared media outside the public directory", () => {
    const privateRoot = defaultRenderMediaRoot();
    expect(privateRoot).toContain(path.join("renders", ".private-media"));
    expect(path.relative(path.resolve("public"), privateRoot)).not.toBe("");
  });
});
