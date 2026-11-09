export declare const GRANDFATHERED_DUPLICATES: readonly string[];
export declare const decisionLogs: (root?: string) => string[];
export declare const definitionsIn: (text: string) => { id: string; line: number; heading: string }[];
export declare const duplicateDefinitions: (logs: Record<string, string>, allow?: readonly string[]) =>
  { id: string; at: { file: string; id: string; line: number; heading: string }[] }[];
export declare const maxDecision: (...texts: string[]) => number;
export declare const readLogs: (root?: string) => Record<string, string>;
export declare const nextDecisionId: (root?: string, history?: string) => string;
export declare const appendDecision: (root: string, id: string, title: string, logs: string[]) => { file: string; heading: string }[];
