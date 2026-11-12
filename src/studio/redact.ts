/**
 * تنقيح النص من الأسرار (D112)، بلا وحدات Node: يستعمله الخادم (`errorLog.ts`) والصفحة (بطاقة الخطأ) معًا.
 * القيم الحرفية (كل ما في .env) يمررها الخادم وحده؛ والصفحة لا تعرفها أصلًا ولا تصلها (ردود الخادم منقَّحة).
 */
/** A name whose value is a credential. */
export const SECRET_NAME = String.raw`[A-Z0-9_]*(?:KEY|SECRET|TOKEN|PASSWORD|PASSWD|PASS|HMAC|CREDENTIAL|AUTH|PRIVATE|SIGNATURE)[A-Z0-9_]*`;
export const MASK = "«محجوب»";

/** Masks secrets in one text. `values`: exact values (from .env); `root`: the Studio folder, shown as «.». */
export const redactSecrets = (text: string, opts: { values?: readonly string[]; root?: string } = {}): string => {
  let out = String(text ?? "");
  for (const v of opts.values ?? []) if (v.length >= 6) out = out.split(v).join(MASK);
  out = out
    // credentials inside a URL (a git remote with a token): https://user:token@host → https://***@host
    .replace(/([a-z][a-z0-9+.-]*:\/\/)[^@/\s'"`]+@/gi, "$1***@")
    // known token shapes
    .replace(/\b(?:gh[pousr]_[A-Za-z0-9]{16,}|github_pat_[A-Za-z0-9_]{20,}|sk_[A-Za-z0-9_-]{16,}|xox[abprs]-[A-Za-z0-9-]{10,}|AKIA[0-9A-Z]{16})\b/g, MASK)
    .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{6,}/g, `$1 ${MASK}`)
    .replace(/\b(authorization|xi-api-key|x-api-key|cookie|set-cookie)(["']?\s*[:=]\s*["']?)[^\s"',;]+/gi, `$1$2${MASK}`)
    // NAME=value, NAME: value, "NAME":"value" for a secret name
    .replace(new RegExp(`\\b(${SECRET_NAME})(["']?\\s*[:=]\\s*["']?)([^\\s"',;&]+)`, "gi"), (_m, k, sep) => `${k}${sep}${MASK}`);
  if (opts.root && opts.root.length > 1) for (const r of new Set([opts.root, opts.root.replace(/\\/g, "/")])) out = out.split(r).join(".");
  // the owner's user name in any other absolute path
  out = out.replace(/(\/(?:Users|home))\/[^/\s'"`]+/g, "$1/…").replace(/\b([A-Za-z]:\\Users)\\[^\\\s'"`]+/g, "$1\\…");
  return out;
};

