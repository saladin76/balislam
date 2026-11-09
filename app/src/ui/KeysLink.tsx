import React from "react";
import { parseStudioHash, studioHash } from "../shell/route";
import { SECTION_TITLES } from "./StudioSidebar";

/** The keys page by its real name (D52), as a link that opens it (the Studio follows hash links). */
export const KEYS_PAGE = SECTION_TITLES.settings;
export const keysHref = (): string => {
  const channel = typeof window === "undefined" ? "" : parseStudioHash(window.location.hash).channel ?? "";
  return studioHash({ channel, tab: "settings" }) || "#";
};
export const KeysLink: React.FC<{ className?: string; children?: React.ReactNode }> = ({ className, children }) => (
  <a className={className ?? "keys-link"} href={keysHref()}>{children ?? `«${KEYS_PAGE}»`}</a>
);
