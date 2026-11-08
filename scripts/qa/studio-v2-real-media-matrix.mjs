#!/usr/bin/env node
/**
 * QA-04 isolated FFmpeg/FFprobe behavioral matrix. This is NOT a Remotion or
 * production RenderPool test. Tones are synthetic: never call them narration
 * or human Quran recitation. All outputs live under one newly-created temp root.
 */
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const enc = process.env.STUDIO_FFMPEG_BIN ?? '/usr/bin/ffmpeg';
const probe = process.env.STUDIO_FFPROBE_BIN ?? '/usr/bin/ffprobe';
const running = new Set();
const binary = async (p) => {
  if (!path.isAbsolute(p) || !(await stat(p)).isFile()) throw Error('Absolute installed FFmpeg/FFprobe binary required');
  await access(p, constants.X_OK);
  return p;
};
const run = (bin, args, { allowFailure = false, timeoutMs = 15000 } = {}) => new Promise((resolve, reject) => {
  let output = '', finished = false, timedOut = false;
  const child = spawn(bin, args, { shell: false, stdio: ['ignore', 'pipe', 'pipe'],
    env: { PATH: process.env.PATH ?? '/usr/bin:/bin', LANG: 'C' } });
  running.add(child);
  const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, timeoutMs);
  const collect = (buf) => { if (output.length < 1024 * 1024) output += buf.toString('utf8'); };
  child.stdout?.on('data', collect); child.stderr?.on('data', collect);
  child.on('error', (e) => { if (!finished) { finished = true; clearTimeout(timer); running.delete(child); reject(e); } });
  child.on('close', (code, signal) => {
    if (finished) return;
    finished = true; clearTimeout(timer); running.delete(child);
    if (timedOut) return reject(Error('Media command timed out'));
    if (code !== 0 && !allowFailure) return reject(Error('Media command failed: ' + output.slice(-900)));
    resolve({ code, signal, output });
  });
});
const encode = async (args) => run(enc, ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y', ...args]);
const md5 = (data) => createHash('sha256').update(data).digest('hex');
const assert = (ok, message) => { if (!ok) throw Error('QA-04: ' + message); };
const main = async () => {
  await binary(enc); await binary(probe);
  const ownRoot = await mkdtemp(path.join(os.tmpdir(), 'studio-v2-qa04-av-'));
  const media = path.join(ownRoot, 'media');
  const results = [];
  try {
    await mkdir(media);
    const video = ['-f', 'lavfi', '-i', 'color=c=navy:size=320x180:rate=25:duration=1.2'];
    const picture = ['-c:v', 'mpeg4', '-q:v', '5', '-pix_fmt', 'yuv420p'];
    const tone = (freq) => ['-f', 'lavfi', '-i', 'sine=frequency=' + freq + ':sample_rate=48000:duration=1.2'];
    const specs = [
      { mode: 'silent', args: [...video, ...picture, '-an'] },
      { mode: 'narrated', args: [...video, ...tone(440), ...picture, '-c:a', 'aac', '-shortest'] },
      { mode: 'recitation', args: [...video, ...tone(550), ...picture, '-c:a', 'aac', '-shortest'] },
      { mode: 'mixed', args: [...video, ...tone(440), ...tone(550),
        '-filter_complex', '[1:a][2:a]amix=inputs=2:duration=shortest[a]',
        '-map', '0:v', '-map', '[a]', ...picture, '-c:a', 'aac', '-shortest'] },
    ];
    for (const { mode, args } of specs) {
      const file = path.join(media, mode + '.mp4');
      await encode([...args, '-movflags', '+faststart', file]);
      const info = JSON.parse((await run(probe, ['-v', 'error', '-show_entries',
        'format=format_name,duration:stream=codec_type,codec_name,start_time,duration,width,height',
        '-of', 'json', file])).output);
      assert(info.format.format_name.split(',').includes('mp4'), mode + ' container is not MP4');
      const v = info.streams.filter((s) => s.codec_type === 'video');
      const a = info.streams.filter((s) => s.codec_type === 'audio');
      assert(v.length === 1 && v[0].width === 320 && v[0].height === 180, mode + ' video stream');
      assert(mode === 'silent' ? a.length === 0 : a.length > 0, mode + ' audio stream');
      assert(Number(info.format.duration) > 0.9 && Number(info.format.duration) < 1.6, mode + ' duration');
      if (a.length) {
        assert(Math.abs(Number(v[0].start_time ?? 0) - Number(a[0].start_time ?? 0)) < 0.12,
          mode + ' AV start offset exceeds 120ms');
      }
      await run(enc, ['-v', 'error', '-nostdin', '-i', file, '-f', 'null', '-']);
      const sha256 = md5(await readFile(file));
      assert(/^[0-9a-f]{64}$/.test(sha256), 'missing file digest');
      results.push({ test: mode, result: 'PASS', codec: v[0].codec_name,
        audioTracks: a.length, durationSec: Number(info.format.duration), sha256 });
    }
    const corrupt = path.join(media, 'invalid.mp4');
    await writeFile(corrupt, 'synthetic error not an MP4');
    const rejected = await run(probe, ['-v', 'error', '-of', 'json', '-show_format', corrupt], { allowFailure: true });
    assert(rejected.code !== 0, 'corrupt MP4 accepted');
    results.push({ test: 'corrupt-mp4-rejection', result: 'PASS' });
    const failed = await run(enc, ['-v', 'error', '-f', 'lavfi', '-i', 'nonexistent_filter',
      '-f', 'null', '-'], { allowFailure: true });
    assert(failed.code !== 0, 'intentional FFmpeg failure was not observed');
    results.push({ test: 'forced-render-failure', result: 'PASS' });
    // Cancel a real-time FFmpeg worker, wait for its close event, then retry
    // into a DIFFERENT QA-owned output. No live Studio task is ever touched.
    const partial = path.join(media, 'cancelled.mp4');
    const child = spawn(enc, ['-v', 'error', '-nostdin', '-y', '-re', '-f', 'lavfi',
      '-i', 'testsrc2=size=320x180:rate=25:duration=12', ...picture, partial],
      { shell: false, stdio: ['ignore', 'ignore', 'pipe'],
        env: { PATH: process.env.PATH ?? '/usr/bin:/bin', LANG: 'C' } });
    running.add(child);
    let cancelErr = '';
    child.stderr?.on('data', (b) => { cancelErr += b.toString(); });
    const finished = new Promise((resolve, reject) => {
      child.on('error', reject);
      child.on('close', (code, signal) => { running.delete(child); resolve({ code, signal }); });
    });
    await new Promise((r) => setTimeout(r, 400));
    assert(child.exitCode === null, 'test worker exited before cancellation');
    assert(child.kill('SIGTERM'), 'could not signal QA-owned FFmpeg child');
    const cancelOutcome = await finished;
    assert(cancelOutcome.code !== 0 || cancelOutcome.signal === 'SIGTERM',
      'cancellation unexpectedly completed successfully: ' + cancelErr.slice(-200));
    results.push({ test: 'cancel-ffmpeg-owned-worker', result: 'PASS' });
    const retried = path.join(media, 'retry.mp4');
    await encode([...video, ...picture, '-an', retried]);
    await run(enc, ['-v', 'error', '-i', retried, '-f', 'null', '-']);
    results.push({ test: 'retry-fresh-owned-output', result: 'PASS' });
    process.stdout.write(JSON.stringify({ scope: 'isolated FFmpeg process only, not V2 production',
      warnings: ['recitation is a synthetic placeholder, not Quran', 'no real RenderPool or AV owner receipt tested'],
      results }, null, 2) + '\n');
  } finally {
    for (const child of running) child.kill('SIGKILL');
    // wait for all child processes to emit close before deleting outputs
    if (running.size) await new Promise((r) => setTimeout(r, 200));
    await rm(ownRoot, { recursive: true, force: true });
  }
};
await main().catch((error) => { console.error(String(error)); process.exitCode = 1; });
