/**
 * توجيه قول الشخصية إلى صوته (D249/D250): صوت المكتبة المعتمد لمفتاحه وحده، **ولا صوت الراوي المستنسخ أبدًا** ولو بنبرة
 * أخرى. قبل أي طلب: الصوت معتمد في `channels/<القناة>/character-voices.json` وليس صوت الراوي، والمرأة بتوجيه «normal»،
 * والنص بلا آية ولا رواية حديث ولا ذكر لمن لا يُصوَّر ولا فتوى (`speechContentIssues`)، ثم حارس القرآن نفسه في العميل.
 * لا يُستدعى من مسار آلي: توليد قول شخصية بضغطة المالك وتأكيده كأي صوت مدفوع (D151)، ولا مفتاح هنا.
 */
import { characterVoicesConfigIssues, speechContentIssues, type CharacterVoice, type CharacterVoicesFile } from "../script/characterLines";
import type { ElevenLabsClient, TtsResult } from "./elevenlabs";

export class CharacterVoiceError extends Error {
  readonly code = "CHARACTER_VOICE";
  constructor(message: string) { super(message); this.name = "CharacterVoiceError"; }
}

/** صوت المكتبة لقول شخصية، أو رفض بسببه */
export const characterVoiceFor = (
  channel: string, line: { voice: string; text: string }, voices: CharacterVoicesFile, narratorVoiceId: string | undefined, verses: readonly string[] = [],
): CharacterVoice => {
  const v = voices.voices.find((x) => x.key === line.voice);
  if (!v) throw new CharacterVoiceError(`الصوت «${line.voice}» ليس من أصوات المكتبة المعتمدة؛ لا يقرأ قول الشخصية صوت الراوي المستنسخ أبدًا.`);
  if (!narratorVoiceId) throw new CharacterVoiceError("صوت الراوي غير معروف، فلا يُتحقق أن صوت الشخصية غيره؛ لا طلب.");
  if (v.libraryVoiceId === narratorVoiceId) throw new CharacterVoiceError(`الصوت «${v.key}» هو صوت الراوي المستنسخ؛ الصوت المستنسخ للراوي وحده.`);
  const cfg = characterVoicesConfigIssues(channel, { version: 1, voices: [v] }, narratorVoiceId);
  if (cfg.length) throw new CharacterVoiceError(cfg.join(" "));
  const content = speechContentIssues(line.text, verses);
  if (content.length) throw new CharacterVoiceError(content.join(" "));
  return v;
};

/** يولّد قول الشخصية بصوت المكتبة المعتمد وحده (العميل يفحص القرآن مرة أخرى قبل بناء الطلب) */
export const speakCharacterLine = async (
  client: Pick<ElevenLabsClient, "tts">, channel: string, line: { voice: string; text: string }, voices: CharacterVoicesFile,
  narratorVoiceId: string | undefined, verses: readonly string[] = [],
): Promise<TtsResult> => {
  const v = characterVoiceFor(channel, line, voices, narratorVoiceId, verses);
  return client.tts(line.text, { voiceId: v.libraryVoiceId, verses, source: "character-line" });
};
