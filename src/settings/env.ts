import { existsSync } from "node:fs";
import { open, readFile, rename, rm } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { projectRoot } from "../config/paths";

/** المفاتيح التي يديرها الاستوديو. القيم السرية لا تُعرض أبدًا، بل آخر 4 أحرف فقط. */
export const MANAGED_KEYS = {
  ELEVENLABS_API_KEY: { secret: true, label: "مفتاح ElevenLabs" },
  ELEVENLABS_VOICE_ID: { secret: false, label: "معرّف الصوت" },
  ELEVENLABS_MODEL_ID: { secret: false, label: "نموذج الصوت (اختياري)" },
  QF_CLIENT_ID: { secret: true, label: "Quran Foundation Client ID" },
  QF_CLIENT_SECRET: { secret: true, label: "Quran Foundation Client Secret" },
  QF_ENV: { secret: false, label: "بيئة Quran Foundation" },
} as const;

export type ManagedKey = keyof typeof MANAGED_KEYS;

export const envFile = () => process.env.BAL_ENV_FILE ?? path.join(projectRoot, ".env");

/** حالة المفاتيح دون كشف القيم السرية. */
export const keyStatus = () =>
  Object.fromEntries(
    (Object.keys(MANAGED_KEYS) as ManagedKey[]).map((k) => {
      const v = process.env[k] ?? "";
      const meta = MANAGED_KEYS[k];
      return [k, { label: meta.label, set: v.length > 0, preview: !v ? "" : meta.secret ? `••••${v.slice(-4)}` : v }];
    }),
  );

/**
 * يكتب المفاتيح في .env (يُنشئه من .env.example إن لم يوجد) ويحدّث البيئة الحالية فورًا.
 * قيمة فارغة تحذف المفتاح. الملف لا يُرفع إلى Git (في .gitignore).
 */
let pendingWrite: Promise<void> = Promise.resolve();

/** Serialized writes prevent concurrent settings changes from overwriting each other.
 * Process values are updated only after the durable file replacement succeeds.
 */
export const writeKeys = (updates: Partial<Record<ManagedKey, string>>): Promise<void> => {
  const operation = async () => {
    if (!updates || typeof updates !== "object" || Array.isArray(updates))
      throw new Error("تنسيق تحديث الإعدادات غير صالح.");
    const values: Partial<Record<ManagedKey, string>> = {};
    for (const [key, raw] of Object.entries(updates)) {
      if (!Object.hasOwn(MANAGED_KEYS, key) || typeof raw !== "string" ||
          raw.length > 8192 || /[\r\n\0]/.test(raw))
        throw new Error("مفتاح إعدادات غير معروف أو قيمة غير صالحة؛ لم يتم حفظ أي تغيير.");
      values[key as ManagedKey] = raw.trim();
    }
    const file = envFile();
    // A shared BAL_ENV_FILE can be written from two Studio processes. A
    // cross-process exclusive claim avoids losing one process's newer edits.
    const claimFile = `${file}.lock`;
    let claim: Awaited<ReturnType<typeof open>>;
    try {
      claim = await open(claimFile, "wx", 0o600);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST")
        throw new Error("ملف الإعدادات قيد التعديل من عملية أخرى أو يحتاج فحص قفل متروك؛ لم تُحفظ تغييرات.");
      throw error;
    }
    try {
    const example = path.join(projectRoot, ".env.example");
    let contents = existsSync(file) ? await readFile(file, "utf8") : existsSync(example) ? await readFile(example, "utf8") : "";
    for (const [key, value] of Object.entries(values)) {
      const line = `${key}=${value}`;
      const re = new RegExp(`^${key}=.*$`, "m");
      contents = re.test(contents) ? contents.replace(re, () => line) : `${contents.replace(/\n*$/, "\n")}${line}\n`;
    }
    const temp = path.join(path.dirname(file), `.${path.basename(file)}.${randomUUID()}.tmp`);
    let handle: Awaited<ReturnType<typeof open>> | undefined;
    try {
      handle = await open(temp, "wx", 0o600);
      await handle.writeFile(contents, "utf8");
      await handle.sync();
      await handle.close();
      handle = undefined;
      await rename(temp, file);
    } finally {
      if (handle) await handle.close();
      await rm(temp, { force: true });
    }
    for (const [key, value] of Object.entries(values)) {
      if (value) process.env[key] = value;
      else delete process.env[key];
    }
    } finally {
      await claim.close();
      await rm(claimFile, { force: true });
    }
  };
  const next = pendingWrite.then(operation, operation);
  pendingWrite = next.then(() => undefined, () => undefined);
  return next;
};
