export declare const CONTENT_PATH_RES: RegExp[];
export declare const isOwnerContentPath: (file: string) => boolean;
export declare const CONTENT_MAX_BYTES: number;
export declare const contentOnlyFiles: (root: string, from: string, to: string, env?: NodeJS.ProcessEnv) => string[] | null;
