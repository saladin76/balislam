import React from "react";
import { IdentityProvider, type Identity } from "../../brand/identity/index";
import { ChannelProvider } from "../channel/context";
import { LangProvider } from "../i18n/context";
import type { ChannelInfo } from "../channel/types";

/** يلفّ أي تكوين بهوية القناة واسمها ولغة الحلقة. أي قيمة غائبة تأخذ الافتراضي. */
export const Providers: React.FC<{ identity?: Identity; channel?: ChannelInfo; lang?: string; children: React.ReactNode }> = ({ identity, channel, lang, children }) => {
  const inner = (
    <ChannelProvider channel={channel}>
      <LangProvider lang={lang ?? channel?.language}>{children}</LangProvider>
    </ChannelProvider>
  );
  return identity ? <IdentityProvider identity={identity}>{inner}</IdentityProvider> : inner;
};
