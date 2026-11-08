/**
 * Studio V2 local HTTP boundary. It owns authentication, request validation,
 * server-side scope, trusted manifest loading and the shared artifact mutex.
 * No browser payload can supply a file path, principal or media verifier.
 */
import path from "node:path";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { WorkflowIdentity } from "../../src/workflow/index.ts";
import type { SceneV2ClientDecision } from "../../src/workflow/sceneServiceV2.ts";
import {
  assertLocalStudioV2, assertStudioV2Origin, loginStudioV2, logoutStudioV2,
  requireStudioV2Session, requireStudioV2Write, sessionInfoStudioV2, StudioV2AuthError,
} from "./studioV2Session.ts";
import {
  finishSceneReviewReceiptV2, inspectSceneReviewReceiptV2,
  revokeSceneReviewReceiptV2, startSceneReviewReceiptV2,
  streamSceneReviewReceiptV2, tickSceneReviewReceiptV2,
  verifySceneReviewReceiptV2,
} from "./studioV2Review.ts";
import { verifyStudioV2Sources } from "./studioV2SourceVerifier.ts";

type Ctx = {
  req: IncomingMessage; res: ServerResponse; parts: string[];
  root: string; ch: string;
  load: <T = any>(file: string) => Promise<T>;
  send: (res: ServerResponse, status: number, body: unknown) => void;
};
const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));
const hasKeys = (x: Record<string, unknown>, keys: readonly string[]) =>
  Object.keys(x).every((k) => keys.includes(k));
const readJson = async (req: IncomingMessage) => {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buf = Buffer.from(chunk);
    total += buf.length;
    if (total > 64 * 1024) throw new StudioV2AuthError(413, "V2_BODY_TOO_LARGE");
    chunks.push(buf);
  }
  if (!total) return {};
  let value: unknown;
  try { value = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new StudioV2AuthError(400, "V2_INVALID_JSON"); }
  if (!isRecord(value)) throw new StudioV2AuthError(400, "V2_OBJECT_REQUIRED");
  return value;
};
const statusError = (error: unknown) => {
  if (error instanceof StudioV2AuthError)
    return { status: error.status, code: error.code };
  const msg = error instanceof Error ? error.message : "";
  if (/STUDIO_V2_ARTIFACT_BUSY/.test(msg))
    return { status: 423, code: "V2_ARTIFACT_BUSY" };
  if (/ENOENT/.test(msg)) return { status: 409, code: "V2_REQUIRED_ARTIFACT_MISSING" };
  if (/approval|approved|blocked|prerequisite|review|stale|changed|submitted|Scene|manifest|source|fingerprint/i.test(msg))
    return { status: 409, code: "V2_GATE_REJECTED" };
  return { status: 503, code: "V2_BACKEND_NOT_READY" };
};
const episodeScope = async (ctx: Ctx, number: string): Promise<WorkflowIdentity> => {
  if (!/^[0-9]{3}$/.test(number) ||
      !["balislam", "dafatir-alzaman", "zubdat-alkutub"].includes(ctx.ch))
    throw new StudioV2AuthError(400, "V2_EPISODE_SCOPE_INVALID");
  const { resolveEpisodeDir } = await ctx.load("/src/script/episodes.ts");
  const dir: string = await resolveEpisodeDir(number);
  const expected = path.join(ctx.root, "channels", ctx.ch, "episodes");
  if (path.dirname(path.resolve(dir)) !== expected ||
      !new RegExp("^" + number + "-[a-z0-9]+(?:-[a-z0-9]+)*$").test(path.basename(dir)))
    throw new StudioV2AuthError(403, "V2_EPISODE_SCOPE_INVALID");
  return { channelsRoot: path.join(ctx.root, "channels"),
    channel: ctx.ch as WorkflowIdentity["channel"], episode: path.basename(dir) };
};
const exact = (parts: string[], ...p: string[]) =>
  parts.length === p.length && parts.every((v, i) => v === p[i]);

/**
 * All V2 scene adapters share ONE stable lock object, including sources,
 * manifest projections, ffprobe, source decisions and AV signoff.
 */
