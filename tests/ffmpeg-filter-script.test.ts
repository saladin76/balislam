import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { ownerMessage } from "../app/src/serverMessages";
import { ffmpegMajor, filterScriptArgs, filterScriptForm, localFilterScriptForm, otherForm, refusedOption, resetFilterScriptForm } from "../src/render/ffmpegFilterScript";

// FFmpeg 8 removed -filter_complex_script (owner's Mac, 18 Nov): every assembly and pre-final preview failed with
// «Unrecognized option 'filter_complex_script'». CI runs FFmpeg 6, which knows only that form.
describe("the filter graph file follows the local FFmpeg", () => {
  it("reads the major version from every build's banner", () => {
    expect(ffmpegMajor("ffmpeg version 6.1.1-3ubuntu5 Copyright (c) 2000-2023")).toBe(6);
    expect(ffmpegMajor("ffmpeg version 8.0 Copyright (c) 2000-2025 the FFmpeg developers")).toBe(8);
    expect(ffmpegMajor("ffmpeg version n9.0.2-17-g2a571b6068-20260930 Copyright")).toBe(9);
    expect(ffmpegMajor("ffmpeg version N-118234-gabc Copyright")).toBeNull();
  });
  it("old form before 7, new from 7 and for an unknown build; one retry takes the other form", () => {
    expect(filterScriptForm(6)).toBe("old");
    expect(filterScriptForm(7)).toBe("new");
    expect(filterScriptForm(8)).toBe("new");
    expect(filterScriptForm(null)).toBe("new");
    expect(filterScriptArgs("g.txt", "old")).toEqual(["-filter_complex_script", "g.txt"]);
    expect(filterScriptArgs("g.txt", "new")).toEqual(["-/filter_complex", "g.txt"]);
    expect(otherForm("old")).toBe("new");
    expect(refusedOption({ stderr: "Unrecognized option 'filter_complex_script'.\nError splitting the argument list" })).toBe(true);
    expect(refusedOption({ stderr: "Unrecognized option '/filter_complex'." })).toBe(true);
    expect(refusedOption({ stderr: "Invalid data found when processing input" })).toBe(false);
  });

  const dir = mkdtempSync(path.join(os.tmpdir(), "ff-script-"));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));
  it("the chosen form joins two clips from a graph file with the FFmpeg on this machine", async () => {
    resetFilterScriptForm();
    const ff = (args: string[]) => execFileSync("ffmpeg", ["-nostdin", "-hide_banner", "-loglevel", "error", "-y", ...args], { stdio: ["ignore", "pipe", "pipe"] });
    for (const n of ["a", "b"]) ff(["-f", "lavfi", "-i", "testsrc=d=0.5:s=160x90:r=30", "-f", "lavfi", "-i", "sine=d=0.5", "-shortest", path.join(dir, `${n}.mp4`)]);
    const graph = path.join(dir, "graph.txt");
    writeFileSync(graph, "[0:v][1:v]concat=n=2:v=1:a=0[vout];[0:a][1:a]concat=n=2:v=0:a=1[aout]");
    const out = path.join(dir, "out.mp4");
    ff(["-i", path.join(dir, "a.mp4"), "-i", path.join(dir, "b.mp4"), ...filterScriptArgs(graph, await localFilterScriptForm()), "-map", "[vout]", "-map", "[aout]", out]);
    expect(statSync(out).size).toBeGreaterThan(1000);
  });

  it("tells the owner what happened, not to upload another format when he uploaded nothing", () => {
    const refused = ownerMessage("Command failed: ffmpeg -nostdin -i scene-c1-s1-av.mp4 -filter_complex_script g.txt\nUnrecognized option 'filter_complex_script'.\nError splitting the argument list: Option not found");
    expect(refused).toContain("اختلاف إصدار");
    expect(refused).not.toContain("ارفعه");
    const other = ownerMessage("Command failed: ffmpeg -i x.mp4 out.mp4\nInvalid data found when processing input");
    expect(other).toContain("بأداة ffmpeg على هذا الجهاز");
    expect(other).toContain("إن كان ملفًا رفعته أنت");
  });
});
