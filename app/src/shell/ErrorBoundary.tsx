import React from "react";
import "./shell.css";
import { readScheme, resolveScheme } from "../ui/colorScheme";
import { reportUiError, sendProblem, type Reported } from "../errorCapture";
import { redactSecrets } from "../../../src/studio/redact";

/**
 * When a screen throws while rendering (D89): instead of a white page, one card in the «المِرسَم» style (D57): a plain
 * Arabic sentence, one action «أرسل المشكلة» (D112: the error is already written to `.studio/errors.jsonl` on this
 * device; the button adds it to Claude's notes box), the way back («أعد المحاولة»، «ارجع إلى الرئيسية»), and the
 * technical text folded under «تفاصيل» (D108). Nothing is cleared or deleted: no file, no approval, no localStorage
 * key. Two scopes:
 * - `app`: around the whole Studio (main.tsx). «ارجع إلى الرئيسية» reloads the page on the channel's home.
 * - `screen`: around one step / panel. The rest of the Studio (band, top bar) stays usable; the boundary resets
 *   by itself when `resetKey` changes (another channel, episode or step).
 */
export type CrashScope = "app" | "screen";
type Props = {
  scope: CrashScope;
  /** What failed, for the eyebrow («شاشة المشاهد», «الجمل»…). */
  label?: string;
  /** A change (channel/episode/step) clears the error and renders the children again. */
  resetKey?: string;
  /** screen scope: go home inside the running Studio. Without it the page reloads on home. */
  onHome?: () => void;
  /** A compact card (a panel inside a step) with the same content. */
  compact?: boolean;
  children: React.ReactNode;
};
type State = { error: Error | null; stack: string; tries: number; sending: boolean; sent: { ok: boolean; text: string } | null };

/** The text the owner copies: message, where (component stack), the address and the time. No secret is in it. */
export const crashReport = (error: Error, componentStack: string, where = typeof window === "undefined" ? "" : window.location.href): string =>
  [
    `${error.name || "Error"}: ${error.message}`,
    where ? `العنوان: ${where}` : "",
    `الوقت: ${new Date().toISOString()}`,
    componentStack.trim() ? `المكوّن:\n${componentStack.trim().split("\n").slice(0, 8).map((l) => l.trim()).join("\n")}` : "",
    error.stack ? `المسار:\n${error.stack.split("\n").slice(0, 8).join("\n")}` : "",
  ].filter(Boolean).join("\n");

/** The channel's home, as a link the boot logic keeps (`?link`, D85). */
export const homeHref = (channel: string | null): string => {
  const ch = channel && /^[a-z0-9][a-z0-9-]{0,40}$/.test(channel) ? channel : "";
  return ch ? `/?link#/${ch}/home` : "/";
};
const storedChannel = (): string | null => {
  try { return localStorage.getItem("bal-channel"); } catch { return null; }
};

export class StudioErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null, stack: "", tries: 0, sending: false, sent: null };
  /** The record of the last caught error in `.studio/errors.jsonl` (null when the Studio did not answer). */
  reported: Promise<string | null> = Promise.resolve(null);
  static getDerivedStateFromError(error: unknown): Partial<State> {
    return { error: error instanceof Error ? error : new Error(String(error)), sent: null };
  }
  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    // The app scope may fail before the Studio set the theme: the owner's light/dark choice still applies (read only).
    if (this.props.scope === "app" && typeof document !== "undefined" && !document.documentElement.dataset.theme)
      document.documentElement.dataset.theme = resolveScheme(readScheme(), Boolean(window.matchMedia?.("(prefers-color-scheme: dark)").matches));
    this.setState({ stack: info.componentStack ?? "" });
    const label = this.props.scope === "app" ? "الاستوديو" : this.props.label ?? "شاشة";
    console.error(`[studio] ${label}:`, error);
    // D112: written on this device at once, before the owner presses anything.
    this.report = () => reportUiError({ kind: "render", error, componentStack: info.componentStack ?? "", label });
    this.reported = this.report().then((r: Reported | null) => r?.id ?? null);
  }
  private report: () => Promise<Reported | null> = () => Promise.resolve(null);
  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null, stack: "", sent: null });
  }
  private retry = () => this.setState((s) => ({ error: null, stack: "", sent: null, tries: s.tries + 1 }));
  private home = () => {
    if (this.props.onHome) { this.props.onHome(); this.retry(); return; }
    window.location.assign(homeHref(storedChannel()));
  };
  private send = async () => {
    this.setState({ sending: true });
    const sent = await sendProblem(await this.reported, async () => (await this.report())?.id ?? null);
    this.setState({ sending: false, sent });
  };
  private id = `crash-${Math.random().toString(36).slice(2, 8)}`;
  render() {
    const { error, stack, tries, sending, sent } = this.state;
    // The key remounts the children on «أعد المحاولة», so a stale state inside them does not throw again.
    if (!error) return <React.Fragment key={tries}>{this.props.children}</React.Fragment>;
    const app = this.props.scope === "app";
    // No credential on screen either (D112): the patterns of src/studio/redact.ts (a token, a key=value, a URL with a token).
    const text = redactSecrets(crashReport(error, stack));
    const card = (
      <section className={`locked-step crash-step${this.props.compact ? " is-compact" : ""}`} role="alert" aria-labelledby={this.id}>
        <div className="locked-card">
          <p className="locked-eyebrow">{app ? "الاستوديو" : this.props.label ?? "هذه الشاشة"} — تعذّر العرض</p>
          <h2 id={this.id}>حدث خطأ في العرض</h2>
          <p className="locked-reason">لم يُمسح شيء ولم يُحذف: ملفاتك واعتماداتك وتسجيلاتك كما هي. اضغط «أرسل المشكلة» فيصل الخطأ إلى Claude بتفاصيله، بلا صورة شاشة ولا شرح؛ ثم أعد المحاولة أو ارجع إلى الرئيسية.</p>
          {sent ? <p role="status" className={`crash-sent${sent.ok ? " is-ok" : " is-err"}`}>{sent.text}</p> : null}
          <div className="crash-actions">
            {!sent?.ok ? (
              <button type="button" className="btn primary" disabled={sending} onClick={() => void this.send()}>{sending ? "يُرسل…" : "أرسل المشكلة"}</button>
            ) : null}
            <button type="button" className="btn" onClick={this.retry}>أعد المحاولة</button>
            <button type="button" className="btn ghost" onClick={this.home}>ارجع إلى الرئيسية</button>
          </div>
          <details className="owner-details crash-details">
            <summary>تفاصيل</summary>
            <code dir="ltr">{text}</code>
          </details>
        </div>
      </section>
    );
    // The app scope has no shell around it: the card brings the channel's tokens itself.
    return app ? <div className="studio-shell shell-v3 crash-shell" data-channel={storedChannel() ?? ""}>{card}</div> : card;
  }
}