const sceneService = async (ctx: Ctx, scope: WorkflowIdentity, reviewId?: string) => {
  const session = requireStudioV2Session(ctx.req);
  const [{ createTrustedSceneV2Service },
    { withSceneArtifactLockV2 }, { readPlannedSceneOrderV2 },
    { readRegisteredSceneManifestV2 }, { requireApprovedSceneSourcesV2 },
    { sha256FileAndEpoch, resolveArtifact }] = await Promise.all([
    ctx.load("/src/workflow/sceneServiceV2.ts"),
    ctx.load("/src/workflow/sceneLockV2.ts"),
    ctx.load("/src/workflow/scenePlanV2.ts"),
    ctx.load("/src/workflow/sceneManifestRegistryV2.ts"),
    ctx.load("/src/workflow/sceneSourcesV2.ts"),
    ctx.load("/src/workflow/artifacts.ts"),
  ]);
  const withArtifactLock = <T>(job: () => Promise<T>): Promise<T> =>
    withSceneArtifactLockV2(scope, job);
  const scopeTag = scope.channel + "/" + scope.episode;
  const ffprobe = process.env.STUDIO_V2_FFPROBE;
  return createTrustedSceneV2Service({
    scope,
    authenticate: async () => ({ id: session.userId, role: "owner", authenticated: true }),
    sceneOrder: async () => (await readPlannedSceneOrderV2(scope, async (job: () => Promise<unknown>) => job())).sceneOrder,
    currentSceneManifest: (sceneId: string) => readRegisteredSceneManifestV2(scope, sceneId),
    assertLockedScriptAndStoryboard: async () => {
      await requireApprovedSceneSourcesV2(scope);
      await verifyStudioV2Sources(scope, ctx.load);
    },
    verifyCurrentSceneAvReview: async (proof: {
      sceneId: string; ownerId: string; fingerprint: string; avSha256: string;
    }) => {
      if (!reviewId) throw Error("V2 completed AV receipt is required.");
      const manifest = await readRegisteredSceneManifestV2(scope, proof.sceneId);
      const file = await resolveArtifact(scope, manifest.inputs.video.files[0]!);
      const observed = await sha256FileAndEpoch(file);
      if (observed.sha256 !== proof.avSha256) throw Error("V2 review video bytes changed.");
      verifySceneReviewReceiptV2(reviewId, session.id, proof, scopeTag, observed.epoch);
      const { requireCompletedSceneAvReviewV2 } =
        await ctx.load("/src/workflow/sceneReviewAuditV2.ts");
      await requireCompletedSceneAvReviewV2(scope, {
        id: reviewId, sessionId: session.id, ownerId: proof.ownerId,
        sceneId: proof.sceneId, fingerprint: proof.fingerprint,
        avSha256: proof.avSha256, avEpoch: observed.epoch,
        videoVersion: manifest.inputs.video.version,
      });
    },
    withArtifactLock,
    // Inspections and source decisions remain available without ffprobe;
    // submit/approve still fail closed if no executable is configured.
    ffprobeBinary: ffprobe && path.isAbsolute(ffprobe) ? ffprobe : "/__studio_v2_ffprobe_not_configured__",
  });
};

const streamAv = async (ctx: Ctx, scope: WorkflowIdentity, sceneId: string,
  reviewId: string, sessionId: string): Promise<void> => {
  const { withSceneArtifactLockV2 } = await ctx.load("/src/workflow/sceneLockV2.ts");
  const { readRegisteredSceneManifestV2 } = await ctx.load("/src/workflow/sceneManifestRegistryV2.ts");
  const { resolveArtifact, sha256FileAndEpoch } = await ctx.load("/src/workflow/artifacts.ts");
  await withSceneArtifactLockV2(scope, async () => {
    const review = inspectSceneReviewReceiptV2(reviewId, sessionId);
    if (review.sceneId !== sceneId || review.scope !== scope.channel + "/" + scope.episode)
      throw Error("Foreign V2 AV review session.");
    const manifest = await readRegisteredSceneManifestV2(scope, sceneId);
    const file: string = await resolveArtifact(scope, manifest.inputs.video.files[0]!);
    const observed = await sha256FileAndEpoch(file);
    if (review.avSha256 !== observed.sha256 || review.avEpoch !== observed.epoch)
      throw Error("V2 review media changed; start a new session.");
    const size = (await stat(file)).size;
    const raw = ctx.req.headers.range;
    const range = typeof raw === "string" ? /^bytes=(\d*)-(\d*)$/.exec(raw) : null;
    if (raw && !range) {
      ctx.res.statusCode = 416;
      ctx.res.setHeader("content-range", "bytes */" + size);
      ctx.res.end();
      return;
    }
    let start = 0;
    let end = size - 1;
    if (range) {
      if (range[1]) {
        start = Number(range[1]);
        end = range[2] ? Math.min(Number(range[2]), end) : end;
      } else if (range[2]) {
        start = Math.max(0, size - Number(range[2]));
      } else { start = size; }
    }
    if (!size || !Number.isSafeInteger(start) || !Number.isSafeInteger(end) ||
        start >= size || start > end || start < 0) {
      ctx.res.statusCode = 416;
      ctx.res.setHeader("content-range", "bytes */" + size);
      ctx.res.end();
      return;
    }
    ctx.res.statusCode = range ? 206 : 200;
    ctx.res.setHeader("content-type", "video/mp4");
    ctx.res.setHeader("cache-control", "no-store");
    ctx.res.setHeader("x-content-type-options", "nosniff");
    ctx.res.setHeader("accept-ranges", "bytes");
    ctx.res.setHeader("content-length", String(end - start + 1));
    if (range) ctx.res.setHeader("content-range", "bytes " + start + "-" + end + "/" + size);
    await new Promise<void>((resolve, reject) => {
      const stream = createReadStream(file, { start, end });
      let settled = false;
      const done = (err?: Error) => {
        if (settled) return;
        settled = true;
        if (err) reject(err);
        else resolve();
      };
      let position = start;
      stream.on("data", (data: Buffer) => {
        const nextPosition = position + data.length;
        streamSceneReviewReceiptV2(reviewId, sessionId, position, nextPosition);
        position = nextPosition;
      });
      stream.once("error", done);
      stream.once("end", () => done());
      ctx.res.once("close", () => { stream.destroy(); done(); });
      stream.pipe(ctx.res);
    });
  });
};

