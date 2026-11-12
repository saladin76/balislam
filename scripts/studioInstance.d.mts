export declare const portFree: (port: number) => Promise<boolean>;
export declare const listeners: (port: number) => number[];
export declare const cwdOf: (pid: number) => string | null;
export declare const alive: (pid: number) => boolean;
export declare const freePort: (port: number, root: string, opts?: { strict?: boolean; log?: (m: string) => void; error?: (m: string) => void }) => Promise<boolean>;
