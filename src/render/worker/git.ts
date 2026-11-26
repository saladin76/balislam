import { spawn } from "node:child_process";
import { cleanGitEnv } from "../../../scripts/git-env.mjs";

export type RunResult = { code: number; out: string; err: string };

/**
 * يشغّل أمرًا بلا صدفة (git.exe وnode مباشرة)؛ وnpm على ويندوز يحتاج الصدفة (npm.cmd) فيُمرَّر shell صراحة.
 * المتغيرات التي تحدد المستودع لا تُورَّث (scripts/git-env.mjs).
 */
export const runCmd = (cmd: string, args: string[], o: { cwd: string; shell?: boolean; env?: NodeJS.ProcessEnv; timeoutMs?: number; onLine?: (line: string) => void } ): Promise<RunResult> =>
  new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd: o.cwd, env: o.env ?? cleanGitEnv(process.env), shell: o.shell ?? false, windowsHide: true });
    let out = "", err = "";
    const keep = (s: string, d: Buffer) => (s + d.toString("utf8")).slice(-200_000);
    const lines = (d: Buffer) => { if (o.onLine) for (const l of d.toString("utf8").split(/\r?\n/)) if (l.trim()) o.onLine(l); };
    child.stdout.on("data", (d: Buffer) => { out = keep(out, d); lines(d); });
    child.stderr.on("data", (d: Buffer) => { err = keep(err, d); lines(d); });
    const timer = o.timeoutMs ? setTimeout(() => child.kill(), o.timeoutMs) : null;
    child.on("error", (e) => { if (timer) clearTimeout(timer); resolve({ code: -1, out, err: err + String(e.message) }); });
    child.on("close", (code) => { if (timer) clearTimeout(timer); resolve({ code: code ?? -1, out: out.trim(), err: err.trim() }); });
  });

export const git = (cwd: string, args: string[], timeoutMs = 10 * 60_000) => runCmd("git", args, { cwd, timeoutMs });

export const headCommit = async (cwd: string): Promise<string> => {
  const r = await git(cwd, ["rev-parse", "HEAD"]);
  if (r.code !== 0 || !/^[a-f0-9]{40}$/.test(r.out)) throw new Error("تعذّرت قراءة الـcommit الحالي.");
  return r.out;
};