export const handleStudioV2 = async (ctx: Ctx): Promise<boolean> => {
  const { req, res, parts, send } = ctx;
  if (parts[0] !== "studio-v2") return false;
  res.setHeader("cache-control", "no-store");
  res.setHeader("x-content-type-options", "nosniff");
  try {
    assertLocalStudioV2(req);
    if (exact(parts, "studio-v2", "session")) {
      if (req.method === "POST") {
        assertStudioV2Origin(req);
        if (!/^application\/json(?:\s*;|$)/i.test(req.headers["content-type"] ?? ""))
          throw new StudioV2AuthError(415, "V2_JSON_REQUIRED");
        return send(res, 200, loginStudioV2(req, res, await readJson(req))), true;
      }
      if (req.method === "GET")
        return send(res, 200, sessionInfoStudioV2(req)), true;
      if (req.method === "DELETE") {
        logoutStudioV2(req, res);
        return send(res, 200, { ok: true }), true;
      }
      return send(res, 405, { code: "V2_METHOD_NOT_ALLOWED" }), true;
    }
    const session = req.method === "GET" ?
      requireStudioV2Session(req) : requireStudioV2Write(req);
    if (parts[1] !== "episodes" || !parts[2])
      return send(res, 404, { code: "V2_NOT_FOUND" }), true;
    const scope = await episodeScope(ctx, parts[2]);
    const { withSceneArtifactLockV2 } = await ctx.load("/src/workflow/sceneLockV2.ts");
    if (exact(parts, "studio-v2", "episodes", parts[2], "sources")) {
      const { inspectSceneSourcesV2, approveSceneSourcesV2 } =
        await ctx.load("/src/workflow/sceneSourcesV2.ts");
      if (req.method === "GET")
        return send(res, 200, await withSceneArtifactLockV2(scope,
          () => inspectSceneSourcesV2(scope))), true;
      if (req.method === "POST") {
        const body = await readJson(req);
        if (!hasKeys(body, ["stage", "expectedFingerprint", "note"]) ||
            (body.stage !== "script" && body.stage !== "storyboard"))
          throw new StudioV2AuthError(400, "V2_FORBIDDEN_FIELD");
        const result = await withSceneArtifactLockV2(scope, async () => {
          await verifyStudioV2Sources(scope, ctx.load, body.stage as "script" | "storyboard");
          return approveSceneSourcesV2(scope, body.stage,
            body.expectedFingerprint, session.userId, body.note);
        });
        return send(res, 200, result), true;
      }
    }
    if (exact(parts, "studio-v2", "episodes", parts[2], "scenes") && req.method === "GET") {
      const service = await sceneService(ctx, scope);
      return send(res, 200, await service.inspect()), true;
    }
    if (exact(parts, "studio-v2", "episodes", parts[2], "assembly-eligibility") &&
        req.method === "GET") {
      const service = await sceneService(ctx, scope);
      return send(res, 200, await service.assemblyEligibility()), true;
    }
    const id = parts[4];
    if (parts[3] === "scenes" && id && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
      // Owner-initiated FINAL render: body contains only the observed ledger revision.
      // Render/manifest paths, actor, source hashes and signoffs are server-owned.
      if (parts[5] === "render" && parts.length === 6 && req.method === "POST") {
        const body = await readJson(req);
        if (!hasKeys(body, ["expectedRevision"]) ||
            !Number.isSafeInteger(body.expectedRevision) ||
            (body.expectedRevision as number) < 0)
          throw new StudioV2AuthError(400, "V2_RENDER_REQUEST_INVALID");
        const service = await sceneService(ctx, scope);
        const current = await service.inspect();
        if (current.revision !== body.expectedRevision)
          throw new StudioV2AuthError(409, "V2_STALE_REVISION");
        // Backend checkout alone intentionally lacks Render-owned PR #86 files.
        // Never fall back to legacy render or trust a client-supplied request.
        let renderer: any;
        try {
          const module = await ctx.load("/src/render/sceneV2.ts");
          renderer = module.renderSceneV2;
        } catch {
          throw new StudioV2AuthError(503, "V2_RENDER_ENGINE_UNCONNECTED");
        }
        if (typeof renderer !== "function")
          throw new StudioV2AuthError(503, "V2_RENDER_ENGINE_UNCONNECTED");
        if (!process.env.STUDIO_V2_FFPROBE ||
            !path.isAbsolute(process.env.STUDIO_V2_FFPROBE))
          throw new StudioV2AuthError(503, "V2_FFPROBE_NOT_CONFIGURED");
        const { runTrustedSceneProductionV2 } =
          await ctx.load("/src/workflow/sceneRenderBridgeV2.ts");
        const result = await runTrustedSceneProductionV2(scope, id, {
          renderer,
          ffprobeBinary: process.env.STUDIO_V2_FFPROBE,
          browserExecutable: process.env.STUDIO_V2_BROWSER_EXECUTABLE || undefined,
          verifySourceReview: async () => verifyStudioV2Sources(scope, ctx.load),
          // Human recitation is intentionally blocked until the dedicated
          // owner-upload provenance checker is wired by the audio owner.
        });
        return send(res, 200, { ok: true, ...result }), true;
      }
      if (parts[5] === "commands" && parts.length === 6 && req.method === "POST") {
        const body = await readJson(req);
        if (!hasKeys(body, ["action", "expectedFingerprint", "note", "second", "elementId", "reviewId"]) ||
            (body.action !== "approve" && body.reviewId !== undefined) ||
            (body.action === "approve" && (typeof body.reviewId !== "string" ||
              !/^[a-f0-9]{48}$/.test(body.reviewId))))
          throw new StudioV2AuthError(400, "V2_FORBIDDEN_FIELD");
        const { reviewId: _reviewId, ...allowed } = body;
        if (["submit", "approve"].includes(String(allowed.action)) &&
            (!process.env.STUDIO_V2_FFPROBE || !path.isAbsolute(process.env.STUDIO_V2_FFPROBE)))
          throw new StudioV2AuthError(503, "V2_FFPROBE_NOT_CONFIGURED");
        const service = await sceneService(ctx, scope,
          typeof body.reviewId === "string" ? body.reviewId : undefined);
        const outcome = await service.command({ ...allowed, sceneId: id } as SceneV2ClientDecision);
        if (body.action === "approve") revokeSceneReviewReceiptV2(body.reviewId as string);
        return send(res, 200, { ok: true, ...outcome }), true;
      }
      if (parts[5] === "review" && parts[6] === "start" && parts.length === 7 &&
          req.method === "POST") {
        if (!process.env.STUDIO_V2_FFPROBE || !path.isAbsolute(process.env.STUDIO_V2_FFPROBE))
          throw new StudioV2AuthError(503, "V2_FFPROBE_NOT_CONFIGURED");
        const body = await readJson(req);
        if (!hasKeys(body, ["expectedFingerprint"]) ||
            typeof body.expectedFingerprint !== "string")
          throw new StudioV2AuthError(400, "V2_FORBIDDEN_FIELD");
        const service = await sceneService(ctx, scope);
        const current = (await service.inspect()).scenes.find((s: { id: string; status: string; fingerprint?: string }) => s.id === id);
        if (!current || current.status !== "in_review" ||
            current.fingerprint !== body.expectedFingerprint)
          throw Error("Scene is not ready for current AV review.");
        const { readRegisteredSceneManifestV2 } =
          await ctx.load("/src/workflow/sceneManifestRegistryV2.ts");
        const { collectSceneInputsFromDiskV2 } =
          await ctx.load("/src/workflow/sceneArtifactsV2.ts");
        const { probeSceneAvLockedV2 } =
          await ctx.load("/src/workflow/sceneMediaV2.ts");
        const receipt = await withSceneArtifactLockV2(scope, async () => {
          const manifest = await readRegisteredSceneManifestV2(scope, id);
          const result = await collectSceneInputsFromDiskV2(scope, manifest, async (job: () => Promise<unknown>) => job());
          if (result.fingerprint !== body.expectedFingerprint)
            throw Error("Scene AV changed while starting owner review.");
          const media = await probeSceneAvLockedV2(scope, manifest,
            { ffprobeBinary: process.env.STUDIO_V2_FFPROBE! });
          const { resolveArtifact } = await ctx.load("/src/workflow/artifacts.ts");
          const videoPath = await resolveArtifact(scope, manifest.inputs.video.files[0]!);
          const mediaBytes = (await stat(videoPath)).size;
          if (media.sha256 !== result.inputs.video.sha256 ||
              media.epoch !== result.inputs.video.epoch)
            throw Error("Scene AV media changed before review.");
          return startSceneReviewReceiptV2({
            sessionId: session.id, ownerId: session.userId,
            scope: scope.channel + "/" + scope.episode, sceneId: id,
            fingerprint: result.fingerprint, avSha256: media.sha256,
            avEpoch: media.epoch, videoVersion: manifest.inputs.video.version,
            durationSec: media.durationSec, mediaBytes,
          });
        });
        return send(res, 200, {
          ...receipt,
          mediaUrl: "/api/studio-v2/episodes/" + parts[2] + "/scenes/" + id +
            "/media?channel=" + ctx.ch + "&reviewId=" + receipt.reviewId,
        }), true;
      }
      if (parts[5] === "media" && parts.length === 6 && req.method === "GET") {
        const url = new URL(req.url ?? "/", "http://localhost");
        const reviewId = url.searchParams.get("reviewId") ?? "";
        if (!/^[a-f0-9]{48}$/.test(reviewId))
          throw new StudioV2AuthError(400, "V2_REVIEW_ID_REQUIRED");
        await streamAv(ctx, scope, id, reviewId, session.id);
        return true;
      }
      if (parts[5] === "review" && parts[6] && parts.length === 8 &&
          req.method === "POST") {
        const reviewId = parts[6];
        if (!/^[a-f0-9]{48}$/.test(reviewId))
          throw new StudioV2AuthError(400, "V2_REVIEW_ID_REQUIRED");
        const receipt = inspectSceneReviewReceiptV2(reviewId, session.id);
        if (receipt.sceneId !== id || receipt.scope !== scope.channel + "/" + scope.episode)
          throw new StudioV2AuthError(403, "V2_REVIEW_SCOPE_MISMATCH");
        const body = await readJson(req);
        if (parts[7] === "tick")
          return send(res, 200, tickSceneReviewReceiptV2(reviewId, session.id, body)), true;
        if (parts[7] === "finish") {
          const finished = await withSceneArtifactLockV2(scope, async () => {
            const { readRegisteredSceneManifestV2 } =
              await ctx.load("/src/workflow/sceneManifestRegistryV2.ts");
            const { collectSceneInputsFromDiskV2 } =
              await ctx.load("/src/workflow/sceneArtifactsV2.ts");
            const { appendCompletedSceneAvReviewV2 } =
              await ctx.load("/src/workflow/sceneReviewAuditV2.ts");
            const manifest = await readRegisteredSceneManifestV2(scope, id);
            const observed = await collectSceneInputsFromDiskV2(scope, manifest,
              async (job: () => Promise<unknown>) => job());
            if (receipt.fingerprint !== observed.fingerprint ||
                receipt.avSha256 !== observed.inputs.video.sha256 ||
                receipt.avEpoch !== observed.inputs.video.epoch ||
                receipt.videoVersion !== manifest.inputs.video.version)
              throw Error("Scene changed before completing independent AV review.");
            const outcome = finishSceneReviewReceiptV2(reviewId, session.id, body);
            await appendCompletedSceneAvReviewV2(scope, {
              id: receipt.id, sessionId: session.id, ownerId: session.userId,
              sceneId: id, fingerprint: receipt.fingerprint,
              avSha256: receipt.avSha256, avEpoch: receipt.avEpoch,
              videoVersion: receipt.videoVersion,
              durationSec: receipt.durationSec, mediaBytes: receipt.mediaBytes,
              playedSec: receipt.playedSec, startedAt: receipt.startedAt,
              completedAt: receipt.completedAt!, checkpoints: receipt.checkpoints,
            });
            return outcome;
          });
          return send(res, 200, finished), true;
        }
      }
    }
    return send(res, 404, { code: "V2_NOT_FOUND" }), true;
  } catch (error) {
    const failure = statusError(error);
    return send(res, failure.status, { ok: false, code: failure.code,
      message: error instanceof StudioV2AuthError ? failure.code :
        "Studio V2 denied the operation; refresh its current server state." }), true;
  }
};
