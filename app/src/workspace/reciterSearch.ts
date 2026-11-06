export type FoundationReciter = { id: number; name: string; style: string };

const canonical = (input: string) => input.normalize("NFKD")
  .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
  .replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه")
  .toLocaleLowerCase().trim();

/** Search the entire live provider catalog; never hide voices via a hardcoded shortlist. */
export const searchFoundationReciters = (list: FoundationReciter[], search: string): FoundationReciter[] => {
  const needle = canonical(search);
  return list
    .filter((r) => Number.isSafeInteger(r.id) && r.id > 0 && r.name.trim())
    .filter((r) => !needle || canonical(`${r.name} ${r.style} ${r.id}`).includes(needle))
    .sort((a, b) => a.name.localeCompare(b.name, "ar") || a.id - b.id);
};
