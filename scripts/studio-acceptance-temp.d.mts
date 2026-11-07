/** Companion declaration for studio-acceptance-temp.mjs under TS Bundler resolution. */
export declare function cleanupOwnedAcceptanceTemp(
  evidenceDir: string,
  scratchDir: string,
): Promise<{
  before: string[];
  after: string[];
  clean: boolean;
}>;
