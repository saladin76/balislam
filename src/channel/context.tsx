import React, { createContext, useContext } from "react";
import { channelInfo, defaultChannel, type ChannelInfo } from "./types";

const Ctx = createContext<ChannelInfo>(channelInfo(defaultChannel));

export const ChannelProvider: React.FC<{ channel?: ChannelInfo; children: React.ReactNode }> = ({ channel, children }) => (
  <Ctx.Provider value={channel ?? channelInfo(defaultChannel)}>{children}</Ctx.Provider>
);

/** اسم القناة ولغتها داخل القوالب (الشعار، شاشة النهاية، الصورة المصغّرة). */
export const useChannel = () => useContext(Ctx);

/** اسم القناة بجوار الشعار. */
export const ChannelName: React.FC = () => <>{useChannel().name}</>;
