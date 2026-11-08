export declare const REPO_LOCATING_GIT_VARS: string[];
export declare const cleanGitEnv: (env?: NodeJS.ProcessEnv) => NodeJS.ProcessEnv;
export declare const childEnv: (extra?: Record<string, string>, env?: NodeJS.ProcessEnv) => NodeJS.ProcessEnv;
export declare const scrubProcessGitEnv: (env?: NodeJS.ProcessEnv) => string[];
