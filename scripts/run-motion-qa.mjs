#!/usr/bin/env node
/** Reproducible silent Remotion fixture review; never touches a channel or production episode. */
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const remotion = join(root, 'node_modules', '.bin', 'remotion');
if (!existsSync(remotion)) {
  console.error('Missing project dependencies. Run npm ci in an isolated checkout of this branch.');
  process.exit(2);
}
const entry = 'src/remotion/qa/index.tsx';
const dir = mkdtempSync(join(tmpdir(), 'studio-motion-review-'));
const cases = [
  'motion-qa-witnesses-landscape-baseline',
  'motion-qa-witnesses-landscape-fit',
  'motion-qa-witnesses-portrait-baseline',
  'motion-qa-witnesses-portrait-fit',
  'motion-qa-companion-portrait-fit',
  'motion-qa-solo-door-portrait-fit',
  'motion-qa-board-portrait-fit',
  'motion-qa-stillness-landscape-fit',
];
const result = { startedAt: new Date().toISOString(), head: process.env.GITHUB_SHA ?? 'local-isolated-checkout', entry, dir, files: [], status: 'incomplete' };
try {
  for (const id of cases) {
    const output = join(dir, `${id}.mp4`);
    const args = [entry, id, output, '--codec=h264', '--crf=21', '--concurrency=1', '--log=error'];
    const run = spawnSync(remotion, ['render', ...args], { cwd: root, stdio: 'inherit', timeout: 10 * 60_000 });
    if (run.error || run.status !== 0) throw new Error(`Remotion ${id} failed: ${run.error?.message ?? run.status}`);
    if (!existsSync(output)) throw new Error(`Remotion did not create ${id}`);
    const probe = spawnSync('ffprobe', ['-v','error','-select_streams','v:0','-show_entries','stream=width,height,nb_frames','-of','json',output], { encoding: 'utf8' });
    if (probe.status !== 0) throw new Error(`ffprobe failed for ${id}`);
    const stream = JSON.parse(probe.stdout).streams?.[0];
    const isPortrait = id.includes('-portrait-');
    if (!stream || stream.width !== (isPortrait ? 1080 : 1920) || stream.height !== (isPortrait ? 1920 : 1080))
      throw new Error(`Wrong dimensions for ${id}`);
    result.files.push({ id, output, stream });
  }
  result.status = 'rendered-awaiting-explicit-human-visual-review';
} catch (e) {
  result.error = String(e);
  process.exitCode = 1;
} finally {
  writeFileSync(join(dir, 'manifest.json'), JSON.stringify(result, null, 2));
  console.log(`Motion review evidence: ${dir}`);
}
