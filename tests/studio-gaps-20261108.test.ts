/**
 * Funnel-audit gaps (8 Nov, D36): prepare-queue stop, render-browser failure without a crash.
 */
import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";
import { prepareJob, startPrepareJob, stopPrepareJob } from "../app/server/prepare";
import { ensureRenderBrowser, renderBrowserFailureMessage } from "../src/render/bundle";
import { installStudioCrashGuard } from "../app/server/api";
import { ownerMessage } from "../app/src/serverMessages";

describe("«أوقف» في «جهّز كل المشاهد»", () => {
  it("stops after the step in progress, keeps what finished, and a new start resumes", async () => {
    const steps: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    startPrepareJob("t/stop", async (onProgress, shouldStop) => {
      for (const id of ["a", "b", "c"]) {
        if (shouldStop()) break;
        if (id === "a") await gate; // "rendering" a while the owner presses stop
        steps.push(id);
        onProgress({ phase: "render", voice: { needed: 0, generated: 0, status: "none" }, rendered: [...steps], failed: [] });
      }
    });
    expect(stopPrepareJob("t/stop")).toMatchObject({ status: "running", stopRequested: true });
    release();
    await new Promise((r) => setTimeout(r, 10));
    expect(prepareJob("t/stop")).toMatchObject({ status: "stopped", rendered: ["a"] });
    expect(steps).toEqual(["a"]);
    const again = startPrepareJob("t/stop", async () => undefined);
    expect(again.stopRequested).toBeUndefined();
    await new Promise((r) => setTimeout(r, 10));
    expect(prepareJob("t/stop")?.status).toBe("done");
    expect(stopPrepareJob("t/none")).toBeNull();
  });
});

describe("فشل تنزيل متصفح الرندر لا يُسقط الاستوديو", () => {
  it("turns a download failure into an Arabic, actionable error", async () => {
    const offline = Object.assign(new Error("getaddrinfo ENOTFOUND remotion.media"), { code: "ENOTFOUND" });
    await expect(ensureRenderBrowser(async () => { throw offline; })).rejects.toThrow(/تعذّر تجهيز متصفح الرندر لأن الجهاز غير متصل بالإنترنت/);
    await expect(ensureRenderBrowser(async () => ({ type: "local-puppeteer-browser" }))).resolves.toBeUndefined();
    const msg = renderBrowserFailureMessage(offline);
    expect(msg).toContain("REMOTION_BROWSER_EXECUTABLE");
    expect(msg).toContain("الاستوديو ما زال يعمل");
    // The owner sees the renderer's own explanation untouched, and a raw leak is translated.
    expect(ownerMessage(`c6-end: ${msg}`)).toBe(`c6-end: ${msg}`);
    expect(ownerMessage("getaddrinfo ENOTFOUND remotion.media")).toContain("تعذّر تجهيز متصفح الرندر");
  });

  it("an unhandled rejection is logged, not fatal", () => {
    const proc = new EventEmitter();
    installStudioCrashGuard(proc as unknown as NodeJS.Process);
    expect(proc.listenerCount("unhandledRejection")).toBe(1);
    const errors: unknown[] = [];
    const orig = console.error;
    console.error = (...a: unknown[]) => { errors.push(a); };
    try { proc.emit("unhandledRejection", new Error("getaddrinfo ENOTFOUND remotion.media")); }
    finally { console.error = orig; }
    expect(errors).toHaveLength(1);
  });
});
