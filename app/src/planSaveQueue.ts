/** One outstanding request, with the latest edit retained until the server acknowledges it. */
export class PlanSaveQueue<T> {
  private pending: { channel: string; episode: string; value: T } | null = null;
  private flight: Promise<void> | null = null;
  private revisions = new Map<string, string | Promise<string>>();
  /** The value each revision stands for: the base of a three-way merge after a conflict (D105). */
  private bases = new Map<string, T>();
  constructor(private save: (item: { channel: string; episode: string; value: T }, revision: string) => Promise<string>) {}
  private key(channel: string, episode: string) { return `${channel}/${episode}`; }
  seed(channel: string, episode: string, revision: string | Promise<string>, base?: T) {
    if (this.pending && this.key(this.pending.channel, this.pending.episode) === this.key(channel, episode)) return;
    this.revisions.set(this.key(channel, episode), revision);
    if (base !== undefined) this.bases.set(this.key(channel, episode), base);
    else this.bases.delete(this.key(channel, episode));
  }
  enqueue(channel: string, episode: string, value: T) {
    if (this.pending && this.key(channel, episode) !== this.key(this.pending.channel, this.pending.episode))
      throw new Error("احفظ تعديل الحلقة الحالية قبل فتح حلقة أخرى.");
    this.pending = { channel, episode, value };
  }
  get hasPending() { return this.pending !== null || this.flight !== null; }
  get snapshot() { return this.pending; }
  /** The version the pending edit (or the next one) starts from, when known. */
  baseOf(channel: string, episode: string): T | undefined { return this.bases.get(this.key(channel, episode)); }
  /**
   * After a conflict: the edit, re-applied onto the newest version (`base`), is now pending against that
   * version's revision. The only way a pending edit changes its base, and only by the owner's button.
   */
  rebase(channel: string, episode: string, revision: string | Promise<string>, base: T, value: T) {
    if (this.flight) throw new Error("الحفظ جارٍ الآن؛ أعد المحاولة بعد لحظات.");
    const key = this.key(channel, episode);
    if (this.pending && this.key(this.pending.channel, this.pending.episode) !== key)
      throw new Error("احفظ تعديل الحلقة الحالية قبل فتح حلقة أخرى.");
    this.revisions.set(key, revision);
    this.bases.set(key, base);
    this.pending = { channel, episode, value };
  }
  /** Drops the pending edit (the owner chose to leave it, after its backup); returns what was dropped. */
  discard(): { channel: string; episode: string; value: T } | null {
    if (this.flight) throw new Error("الحفظ جارٍ الآن؛ أعد المحاولة بعد لحظات.");
    const dropped = this.pending;
    this.pending = null;
    return dropped;
  }
  flush(): Promise<void> {
    if (this.flight) return this.flight;
    if (!this.pending) return Promise.resolve();
    const drain = async () => {
      while (this.pending) {
        const item = this.pending;
        const key = this.key(item.channel, item.episode);
        const revision = await this.revisions.get(key);
        if (!revision) throw new Error("تعذّر تحديد نسخة الخطة؛ تعديلك باقٍ هنا. أعد المحاولة بعد استعادة الاتصال.");
        const next = await this.save(item, revision);
        this.revisions.set(key, next);
        this.bases.set(key, item.value);
        // An edit made during the request is sent next, against the acknowledged revision.
        if (this.pending === item) this.pending = null;
      }
    };
    this.flight = drain().finally(() => { this.flight = null; });
    return this.flight;
  }
}
