import type { AlQuranAudioEdition } from "../api";

/**
 * Review registry for specific audio editions, not reciters.
 * AlQuran Cloud's /edition/format/audio endpoint does NOT provide per-edition
 * commercial publication permissions. Do not infer rights from API presence.
 *
 * Add entries only after a human has independently reviewed documentary evidence
 * that explicitly covers commercial YouTube/video redistribution of that recording.
 * The registry starts empty because no such evidence has been verified here.
 */
export type CommercialEvidence = {
  edition: string;
  holder: string;
  evidenceUrl: string;
  scope: string;
  reviewedAt: string;
};

export const verifiedCommercialEditions: readonly CommercialEvidence[] = [];

export type ReciterRightsFilter = "all" | "verified" | "review";
const validEdition = (id: string) => /^ar\.[a-z0-9._-]{1,75}$/i.test(id);
export const validCommercialEvidence = (e: CommercialEvidence): boolean => {
  if (!validEdition(e.edition) || !e.holder.trim() ||
      !Number.isFinite(Date.parse(e.reviewedAt)) ||
      !/youtube|يوتيوب/i.test(e.scope) ||
      !/commercial|تجاري/i.test(e.scope)) return false;
  try {
    const url = new URL(e.evidenceUrl);
    return url.protocol === "https:" && !!url.hostname && !url.username && !url.password;
  } catch { return false; }
};

export const commercialEvidenceFor = (edition: string): CommercialEvidence | undefined =>
  verifiedCommercialEditions.find((entry) => entry.edition === edition && validCommercialEvidence(entry));

export const filterRecitersByRights = (
  editions: AlQuranAudioEdition[],
  mode: ReciterRightsFilter,
  evidence: readonly CommercialEvidence[] = verifiedCommercialEditions,
): AlQuranAudioEdition[] => {
  const verified = new Set(evidence.filter(validCommercialEvidence).map((entry) => entry.edition));
  return editions.filter((entry) =>
    mode === "all" ||
    (mode === "verified" && verified.has(entry.identifier)) ||
    (mode === "review" && !verified.has(entry.identifier)));
};
