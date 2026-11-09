import React from "react";
import type { ChannelSummary } from "../api";
import { num } from "../ui/format";

/** A cross-channel directory. Selection is delegated to App, so unsaved-edit protection remains centralized. */
export const ChannelsWorkspace: React.FC<{
  channels: ChannelSummary[];
  activeId: string;
  onOpen: (channelId: string, destination: "home" | "channel" | "identity") => void;
}> = ({ channels, activeId, onOpen }) => (
  <main className="studio-channels-workspace" aria-label="إدارة القنوات الثلاث">
    <header className="studio-workspace-intro">
      <p className="studio-workspace-kicker">إدارة القنوات</p>
      <h1>ثلاث قنوات، هويات مستقلة</h1>
      <p>اختر القناة قبل إدارة هويتها أو إعداداتها. الحلقات والإنتاج يبقيان في مساحة منفصلة، والمراقبة الشاملة في غرفة العمليات.</p>
    </header>
    <div className="studio-channel-grid">
      {channels.map((channel) => (
        <article key={channel.id} className="studio-channel-tile" data-channel={channel.id} aria-label={channel.name}>
          <div className="studio-channel-tile-top">
            <span className="studio-channel-avatar" aria-hidden="true">{channel.name.slice(0, 1)}</span>
            <span className="studio-channel-context">{channel.id === activeId ? "القناة النشطة" : "قناة مستقلة"}</span>
          </div>
          <h2><span>{channel.name}</span></h2>
          <p>{num(Object.keys(channel.domains || {}).length)} مجالات محتوى</p>
          <div className="studio-channel-actions">
            <button type="button" onClick={() => onOpen(channel.id, "home")}>حلقات القناة</button>
            <button type="button" onClick={() => onOpen(channel.id, "channel")}>إعدادات القناة</button>
            <button type="button" onClick={() => onOpen(channel.id, "identity")}>الهوية البصرية</button>
          </div>
        </article>
      ))}
    </div>
    {!channels.length && <p role="status">جارٍ تحميل القنوات من النظام…</p>}
  </main>
);
