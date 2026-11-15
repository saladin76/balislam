/**
 * D141 (KI-070): the line beside the scene's player when a conversation's change reached this machine after the
 * scene's video was made. The same in the three channels. Pure: no React, no server call.
 * Videos made in a cloud conversation never reach the studio (CLAUDE.md: audio and video never go to Git), so the
 * new picture is seen only after «أنتج هذا المشهد» here; a pronunciation/tashkeel/tone change needs the owner's
 * «ولّد» first (paid, never automatic; verses and the basmala never go to the voice).
 */
import type { RemoteSceneChangeView, RemoteWhat } from "../../api";

export const REMOTE_CHANGE_PRODUCE = "وصل تعديل من المحادثة على هذا المشهد — اضغط «أنتج هذا المشهد» لترى الجديد";
const VOICE: RemoteWhat[] = ["voice", "tone"];
const WHAT: [RemoteWhat, string][] = [
  ["plan", "الرسوم والحركة"], ["engine", "الرسوم"], ["voice", "النطق"], ["tone", "النبرة"],
];

export const remoteChangeLine = (r: RemoteSceneChangeView): string => {
  const what = WHAT.filter(([w]) => r.what.includes(w)).map(([, t]) => t);
  const head = `وصل تعديل من المحادثة على هذا المشهد${what.length ? ` (${what.join("، ")})` : ""}`;
  const voiceOnly = r.what.length > 0 && r.what.every((w) => VOICE.includes(w));
  if (voiceOnly) return `${head} — الصوت الحالي سُجّل قبله: ولّد الجملة من «الجمل» ثم اضغط «أنتج هذا المشهد» لترى الجديد`;
  return `${head} — اضغط «أنتج هذا المشهد» لترى الجديد`;
};
