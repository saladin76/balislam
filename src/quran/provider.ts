/** Explicit, rights-gated production source. A preview selection is NOT a publishing licence. */
export type CloudRecitation = {
  provider: "alquran-cloud";
  edition: string;
  name: string;
  licence: { holder: string; evidence: string; scope: string; verifiedAt: string };
};
export type FoundationRecitation = { id: number; name: string; provider?: "quran-foundation" };
export type RecitationChoice = CloudRecitation | FoundationRecitation;

export const isCloudRecitation = (value: RecitationChoice | undefined): value is CloudRecitation =>
  value?.provider === "alquran-cloud";

export const requireCloudPublicationRights = (recitation: CloudRecitation): void => {
  const l = recitation.licence;
  if (!/^ar\.[a-z0-9._-]{1,75}$/i.test(recitation.edition))
    throw new Error("معرّف قارئ AlQuran Cloud غير صالح.");
  if (!l || !l.holder?.trim() || !l.evidence?.trim() || !l.scope?.trim() ||
      !l.verifiedAt || !Number.isFinite(Date.parse(l.verifiedAt)) ||
      !/youtube|يوتيوب/i.test(l.scope) || !/نشر|publish|commercial|تجاري/i.test(l.scope))
    throw new Error("لا يُدرج تسجيل AlQuran Cloud في الرندر دون توثيق صاحب الحقوق وإذن نشر يوتيوب لهذا التسجيل.");
};

export const recitationIdentity = (recitation: RecitationChoice): string =>
  isCloudRecitation(recitation) ? `cloud-${recitation.edition}` : `qf-${recitation.id}`;
