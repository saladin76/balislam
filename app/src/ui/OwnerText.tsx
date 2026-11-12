import React from "react";
import { splitOwnerDetails } from "../serverMessages";

/**
 * A message as the owner reads it (KI-009): the Arabic sentence, and — only for a server refusal that has no
 * Arabic translation yet — the server's own technical words folded under «تفاصيل» (closed until clicked).
 * Plain text renders as itself.
 */
export const OwnerText: React.FC<{ text?: string | null }> = ({ text }) => {
  if (!text) return null;
  const { lead, details } = splitOwnerDetails(text);
  if (details === null) return <>{lead}</>;
  return (
    <>
      {lead}
      <details className="owner-details" onClick={(e) => e.stopPropagation()}>
        <summary>تفاصيل</summary>
        <code dir="ltr">{details}</code>
      </details>
    </>
  );
};
