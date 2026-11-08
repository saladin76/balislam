/** Studio motion timing contract. No audio parsing, no IO, and no permission to approve voice. */
export type MotionWord = { word: string; start: number; end: number };
export type ApprovedEpisodeTiming = {
  episodeId: string;
  voiceSha256: string;
  approvedVoiceSha256: string;
  approvedBy: string;
  approvedAt: string;
  wholeEpisodeApproved: true;
  words: readonly MotionWord[];
};
export type MotionTimingInput = {
  mode: "preview" | "final";
  episodeId: string;
  expectedWords: readonly string[];
  durationFrames: number;
  /** Draft timings may be estimated. They can never satisfy final approval. */
  estimates?: readonly MotionWord[];
  /** Must be issued by trusted audio/workflow code; never client-provided. */
  approval?: ApprovedEpisodeTiming;
};
export type MotionTimingResolution = {
  status: "estimate" | "approved";
  timings: MotionWord[];
  audioSha256?: string;
};

const validWords = (words: readonly MotionWord[], source: readonly string[], duration: number) => {
  if (words.length !== source.length) return false;
  let lastEnd = 0;
  for (let i = 0; i < words.length; i++) {
    const w = words[i]!;
    if (w.word !== source[i] || !Number.isSafeInteger(w.start) || !Number.isSafeInteger(w.end) ||
      w.start < 0 || w.end <= w.start || w.end > duration || w.start < lastEnd) return false;
    lastEnd = w.end;
  }
  return true;
};
const sha256 = (s: unknown): s is string => typeof s === "string" && /^[0-9a-f]{64}$/i.test(s);
const supplied = (s: unknown) => typeof s === "string" && s.trim().length > 0;

/**
 * A final motion timeline is allowed only for the approved bytes of the *whole episode*.
 * Changing the audio digest or transcript fails closed; visual assets are never regenerated here.
 * The surrounding render/publish entrypoints still MUST enforce their workflow gates.
 */
export const resolveMotionTimings = (input: MotionTimingInput): MotionTimingResolution => {
  if ((input.mode !== "preview" && input.mode !== "final") ||
      !Number.isSafeInteger(input.durationFrames) || input.durationFrames < 1 ||
      !supplied(input.episodeId) || input.expectedWords.length === 0 ||
      input.expectedWords.some((w) => !supplied(w))) throw new Error("Invalid motion timing input");
  const a = input.approval;
  if (a && a.wholeEpisodeApproved === true && a.episodeId === input.episodeId &&
      supplied(a.approvedBy) && supplied(a.approvedAt) && !Number.isNaN(Date.parse(a.approvedAt)) &&
      sha256(a.voiceSha256) && sha256(a.approvedVoiceSha256) &&
      a.voiceSha256.toLowerCase() === a.approvedVoiceSha256.toLowerCase() &&
      validWords(a.words, input.expectedWords, input.durationFrames)) {
    return {
      status: "approved", audioSha256: a.voiceSha256.toLowerCase(),
      timings: a.words.map(({ word, start, end }) => ({ word, start, end })),
    };
  }
  if (input.mode === "final") throw new Error("Whole-episode approved audio and matching word timings required for final motion");
  if (!input.estimates || !validWords(input.estimates, input.expectedWords, input.durationFrames))
    throw new Error("Preview needs valid draft timing estimates");
  return { status: "estimate", timings: input.estimates.map(({ word, start, end }) => ({ word, start, end })) };
};
