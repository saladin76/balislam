import React from "react";
import type { ChannelSummary } from "../api";

/** A cross-channel directory. Selection is delegated to App, so unsaved-edit protection remains centralized. */
export const ChannelsWorkspace: React.FC<{
  channels: ChannelSummary[];
  activeId: string;
  onOpen: (channelId: string, destination: "home" | "channel" | "identity") => void;
  onRetry?: () => void;
  loadState?: "loading" | "ready" | "error";
}> = ({ channels, activeId, onOpen, onRetry, loadState = "ready" }) => (
  <main className="studio-channels-workspace" aria-label="إدارة القنوات الثلاث">
    <header className="studio-workspace-intro">
      <p className="studio-workspace-kicker">إدارة القنوات</p>
      <h1>ثلاث قنوات، هويات مستقلة</h1>
      <p>اختر القناة قبل إدارة هويتها أو إعداداتها. الحلقات والإنتاج يبقيان في مساحة منفصلة، والمراقبة الشاملة في غرفة العمليات.</p>
    </header>
    <div className="studio-channel-grid">
      {channels.map((channel) => (
        <article key={channel.id} className="studio-channel-tile" aria-label={channel.name}>
          <div className="studio-channel-tile-top">
            <span className="studio-channel-avatar" aria-hidden="true">{channel.name.slice(0, 1)}</span>
            <span className="studio-channel-context">{channel.id === activeId ? "القناة النشطة" : "قناة مستقلة"}</span>
          </div>
          <h2>{channel.name}</h2>
          <p>{channel.language} · {Object.keys(channel.domains || {}).length} مجالات محتوى</p>
          <div className="studio-channel-actions">
            <button type="button" onClick={() => onOpen(channel.id, "home")}>حلقات القناة</button>
            <button type="button" onClick={() => onOpen(channel.id, "channel")}>الإعدادات</button>
            <button type="button" onClick={() => onOpen(channel.id, "identity")}>الهوية البصرية</button>
          </div>
        </article>
      ))}
    </div>
    {!channels.length && <div role={loadState === "error" ? "alert" : "status"} className="studio-channel-empty">
      <p>{loadState === "loading" ? "جارٍ تحميل سجلات القنوات…" :
        loadState === "error" ? "تعذر تحميل القنوات. تحقق من الاتصال وأعد المحاولة." :
        "لا توجد قنوات مسجلة في النظام."}</p>
      {loadState !== "loading" && onRetry ? <button type="button" onClick={onRetry}>إعادة تحميل القنوات</button> : null}
    </div>}
  </main>
);
